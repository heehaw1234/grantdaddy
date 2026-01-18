import { supabase } from '@/integrations/supabase/client';
import { Grant } from '@/types/database';
import {
    scoreGrantsSemantically,
    filterByThreshold,
    GrantScore,
    UserMatchPreferences
} from './semanticMatcher';

/**
 * Grant with relevance score for ranked results
 */
export interface GrantWithScore extends Grant {
    matchScore: number;
    matchReasons: string[];
    whyMatches?: string[];
    whyDoesNotMatch?: string[];
}

/**
 * User preferences for personalized matching
 */
export interface UserPreferences {
    issueAreas?: string[];
    preferredScope?: string;
    fundingMin?: number;
    fundingMax?: number;
}

/**
 * Fetch all active grants from Supabase
 * Pre-filtering happens before LLM scoring to reduce API calls
 */
async function fetchAllActiveGrants(filters?: {
    issueArea?: string | null;
    scope?: string | null;
    fundingMin?: number;
    fundingMax?: number;
}): Promise<Grant[]> {
    let query = supabase
        .from('grants')
        .select('*')
        .eq('is_active', true);

    // Apply hard filters if specified (reduces grants before LLM scoring)
    if (filters?.issueArea) {
        query = query.ilike('issue_area', `%${filters.issueArea}%`);
    }
    if (filters?.scope) {
        query = query.ilike('scope', `%${filters.scope}%`);
    }
    if (filters?.fundingMin && filters.fundingMin > 0) {
        query = query.gte('funding_max', filters.fundingMin);
    }
    if (filters?.fundingMax && filters.fundingMax < 500000) {
        query = query.lte('funding_min', filters.fundingMax);
    }

    // Only show grants with future deadlines
    const today = new Date().toISOString().split('T')[0];
    query = query.or(`application_due_date.gte.${today},application_due_date.is.null`);

    const { data, error } = await query.order('application_due_date', { ascending: true });

    if (error) {
        console.error('Error fetching grants:', error);
        throw error;
    }

    return (data as Grant[]) || [];
}

/**
 * Fetch user preferences from Supabase
 */
export async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
    const { data, error } = await supabase
        .from('user_preferences')
        .select('issue_areas, preferred_scope, funding_min, funding_max')
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle() to handle case where no preferences exist

    if (error) {
        console.warn('Could not fetch user preferences:', error.message);
        return null;
    }

    if (!data) {
        return null;
    }

    return {
        issueAreas: data.issue_areas || [],
        preferredScope: data.preferred_scope || undefined,
        fundingMin: data.funding_min || undefined,
        fundingMax: data.funding_max || undefined,
    };
}

/**
 * Update user preferences in Supabase (for AI extracted filters and manual filter sync)
 */
export async function updateUserPreferences(
    userId: string,
    preferences: {
        issueArea?: string | null;
        scope?: string | null;
        fundingMin?: number;
        fundingMax?: number;
    }
): Promise<boolean> {
    console.log('📝 Saving preferences to Supabase:', preferences);

    const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };

    // Only update fields that are explicitly set
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

    const { error } = await supabase
        .from('user_preferences')
        .upsert({
            user_id: userId,
            ...updateData,
        }, {
            onConflict: 'user_id',
        });

    if (error) {
        console.error('Failed to update user preferences:', error);
        return false;
    }

    console.log('✅ Preferences saved successfully');
    return true;
}

/**
 * Main search function - uses LLM semantic scoring for accurate matching
 * Takes natural language query and returns semantically scored grants
 */
