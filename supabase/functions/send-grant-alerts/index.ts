// Supabase Edge Function: send-grant-alerts
// 
// This function matches grants to users' preferences and sends email notifications
// via Resend. It can be triggered manually or scheduled via cron.
//
// SETUP REQUIRED:
// 1. Set RESEND_API_KEY secret in Supabase Dashboard
// 2. Deploy with: supabase functions deploy send-grant-alerts
// 3. (Optional) Schedule with cron in supabase/config.toml

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface AlertPreference {
    id: string
    user_id: string
    email: string
    match_threshold: number
    issue_areas: string[]
    preferred_scope: string | null
    funding_min: number
    funding_max: number
}

interface Grant {
    id: string
    title: string
    description: string
    issue_area: string
    scope: string
    funding_min: number
    funding_max: number
    application_due_date: string
    source_url: string
    matchScore?: number
}

Deno.serve(async (req) => {
    // Handle CORS preflight - must return 200 status for browsers
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders })
    }

    try {
        // Initialize Supabase client with service role key
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const resendApiKey = Deno.env.get('RESEND_API_KEY')

        const supabase = createClient(supabaseUrl, supabaseKey)

        // Parse request body for test mode
        let testMode = false
        let specificUserId: string | null = null

        try {
            const body = await req.json()
            testMode = body?.testMode || false
            specificUserId = body?.userId || null
        } catch {
            // No body, run normally
        }

        // 1. Get users with alerts enabled
        let query = supabase
            .from('email_alert_preferences')
            .select('*')
            .eq('is_enabled', true)

        if (specificUserId) {
            query = query.eq('user_id', specificUserId)
        }

        const { data: preferences, error: prefError } = await query

        if (prefError) {
            throw new Error(`Failed to fetch preferences: ${prefError.message}`)
        }

        if (!preferences || preferences.length === 0) {
            return new Response(
                JSON.stringify({ success: true, message: 'No users with alerts enabled', emailsSent: 0 }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        let emailsSent = 0
        const results: { userId: string; status: string; grantsFound: number }[] = []

        // 2. Process each user
        for (const pref of preferences as AlertPreference[]) {
            try {
                // Find matching grants
                const matchingGrants = await findMatchingGrants(supabase, pref)

                // Get already-sent grant IDs
                const { data: sentGrants } = await supabase
                    .from('email_notification_log')
                    .select('grant_id')
                    .eq('user_id', pref.user_id)

                const sentIds = new Set(sentGrants?.map((s: { grant_id: string }) => s.grant_id) || [])
                const newGrants = matchingGrants.filter(g => !sentIds.has(g.id))

                if (newGrants.length === 0) {
                    results.push({ userId: pref.user_id, status: 'no_new_grants', grantsFound: 0 })
                    continue
                }

                // 3. Send email (if Resend is configured)
                if (resendApiKey) {
                    const emailSent = await sendEmail(resendApiKey, pref.email, newGrants)

                    if (emailSent) {
                        // 4. Log sent notifications (upsert to handle duplicates gracefully)
                        for (const grant of newGrants) {
                            await supabase.from('email_notification_log').upsert({
                                user_id: pref.user_id,
                                grant_id: grant.id,
                                match_score: grant.matchScore,
                                sent_at: new Date().toISOString(),
                            }, {
                                onConflict: 'user_id,grant_id',
                                ignoreDuplicates: true,
                            })
                        }

                        // Update last_sent_at
                        await supabase
                            .from('email_alert_preferences')
                            .update({ last_sent_at: new Date().toISOString() })
                            .eq('id', pref.id)

                        emailsSent++
                        results.push({ userId: pref.user_id, status: 'sent', grantsFound: newGrants.length })
                    } else {
                        results.push({ userId: pref.user_id, status: 'email_failed', grantsFound: newGrants.length })
                    }
                } else {
                    // No Resend API key - just log what would be sent
                    results.push({
                        userId: pref.user_id,
                        status: testMode ? 'test_mode_no_resend_key' : 'no_resend_key',
                        grantsFound: newGrants.length
                    })
                }
            } catch (userError) {
                console.error(`Error processing user ${pref.user_id}:`, userError)
                results.push({ userId: pref.user_id, status: 'error', grantsFound: 0 })
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                emailsSent,
                usersProcessed: preferences.length,
                results,
                testMode,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Edge function error:', error)
        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

/**
 * Find grants matching user preferences
 */
async function findMatchingGrants(
    supabase: ReturnType<typeof createClient>,
    pref: AlertPreference
): Promise<Grant[]> {
    const today = new Date().toISOString().split('T')[0]

    let query = supabase
        .from('grants')
        .select('*')
        .eq('is_active', true)
        .gte('application_due_date', today)

    const { data } = await query

    if (!data) return []

    // Calculate match scores and filter by threshold
    const scoredGrants = (data as Grant[]).map(grant => {
        let score = 50 // Base score

        // Issue area match (+30)
        if (pref.issue_areas?.length > 0) {
            if (pref.issue_areas.includes(grant.issue_area)) {
                score += 30
            }
        } else {
            score += 15 // No preference = partial credit
        }

        // Scope match (+10)
        if (pref.preferred_scope) {
            if (grant.scope === pref.preferred_scope) {
                score += 10
            }
        } else {
            score += 5
        }

        // Funding range match (+10)
        const grantMin = grant.funding_min || 0
        const grantMax = grant.funding_max || Infinity
        if (grantMin <= pref.funding_max && grantMax >= pref.funding_min) {
            score += 10
        }

        return {
            ...grant,
            matchScore: Math.min(100, score),
        }
    })

    return scoredGrants.filter(g => g.matchScore >= pref.match_threshold)
}

/**
 * Send email via Resend API
 */
async function sendEmail(apiKey: string, to: string, grants: Grant[]): Promise<boolean> {
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'GrantMatch <onboarding@resend.dev>', // Resend test sender - update with your verified domain for production
                to: [to],
                subject: `🎯 ${grants.length} New Matching Grant${grants.length > 1 ? 's' : ''} Found!`,
                html: buildEmailHtml(grants),
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('Resend API error:', error)
            return false
        }

        return true
    } catch (error) {
        console.error('Failed to send email:', error)
        return false
    }
}

/**
 * Build HTML email content
 */
function buildEmailHtml(grants: Grant[]): string {
    const grantCards = grants.map(g => `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; background: #ffffff;">
      <h3 style="margin: 0 0 8px 0; color: #1f2937;">${escapeHtml(g.title)}</h3>
      <p style="color: #6b7280; margin: 0 0 12px 0; font-size: 14px;">
        ${escapeHtml(g.description?.slice(0, 150) || '')}${g.description && g.description.length > 150 ? '...' : ''}
      </p>
      <table style="font-size: 14px; color: #374151;">
        <tr>
          <td style="padding-right: 16px;"><strong>💰 Funding:</strong></td>
          <td>$${(g.funding_min || 0).toLocaleString()} - $${(g.funding_max || 0).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding-right: 16px;"><strong>📅 Deadline:</strong></td>
          <td>${g.application_due_date ? new Date(g.application_due_date).toLocaleDateString() : 'TBD'}</td>
        </tr>
        <tr>
          <td style="padding-right: 16px;"><strong>🎯 Match:</strong></td>
          <td>${g.matchScore}%</td>
        </tr>
      </table>
      ${g.source_url ? `
        <a href="${escapeHtml(g.source_url)}" 
           style="display: inline-block; margin-top: 12px; background: #2563eb; color: white; 
                  padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          View Grant →
        </a>
      ` : ''}
    </div>
  `).join('')

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                 max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
      <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; color: white; font-size: 24px;">🎯 New Matching Grants!</h1>
        <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9);">
          We found ${grants.length} new grant${grants.length > 1 ? 's' : ''} matching your preferences
        </p>
      </div>
      
      <div style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        ${grantCards}
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          You're receiving this because you enabled grant alerts in GrantMatch.<br>
          <a href="#" style="color: #6b7280;">Manage preferences</a> · 
          <a href="#" style="color: #6b7280;">Unsubscribe</a>
        </p>
      </div>
    </body>
    </html>
  `
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
    if (!text) return ''
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}
