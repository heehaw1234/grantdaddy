import { supabase } from '@/integrations/supabase/client';
import { parseGrantQuery, ParsedGrantQuery } from '@/integrations/supabase/gemini';
import { Grant } from '@/types/database';

/**
 * Grant with relevance score for ranked results
 */
export interface GrantWithScore extends Grant {
    matchScore: number;
    matchReasons: string[];
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
 * Scoring weights - adjust these to tune matching behavior
 * Future: could be personalized per user or learned from behavior
 */
const SCORING_WEIGHTS = {
    issueAreaMatch: 0.35,
    fundingRangeMatch: 0.25,
    scopeMatch: 0.15,
    deadlineProximity: 0.10,
    keywordMatch: 0.10,
    userPreferenceBonus: 0.05,
};

/**
 * Calculate match score between a grant and parsed query criteria
 */
function calculateMatchScore(
    grant: Grant,
    criteria: ParsedGrantQuery,
    userPrefs?: UserPreferences
): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Issue area matching (35%)
    if (criteria.issueAreas.length > 0 && grant.issue_area) {
        const grantArea = grant.issue_area.toLowerCase();
        const matchedArea = criteria.issueAreas.find(area =>
            grantArea.includes(area.toLowerCase()) ||
            area.toLowerCase().includes(grantArea)
        );
        if (matchedArea) {
            score += SCORING_WEIGHTS.issueAreaMatch;
            reasons.push(`Matches ${grant.issue_area} focus area`);
        }
    } else if (criteria.issueAreas.length === 0) {
        // No specific area requested, give partial credit
        score += SCORING_WEIGHTS.issueAreaMatch * 0.5;
    }

    // Funding range matching (25%)
    if (grant.funding_min !== null || grant.funding_max !== null) {
        const grantMin = grant.funding_min || 0;
        const grantMax = grant.funding_max || Infinity;
        const queryMin = criteria.fundingMin || 0;
        const queryMax = criteria.fundingMax || Infinity;

        // Check if ranges overlap
        if (grantMin <= queryMax && grantMax >= queryMin) {
            score += SCORING_WEIGHTS.fundingRangeMatch;
            reasons.push(`Funding range fits your budget`);
        } else if (queryMin === 0 && queryMax === Infinity) {
            // No funding preference specified
            score += SCORING_WEIGHTS.fundingRangeMatch * 0.5;
        }
    }

    // Scope matching (15%)
    if (criteria.scope && grant.scope) {
        if (grant.scope.toLowerCase() === criteria.scope.toLowerCase()) {
            score += SCORING_WEIGHTS.scopeMatch;
            reasons.push(`${grant.scope} scope matches preference`);
        }
    } else if (!criteria.scope) {
        score += SCORING_WEIGHTS.scopeMatch * 0.5;
    }

    // Deadline proximity (10%) - prioritize upcoming deadlines
    if (grant.application_due_date) {
        const dueDate = new Date(grant.application_due_date);
        const today = new Date();
        const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilDue > 0 && daysUntilDue <= 90) {
            // Closer deadlines get higher scores (but still active)
            const proximityScore = Math.max(0, 1 - (daysUntilDue / 90));
            score += SCORING_WEIGHTS.deadlineProximity * proximityScore;
            if (daysUntilDue <= 30) {
                reasons.push(`Deadline in ${daysUntilDue} days`);
            }
        } else if (daysUntilDue > 90) {
            score += SCORING_WEIGHTS.deadlineProximity * 0.3;
        }
    }

    // Keyword matching (10%)
    if (criteria.keywords.length > 0) {
        const grantText = `${grant.title} ${grant.description || ''} ${grant.eligibility_criteria || ''}`.toLowerCase();
        const matchedKeywords = criteria.keywords.filter(kw => grantText.includes(kw.toLowerCase()));
        if (matchedKeywords.length > 0) {
            const keywordScore = Math.min(1, matchedKeywords.length / criteria.keywords.length);
            score += SCORING_WEIGHTS.keywordMatch * keywordScore;
            if (matchedKeywords.length >= 2) {
                reasons.push(`Matches keywords: ${matchedKeywords.slice(0, 2).join(', ')}`);
            }
        }
    }

    // User preference bonus (5%)
    if (userPrefs) {
        let prefMatch = 0;
        if (userPrefs.issueAreas?.some(area =>
            grant.issue_area?.toLowerCase().includes(area.toLowerCase())
        )) {
            prefMatch += 0.5;
        }
        if (userPrefs.preferredScope &&
            grant.scope?.toLowerCase() === userPrefs.preferredScope.toLowerCase()) {
            prefMatch += 0.5;
        }
        if (prefMatch > 0) {
            score += SCORING_WEIGHTS.userPreferenceBonus * prefMatch;
            reasons.push(`Matches your saved preferences`);
        }
    }

    // Normalize score to 0-100 percentage
    const normalizedScore = Math.round(Math.min(100, score * 100));

    return { score: normalizedScore, reasons };
}

/**
 * Fetch grants from Supabase with optional filters
 */
async function fetchGrants(criteria: ParsedGrantQuery): Promise<Grant[]> {
    let query = supabase
        .from('grants')
        .select('*')
        .eq('is_active', true);

    // Apply funding filters if specified
    if (criteria.fundingMin !== null) {
        query = query.gte('funding_max', criteria.fundingMin);
    }
    if (criteria.fundingMax !== null) {
        query = query.lte('funding_min', criteria.fundingMax);
    }

    // Apply scope filter if specified
    if (criteria.scope) {
        query = query.ilike('scope', `%${criteria.scope}%`);
    }

    // Apply deadline filter if specified
    if (criteria.deadlineBefore) {
        query = query.lte('application_due_date', criteria.deadlineBefore);
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
async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
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
 * Main search function - takes natural language query and returns scored grants
 */
export async function searchGrants(
    query: string,
    userId?: string
): Promise<GrantWithScore[]> {
    // Parse the natural language query using Gemini
    const criteria = await parseGrantQuery(query);
    console.log('Parsed query criteria:', criteria);

    // Fetch matching grants from database
    const grants = await fetchGrants(criteria);

    // Fetch user preferences if user is logged in
    let userPrefs: UserPreferences | null = null;
    if (userId) {
        userPrefs = await fetchUserPreferences(userId);
    }

    // Score and sort grants
    const scoredGrants: GrantWithScore[] = grants.map(grant => {
        const { score, reasons } = calculateMatchScore(grant, criteria, userPrefs || undefined);
        return {
            ...grant,
            matchScore: score,
            matchReasons: reasons,
        };
    });

    // Sort by score (highest first)
    scoredGrants.sort((a, b) => b.matchScore - a.matchScore);

    // Filter out very low matches if we have good matches
    const hasGoodMatches = scoredGrants.some(g => g.matchScore >= 50);
    if (hasGoodMatches) {
        return scoredGrants.filter(g => g.matchScore >= 20);
    }

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
        matchReasons: ['Active grant'],
    }));
}