export async function searchGrants(
    query: string,
    userId?: string,
    filters?: {
        issueArea?: string | null;
        scope?: string | null;
        fundingMin?: number;
        fundingMax?: number;
    },
    useProfilePreferences: boolean = true
): Promise<GrantWithScore[]> {
    console.log('🔍 Starting semantic search:', query);
    console.log(`👤 Profile preferences: ${useProfilePreferences ? 'ENABLED' : 'DISABLED'}`);

    // Fetch user preferences if logged in AND if enabled
    let userPrefs: UserMatchPreferences | undefined;
    if (userId && useProfilePreferences) {
        const prefs = await fetchUserPreferences(userId);
        if (prefs) {
            userPrefs = {
                issueAreas: prefs.issueAreas,
                preferredScope: prefs.preferredScope,
                fundingMin: prefs.fundingMin,
                fundingMax: prefs.fundingMax,
            };
            console.log(`✓ Using user preferences:`, userPrefs);
        }
    } else if (userId && !useProfilePreferences) {
        console.log(`⊘ Profile preferences disabled - scoring based on query only`);
    }

    // Fetch grants (with optional pre-filtering to reduce LLM calls)
    const grants = await fetchAllActiveGrants(filters);
    console.log(`📚 Fetched ${grants.length} grants to score`);

    if (grants.length === 0) {
        return [];
    }

    // Use semantic LLM scoring
    const scores = await scoreGrantsSemantically(query, grants, userPrefs);

    // Filter by threshold and create scored grant objects
    const thresholdScores = filterByThreshold(scores, 30);

    // Map scores to full grant objects
    const grantsMap = new Map(grants.map(g => [g.id, g]));
    const scoredGrants: GrantWithScore[] = thresholdScores
        .map(score => {
            const grant = grantsMap.get(score.grantId);
            if (!grant) return null;
            return {
                ...grant,
                matchScore: score.score,
                matchReasons: score.reasons,
                whyMatches: score.whyMatches,
                whyDoesNotMatch: score.whyDoesNotMatch,
            };
        })
        .filter((g): g is GrantWithScore => g !== null);

    console.log(`✅ Returning ${scoredGrants.length} matches (threshold: 30%)`);
    return scoredGrants;
}

/**
 * Get recommended grants for a user based on their preferences
 */
export async function getRecommendedGrants(userId: string): Promise<GrantWithScore[]> {
    const userPrefs = await fetchUserPreferences(userId);

    if (!userPrefs) {
        // No preferences set, return recent active grants
        const { data } = await supabase
            .from('grants')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(10);

        return (data as Grant[] || []).map(grant => ({
            ...grant,
            matchScore: 50,
            matchReasons: ['Recently added grant'],
        }));
    }

    // Build a query string from user preferences
    const queryParts: string[] = [];
    if (userPrefs.issueAreas?.length) {
        queryParts.push(userPrefs.issueAreas.join(' '));
    }
    if (userPrefs.preferredScope) {
        queryParts.push(userPrefs.preferredScope);
    }
    if (userPrefs.fundingMin || userPrefs.fundingMax) {
        const min = userPrefs.fundingMin || 0;
        const max = userPrefs.fundingMax || 1000000;
        queryParts.push(`funding between $${min} and $${max}`);
    }

    const syntheticQuery = queryParts.join(' ') || 'general grants';
    return searchGrants(syntheticQuery, userId);
}

/**
 * Manual filter options (without NLP)
 */
export interface ManualFilters {
    issueArea: string | null;
    scope: string | null;
    fundingMin: number;
    fundingMax: number;
}

/**
 * Filter grants manually without using the Gemini API
 * This is useful when users want direct control or when API quota is exceeded
 */
