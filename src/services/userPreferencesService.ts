import { supabase } from '@/integrations/supabase/client';

/**
 * Organization Profile - extends user preferences with org-specific data
 */
export interface OrganizationProfile {
    user_id: string;

    // Basic org identity
    org_name?: string;
    org_type?: 'nonprofit' | 'social_enterprise' | 'academic' | 'government' | 'other';
    mission_statement?: string;
    year_founded?: number;

    // Capacity
    org_size?: 'small' | 'medium' | 'large';
    team_size?: number;
    annual_budget_min?: number;
    annual_budget_max?: number;

    // Focus & scope
    issue_areas?: string[];
    geographic_scope?: string[];
    regions_served?: string[];
    key_expertise?: string[];

    // Grant preferences (existing fields)
    preferred_scope?: string;
    funding_min?: number;
    funding_max?: number;

    updated_at?: string;
}

/**
 * Combined preferences for filters, alerts, and profile
 */
export interface UnifiedPreferences {
    // Filter preferences
    issueArea?: string | null;
    scope?: string | null;
    fundingMin?: number;
    fundingMax?: number;

    // Organization profile
    profile?: OrganizationProfile;
}

// Helper to access tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (table: string) => (supabase as any).from(table);

/**
 * Load the full organization profile and preferences
 */
export async function loadOrganizationProfile(userId: string): Promise<OrganizationProfile | null> {
    const { data, error } = await fromTable('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('Error loading organization profile:', error);
        return null;
    }

    if (!data) {
        return null;
    }

    return {
        user_id: userId,
        org_name: data.org_name,
        org_type: data.org_type,
        mission_statement: data.mission_statement,
        year_founded: data.year_founded,
        org_size: data.org_size,
        team_size: data.team_size,
        annual_budget_min: data.annual_budget_min,
        annual_budget_max: data.annual_budget_max,
        issue_areas: data.issue_areas || [],
        geographic_scope: data.geographic_scope || [],
        regions_served: data.regions_served || [],
        key_expertise: data.key_expertise || [],
        preferred_scope: data.preferred_scope,
        funding_min: data.funding_min,
        funding_max: data.funding_max,
        updated_at: data.updated_at,
    };
}

/**
 * Save organization profile to Supabase
 */
export async function saveOrganizationProfile(
    userId: string,
    profile: Partial<OrganizationProfile>
): Promise<{ success: boolean; error?: string }> {
    console.log('📝 Saving organization profile:', profile);

    const updateData: Record<string, unknown> = {
        user_id: userId,
        updated_at: new Date().toISOString(),
    };

    // Map profile fields to database columns
    if (profile.org_name !== undefined) updateData.org_name = profile.org_name;
    if (profile.org_type !== undefined) updateData.org_type = profile.org_type;
    if (profile.mission_statement !== undefined) updateData.mission_statement = profile.mission_statement;
    if (profile.year_founded !== undefined) updateData.year_founded = profile.year_founded;
    if (profile.org_size !== undefined) updateData.org_size = profile.org_size;
    if (profile.team_size !== undefined) updateData.team_size = profile.team_size;
    if (profile.annual_budget_min !== undefined) updateData.annual_budget_min = profile.annual_budget_min;
    if (profile.annual_budget_max !== undefined) updateData.annual_budget_max = profile.annual_budget_max;
    if (profile.issue_areas !== undefined) updateData.issue_areas = profile.issue_areas;
    if (profile.geographic_scope !== undefined) updateData.geographic_scope = profile.geographic_scope;
    if (profile.regions_served !== undefined) updateData.regions_served = profile.regions_served;
    if (profile.key_expertise !== undefined) updateData.key_expertise = profile.key_expertise;
    if (profile.preferred_scope !== undefined) updateData.preferred_scope = profile.preferred_scope;
    if (profile.funding_min !== undefined) updateData.funding_min = profile.funding_min;
    if (profile.funding_max !== undefined) updateData.funding_max = profile.funding_max;

    const { error } = await fromTable('user_preferences')
        .upsert(updateData, { onConflict: 'user_id' });

    if (error) {
        console.error('Failed to save organization profile:', error);
        return { success: false, error: error.message };
    }

    console.log('✅ Organization profile saved successfully');
    return { success: true };
}

/**
 * Load unified preferences (filter prefs + profile summary)
 */
export async function loadUnifiedPreferences(userId: string): Promise<UnifiedPreferences> {
    const profile = await loadOrganizationProfile(userId);

    return {
        issueArea: profile?.issue_areas?.[0] || null,
        scope: profile?.preferred_scope || null,
        fundingMin: profile?.funding_min || 0,
        fundingMax: profile?.funding_max || 500000,
        profile,
    };
}

/**
 * Update filter preferences and sync to profile
 * Used by GrantFilters and NLP extraction
 */
export async function updateFilterPreferences(
    userId: string,
    preferences: {
        issueArea?: string | null;
        scope?: string | null;
        fundingMin?: number;
        fundingMax?: number;
    }
): Promise<boolean> {
    console.log('📝 Updating filter preferences:', preferences);

    const updateData: Record<string, unknown> = {
        user_id: userId,
        updated_at: new Date().toISOString(),
    };

    // Map filter fields to database columns
    if (preferences.issueArea !== undefined) {
        updateData.issue_areas = preferences.issueArea ? [preferences.issueArea] : [];
    }
    if (preferences.scope !== undefined) {
        updateData.preferred_scope = preferences.scope;
    }
    if (preferences.fundingMin !== undefined) {
        updateData.funding_min = preferences.fundingMin;
    }
    if (preferences.fundingMax !== undefined) {
        updateData.funding_max = preferences.fundingMax;
    }

    const { error } = await fromTable('user_preferences')
        .upsert(updateData, { onConflict: 'user_id' });

    if (error) {
        console.error('Failed to update filter preferences:', error);
        return false;
    }

    console.log('✅ Filter preferences updated successfully');
    return true;
}

/**
 * Sync alert preferences issue_areas from organization profile
 */
export async function syncAlertPreferencesFromProfile(userId: string): Promise<boolean> {
    const profile = await loadOrganizationProfile(userId);
    if (!profile?.issue_areas?.length) {
        return false;
    }

    const { error } = await fromTable('email_alert_preferences')
        .update({
            issue_areas: profile.issue_areas,
            preferred_scope: profile.preferred_scope,
            funding_min: profile.funding_min,
            funding_max: profile.funding_max,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

    if (error) {
        console.error('Failed to sync alert preferences:', error);
        return false;
    }

    return true;
}

/**
 * Calculate profile completion percentage
 */
export function calculateProfileCompletion(profile: OrganizationProfile | null): number {
    if (!profile) return 0;

    const fields = [
        profile.org_name,
        profile.org_type,
        profile.mission_statement,
        profile.year_founded,
        profile.org_size,
        profile.issue_areas?.length,
        profile.geographic_scope?.length,
        profile.funding_min || profile.funding_max,
    ];

    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
}
