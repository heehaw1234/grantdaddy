import { supabase } from '@/integrations/supabase/client';
import { Grant } from '@/types/database';

/**
 * Pipeline status for saved grants
 */
export type GrantPipelineStatus =
    | 'discovered'
    | 'saved'
    | 'applied'
    | 'submitted'
    | 'awarded'
    | 'rejected';

/**
 * Saved grant with pipeline tracking
 */
export interface SavedGrant {
    id: string;
    user_id: string;
    grant_id: string;
    status: GrantPipelineStatus;
    notes?: string;
    reminder_date?: string;
    created_at: string;
    updated_at: string;
    grant?: Grant;
}

/**
 * Pipeline status labels and colors for UI
 */
export const PIPELINE_STATUS_CONFIG: Record<GrantPipelineStatus, { label: string; color: string; bgColor: string }> = {
    discovered: { label: 'Discovered', color: 'text-gray-600', bgColor: 'bg-gray-100' },
    saved: { label: 'Saved', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    applied: { label: 'Applied', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    submitted: { label: 'Submitted', color: 'text-purple-600', bgColor: 'bg-purple-100' },
    awarded: { label: 'Awarded', color: 'text-green-600', bgColor: 'bg-green-100' },
    rejected: { label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-100' },
};

// Helper to access tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (table: string) => (supabase as any).from(table);

/**
 * Get all saved grants for a user with grant details
 */
export async function getSavedGrants(userId: string): Promise<SavedGrant[]> {
    const { data, error } = await fromTable('saved_grants')
        .select(`
            *,
            grant:grants (*)
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error fetching saved grants:', error);
        return [];
    }

    return (data || []).map((item: any) => ({
        ...item,
        grant: item.grant,
    }));
}

/**
 * Save a grant to the user's list
 */
export async function saveGrant(
    userId: string,
    grantId: string,
    status: GrantPipelineStatus = 'saved'
): Promise<{ success: boolean; error?: string }> {
    const { error } = await fromTable('saved_grants')
        .upsert({
            user_id: userId,
            grant_id: grantId,
            status,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'user_id,grant_id',
        });

    if (error) {
        console.error('Error saving grant:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Remove a grant from saved list
 */
export async function removeSavedGrant(
    userId: string,
    grantId: string
): Promise<{ success: boolean; error?: string }> {
    const { error } = await fromTable('saved_grants')
        .delete()
        .eq('user_id', userId)
        .eq('grant_id', grantId);

    if (error) {
        console.error('Error removing saved grant:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Update the status of a saved grant
 */
export async function updateGrantStatus(
    userId: string,
    grantId: string,
    status: GrantPipelineStatus
): Promise<{ success: boolean; error?: string }> {
    const { error } = await fromTable('saved_grants')
        .update({
            status,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('grant_id', grantId);

    if (error) {
        console.error('Error updating grant status:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Update notes for a saved grant
 */
export async function updateGrantNotes(
    userId: string,
    grantId: string,
    notes: string
): Promise<{ success: boolean; error?: string }> {
    const { error } = await fromTable('saved_grants')
        .update({
            notes,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('grant_id', grantId);

    if (error) {
        console.error('Error updating grant notes:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Set reminder date for a saved grant
 */
export async function setGrantReminder(
    userId: string,
    grantId: string,
    reminderDate: string | null
): Promise<{ success: boolean; error?: string }> {
    const { error } = await fromTable('saved_grants')
        .update({
            reminder_date: reminderDate,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('grant_id', grantId);

    if (error) {
        console.error('Error setting grant reminder:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Check if a grant is saved by the user
 */
export async function isGrantSaved(userId: string, grantId: string): Promise<boolean> {
    const { data, error } = await fromTable('saved_grants')
        .select('id')
        .eq('user_id', userId)
        .eq('grant_id', grantId)
        .maybeSingle();

    if (error) {
        console.error('Error checking saved grant:', error);
        return false;
    }

    return !!data;
}

/**
 * Get counts by status for a user
 */
export async function getStatusCounts(userId: string): Promise<Record<GrantPipelineStatus, number>> {
    const { data, error } = await fromTable('saved_grants')
        .select('status')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching status counts:', error);
        return {
            discovered: 0,
            saved: 0,
            applied: 0,
            submitted: 0,
            awarded: 0,
            rejected: 0,
        };
    }

    const counts: Record<GrantPipelineStatus, number> = {
        discovered: 0,
        saved: 0,
        applied: 0,
        submitted: 0,
        awarded: 0,
        rejected: 0,
    };

    (data || []).forEach((item: { status: GrantPipelineStatus }) => {
        if (counts[item.status] !== undefined) {
            counts[item.status]++;
        }
    });

    return counts;
}

/**
 * Get grants that need deadline reminders
 */
export async function getGrantsNeedingReminders(
    userId: string,
    daysAhead: number[] = [7, 14, 30]
): Promise<SavedGrant[]> {
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + Math.max(...daysAhead));

    const { data, error } = await fromTable('saved_grants')
        .select(`
            *,
            grant:grants (*)
        `)
        .eq('user_id', userId)
        .in('status', ['saved', 'applied'])
        .lte('grant.application_due_date', maxDate.toISOString().split('T')[0])
        .gte('grant.application_due_date', today.toISOString().split('T')[0]);

    if (error) {
        console.error('Error fetching grants needing reminders:', error);
        return [];
    }

    return data || [];
}