export async function filterGrantsManually(
    filters: ManualFilters
): Promise<GrantWithScore[]> {
    let query = supabase
        .from('grants')
        .select('*')
        .eq('is_active', true);

    // Apply issue area filter
    if (filters.issueArea) {
        query = query.ilike('issue_area', `%${filters.issueArea}%`);
    }

    // Apply scope filter
    if (filters.scope) {
        query = query.ilike('scope', `%${filters.scope}%`);
    }

    // Apply funding filters
    if (filters.fundingMin > 0) {
        query = query.gte('funding_max', filters.fundingMin);
    }
    if (filters.fundingMax < 500000) {
        query = query.lte('funding_min', filters.fundingMax);
    }

    // Only show grants with future deadlines
    const today = new Date().toISOString().split('T')[0];
    query = query.or(`application_due_date.gte.${today},application_due_date.is.null`);

    const { data, error } = await query.order('application_due_date', { ascending: true });

    if (error) {
        console.error('Error filtering grants:', error);
        throw error;
    }

    // Add match scores based on how many filters matched
    const grants = (data as Grant[]) || [];
    return grants.map(grant => {
        const reasons: string[] = [];
        let matchCount = 0;
        const totalFilters = (filters.issueArea ? 1 : 0) +
            (filters.scope ? 1 : 0) +
            (filters.fundingMin > 0 || filters.fundingMax < 500000 ? 1 : 0);

        if (filters.issueArea && grant.issue_area?.toLowerCase().includes(filters.issueArea.toLowerCase())) {
            matchCount++;
            reasons.push(`Matches ${grant.issue_area} focus`);
        }
        if (filters.scope && grant.scope?.toLowerCase().includes(filters.scope.toLowerCase())) {
            matchCount++;
            reasons.push(`${grant.scope} scope`);
        }
        if (filters.fundingMin > 0 || filters.fundingMax < 500000) {
            matchCount++;
            reasons.push(`Within funding range`);
        }

        // Calculate score (100% if all filters match, proportional otherwise)
        const score = totalFilters > 0 ? Math.round((matchCount / totalFilters) * 100) : 75;

        return {
            ...grant,
            matchScore: Math.max(50, score), // Minimum 50% since they passed the DB filters
            matchReasons: reasons.length > 0 ? reasons : ['Matches your filters'],
            whyMatches: reasons.length > 0 ? reasons : ['Matches your selected filters'],
            whyDoesNotMatch: score < 100 ? ['Some filter criteria may not be fully met'] : [],
        };
    });
}

/**
 * Get all active grants (no filtering)
 */
export async function getAllGrants(): Promise<GrantWithScore[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('grants')
        .select('*')
        .eq('is_active', true)
        .or(`application_due_date.gte.${today},application_due_date.is.null`)
        .order('application_due_date', { ascending: true });

    if (error) {
        console.error('Error fetching grants:', error);
        throw error;
    }

    return (data as Grant[] || []).map(grant => ({
        ...grant,
        matchScore: 50,
        matchReasons: ['Active grant - use NLP search for detailed matching'],
        whyMatches: ['Grant is currently active and accepting applications'],
        whyDoesNotMatch: ['No specific search criteria applied yet'],
    }));
}

/**
 * Simple keyword search without LLM - instant results
 * Useful as fallback when AI is rate-limited
 */
export async function searchGrantsByKeyword(
    keyword: string
): Promise<GrantWithScore[]> {
    const today = new Date().toISOString().split('T')[0];
    const searchTerm = keyword.toLowerCase().trim();

    const { data, error } = await supabase
        .from('grants')
        .select('*')
        .eq('is_active', true)
        .or(`application_due_date.gte.${today},application_due_date.is.null`);

    if (error) {
        console.error('Error searching grants:', error);
        throw error;
    }

    const grants = (data as Grant[]) || [];

    // Score based on keyword matches
    const scoredGrants = grants.map(grant => {
        const titleMatch = grant.title?.toLowerCase().includes(searchTerm);
        const descMatch = grant.description?.toLowerCase().includes(searchTerm);
        const eligMatch = grant.eligibility_criteria?.toLowerCase().includes(searchTerm);
        const areaMatch = grant.issue_area?.toLowerCase().includes(searchTerm);

        const matchCount = [titleMatch, descMatch, eligMatch, areaMatch].filter(Boolean).length;
        const reasons: string[] = [];

        if (titleMatch) reasons.push(`Title contains "${keyword}"`);
        if (descMatch) reasons.push(`Description mentions "${keyword}"`);
        if (eligMatch) reasons.push(`Eligibility mentions "${keyword}"`);
        if (areaMatch) reasons.push(`Issue area: ${grant.issue_area}`);

        // Calculate score based on match quality
        let score = 0;
        if (titleMatch) score += 40;  // Title match is most important
        if (areaMatch) score += 25;   // Issue area match
        if (descMatch) score += 20;   // Description match
        if (eligMatch) score += 15;   // Eligibility match

        return {
            ...grant,
            matchScore: Math.min(100, score),
            matchReasons: reasons.length > 0 ? reasons : ['No direct keyword match'],
        };
    });

    // Filter and sort
    return scoredGrants
        .filter(g => g.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore);
}
