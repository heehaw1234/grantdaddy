import { supabase } from '@/integrations/supabase/client';

/**
 * Email Alert Preferences Interface
 */
export interface EmailAlertPreferences {
    id?: string;
    user_id: string;
    email: string;
    is_enabled: boolean;
    match_threshold: number;
    frequency: 'instant' | 'daily' | 'weekly';
    issue_areas: string[];
    preferred_scope: 'local' | 'national' | 'international' | null;
    funding_min: number;
    funding_max: number;
    last_sent_at?: string;
    created_at?: string;
    updated_at?: string;
}

/**
 * Default preferences for new users
 */
export const DEFAULT_ALERT_PREFERENCES: Omit<EmailAlertPreferences, 'user_id' | 'email'> = {
    is_enabled: false,
    match_threshold: 70,
    frequency: 'daily',
    issue_areas: [],
    preferred_scope: null,
    funding_min: 0,
    funding_max: 100000,
};

// Helper to access tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (table: string) => (supabase as any).from(table);

/**
 * Get the current user's access token for authenticated API calls
 */
async function getAccessToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
}

/**
 * Load user's email alert preferences
 */
export async function loadAlertPreferences(userId: string): Promise<EmailAlertPreferences | null> {
    const { data, error } = await fromTable('email_alert_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('Error loading alert preferences:', error);
        return null;
    }

    return data as EmailAlertPreferences | null;
}

/**
 * Save user's email alert preferences (upsert)
 */
export async function saveAlertPreferences(
    preferences: EmailAlertPreferences
): Promise<{ success: boolean; error?: string }> {
    const { error } = await fromTable('email_alert_preferences')
        .upsert({
            ...preferences,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'user_id',
        });

    if (error) {
        console.error('Error saving alert preferences:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}
/**
 * Send a test email to verify the setup works
 * Uses Supabase client's built-in function invocation
 */
export async function sendTestAlertEmail(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            console.error('No active session found');
            return { success: false, error: 'Not authenticated. Please log in again.' };
        }

        console.log('Calling Edge Function with session:', session.user?.email);

        const { data, error } = await supabase.functions.invoke('send-grant-alerts', {
            body: {
                testMode: true,
                userId,
            },
        });

        if (error) {
            console.error('Edge function error:', error);
            // Try to get more error details
            const errorDetails = (error as any).context?.body || error.message;
            return { success: false, error: typeof errorDetails === 'string' ? errorDetails : error.message };
        }

        console.log('Edge function response:', data);
        return { success: true };
    } catch (err) {
        console.error('Caught error:', err);
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        };
    }
}

/**
 * Get notification history for a user
 */
export async function getNotificationHistory(userId: string, limit = 20) {
    const { data, error } = await fromTable('email_notification_log')
        .select(`
      *,
      grants (
        title,
        issue_area,
        funding_min,
        funding_max,
        application_due_date
      )
    `)
        .eq('user_id', userId)
        .order('sent_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching notification history:', error);
        return [];
    }

    return data || [];
}
