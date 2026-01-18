// Supabase Edge Function: send-grant-alerts
// 
// This function matches grants to users' preferences using Groq AI semantic matching
// and sends email notifications via Resend.
//
// SETUP REQUIRED:
// 1. Set RESEND_API_KEY secret in Supabase Dashboard
// 2. Set GROQ_API_KEY secret in Supabase Dashboard
// 3. Deploy with: supabase functions deploy send-grant-alerts

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
    funder_name: string
    matchScore?: number
    whyMatches?: string[]
    whyDoesNotMatch?: string[]
}

interface UserProfile {
    org_name: string
    mission_statement: string
    issue_areas: string[]
    geographic_scope: string[]
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const resendApiKey = Deno.env.get('RESEND_API_KEY')
        const groqApiKey = Deno.env.get('GROQ_API_KEY')

        const supabase = createClient(supabaseUrl, supabaseKey)

        let testMode = false
        let specificUserId: string | null = null

        try {
            const body = await req.json()
            testMode = body?.testMode || false
            specificUserId = body?.userId || null
        } catch {
            // No body, run normally
        }

        // Get users with alerts enabled
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

        // Process each user
        for (const pref of preferences as AlertPreference[]) {
            try {
                // Get user profile for semantic matching
                const { data: profileData } = await supabase
                    .from('user_preferences')
                    .select('*')
                    .eq('user_id', pref.user_id)
                    .single()

                const userProfile: UserProfile | null = profileData ? {
                    org_name: profileData.org_name || 'Your Organization',
                    mission_statement: profileData.mission_statement || '',
                    issue_areas: profileData.issue_areas || [],
                    geographic_scope: profileData.geographic_scope || []
                } : null

                // Find matching grants with AI scoring
                const matchingGrants = await findMatchingGrantsWithAI(
                    supabase,
                    pref,
                    userProfile,
                    groqApiKey
                )

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

                // Send email
                if (resendApiKey) {
                    const emailSent = await sendEmail(resendApiKey, pref.email, newGrants, userProfile)

                    if (emailSent) {
                        // Log sent notifications
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
 * Find grants matching user preferences using Groq AI semantic matching
 */
async function findMatchingGrantsWithAI(
    supabase: ReturnType<typeof createClient>,
    pref: AlertPreference,
    userProfile: UserProfile | null,
    groqApiKey?: string
): Promise<Grant[]> {
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
        .from('grants')
        .select('*')
        .eq('is_active', true)
        .gte('application_due_date', today)

    if (!data || data.length === 0) return []

    const grants = data as Grant[]

    // If no Groq key, fall back to simple matching
    if (!groqApiKey || !userProfile || !userProfile.mission_statement) {
        return grants.map(g => ({ ...g, matchScore: 50 }))
            .filter(g => g.matchScore >= pref.match_threshold)
    }

    // Use Groq AI for semantic matching
    const scoredGrants = await scoreGrantsBatch(grants, userProfile, pref, groqApiKey)

    return scoredGrants.filter(g => g.matchScore >= pref.match_threshold)
}

/**
 * Score grants using Groq AI in batches
 */
async function scoreGrantsBatch(
    grants: Grant[],
    userProfile: UserProfile,
    pref: AlertPreference,
    groqApiKey: string
): Promise<Grant[]> {
    const BATCH_SIZE = 5 // Process 5 grants at a time
    const results: Grant[] = []

    for (let i = 0; i < grants.length; i += BATCH_SIZE) {
        const batch = grants.slice(i, i + BATCH_SIZE)
        const prompt = buildScoringPrompt(batch, userProfile, pref)

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    response_format: { type: 'json_object' },
                }),
            })

            if (response.ok) {
                const data = await response.json()
                const parsed = JSON.parse(data.choices[0].message.content)
                const scores = parsed.grants || []

                batch.forEach((grant, idx) => {
                    const scoreData = scores[idx] || {}
                    results.push({
                        ...grant,
                        matchScore: scoreData.score || 50,
                        whyMatches: scoreData.whyMatches || [],
                        whyDoesNotMatch: scoreData.whyDoesNotMatch || []
                    })
                })
            } else {
                // Fallback to default score
                batch.forEach(grant => results.push({ ...grant, matchScore: 50 }))
            }
        } catch (error) {
            console.error('AI scoring error:', error)
            batch.forEach(grant => results.push({ ...grant, matchScore: 50 }))
        }

        // Small delay to avoid rate limits
        if (i + BATCH_SIZE < grants.length) {
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
    }

    return results
}

/**
 * Build AI scoring prompt
 */
function buildScoringPrompt(grants: Grant[], userProfile: UserProfile, pref: AlertPreference): string {
    return `You are an expert grant matching AI. Score how well each grant matches this organization.

ORGANIZATION PROFILE:
- Name: ${userProfile.org_name}
- Mission: ${userProfile.mission_statement}
- Focus Areas: ${userProfile.issue_areas.join(', ')}
- Geographic Scope: ${userProfile.geographic_scope.join(', ')}

USER PREFERENCES:
- Looking for: ${pref.issue_areas.join(', ') || 'Any area'}
- Preferred Scope: ${pref.preferred_scope || 'Any'}
- Budget Range: $${pref.funding_min} - $${pref.funding_max}

GRANTS TO SCORE:
${grants.map((g, i) => `
${i + 1}. ${g.title}
   Funder: ${g.funder_name || 'Unknown'}
   Description: ${g.description?.slice(0, 200)}
   Issue Area: ${g.issue_area}
   Funding: $${g.funding_min} - $${g.funding_max}
   Deadline: ${g.application_due_date}
`).join('\n')}

Return JSON with this exact format:
{
  "grants": [
    {
      "score": 85,
      "whyMatches": ["Reason 1", "Reason 2"],
      "whyDoesNotMatch": ["Concern 1"]
    }
  ]
}

Score 0-100. Include 2-3 reasons why it matches and 0-2 concerns.`
}

/**
 * Send email via Resend API
 */
async function sendEmail(
    apiKey: string,
    to: string,
    grants: Grant[],
    userProfile: UserProfile | null
): Promise<boolean> {
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'GrantMatch <onboarding@resend.dev>',
                to: [to],
                subject: `🎯 ${grants.length} Grant${grants.length > 1 ? 's' : ''} Perfect for ${userProfile?.org_name || 'Your Organization'}!`,
                html: buildEmailHtml(grants, userProfile),
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
 * Build modern HTML email with fit analysis
 */
function buildEmailHtml(grants: Grant[], userProfile: UserProfile | null): string {
    const grantCards = grants.map(g => `
    <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 20px 0; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
        <h3 style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">${escapeHtml(g.title)}</h3>
        <span style="background: ${g.matchScore >= 75 ? '#dcfce7' : '#fef3c7'}; color: ${g.matchScore >= 75 ? '#166534' : '#92400e'}; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; margin-left: 12px;">
          ${g.matchScore}% Match
        </span>
      </div>
      
      <p style="color: #6b7280; margin: 0 0 16px 0; font-size: 14px; line-height: 1.5;">
        <strong>${escapeHtml(g.funder_name || 'Grant')}</strong> • 
        ${escapeHtml(g.description?.slice(0, 120) || '')}${g.description && g.description.length > 120 ? '...' : ''}
      </p>
      
      ${g.whyMatches && g.whyMatches.length > 0 ? `
      <div style="background: #f0fdf4; border-left: 3px solid #22c55e; padding: 12px; margin: 12px 0; border-radius: 6px;">
        <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #166534;">✓ Why This is a Good Fit:</p>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #166534;">
          ${g.whyMatches.slice(0, 3).map(reason => `<li style="margin: 4px 0;">${escapeHtml(reason)}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      
      <table style="font-size: 13px; color: #4b5563; width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; width: 120px;"><strong>💰 Funding:</strong></td>
          <td style="padding: 6px 0;">$${(g.funding_min || 0).toLocaleString()} - $${(g.funding_max || 0).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0;"><strong>📅 Deadline:</strong></td>
          <td style="padding: 6px 0;">${g.application_due_date ? new Date(g.application_due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0;"><strong>🎯 Focus:</strong></td>
          <td style="padding: 6px 0;">${escapeHtml(g.issue_area)} • ${escapeHtml(g.scope)}</td>
        </tr>
      </table>
      
      ${g.source_url ? `
        <a href="${escapeHtml(g.source_url)}" 
           style="display: inline-block; margin-top: 16px; background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; 
                  padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Find Out More Information →
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
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; 
                 margin: 0; padding: 0; background: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 32px 24px; border-radius: 16px; text-align: center;">
          <h1 style="margin: 0 0 8px 0; color: white; font-size: 28px; font-weight: 700;">🎯 New Perfect Matches!</h1>
          <p style="margin: 0; color: rgba(255,255,255,0.95); font-size: 16px;">
            ${grants.length} grant${grants.length > 1 ? 's' : ''} tailored for ${userProfile?.org_name || 'your organization'}
          </p>
        </div>
        
        <!-- Main Content -->
        <div style="background: #ffffff; padding: 24px; margin-top: -12px; border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb;">
          ${userProfile?.mission_statement ? `
          <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; margin-bottom: 24px; border-radius: 6px;">
            <p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.6;">
              <strong>Your Mission:</strong> ${escapeHtml(userProfile.mission_statement.slice(0, 150))}${userProfile.mission_statement.length > 150 ? '...' : ''}
            </p>
          </div>
          ` : ''}
          
          ${grantCards}
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0 0 8px 0;">You're receiving this because you enabled grant alerts in GrantMatch</p>
          <p style="margin: 0;">
            <a href="#" style="color: #6b7280; text-decoration: none;">Manage Preferences</a> • 
            <a href="#" style="color: #6b7280; text-decoration: none;">Unsubscribe</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

function escapeHtml(text: string): string {
    if (!text) return ''
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}
