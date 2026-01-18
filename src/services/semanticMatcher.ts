import { Grant } from '@/types/database';
import Groq from 'groq-sdk';

// Multiple API keys for parallel processing
const API_KEYS = [
    import.meta.env.VITE_GROQ_API_KEY,
    import.meta.env.VITE_GROQ_API_KEY_2,
    import.meta.env.VITE_GROQ_API_KEY_3,
].filter(Boolean);

if (API_KEYS.length === 0) {
    throw new Error('At least one VITE_GROQ_API_KEY must be set');
}

console.log(`🔑 Initialized with ${API_KEYS.length} Groq API keys for parallel processing`);

// Create Groq clients for each API key
const groqClients = API_KEYS.map(apiKey => new Groq({
    apiKey,
    dangerouslyAllowBrowser: true
}));


/**
 * Score result from LLM for a single grant
 */
export interface GrantScore {
    grantId: string;
    score: number;
    reasons: string[];  // Legacy - combined reasons
    whyMatches: string[];  // Positive reasons why it matches
    whyDoesNotMatch: string[];  // Negative reasons / concerns
}

/**
 * Filters extracted from user query by LLM
 */
export interface ExtractedFilters {
    issueArea?: string | null;
    scope?: string | null;
    fundingMin?: number | null;
    fundingMax?: number | null;
    funder?: string | null;
    deadlineWithin?: number | null; // Days: 30, 60, 90
}

/**
 * Result from LLM scoring including extracted filters
 */
export interface ScoringResult {
    scores: GrantScore[];
    filters: ExtractedFilters;
}

/**
 * User preferences for personalized matching
 */
export interface UserMatchPreferences {
    issueAreas?: string[];
    preferredScope?: string;
    fundingMin?: number;
    fundingMax?: number;
}

/**
 * Configuration for semantic matching
 */
const CONFIG = {
    BATCH_SIZE: 8,           // Grants per API call (optimized for Groq context)
    MIN_SCORE_THRESHOLD: 30, // Minimum score to include in results
    PREFERENCE_BOOST: 5,     // Points added for matching user preferences
    CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes cache
};

/**
 * Simple session cache for search results
 */
const resultCache = new Map<string, { results: GrantScore[]; timestamp: number }>();

function getCacheKey(query: string, grantCount: number): string {
    return `${query.toLowerCase().trim()}_${grantCount}`;
}

function getCachedResults(query: string, grantCount: number): GrantScore[] | null {
    const key = getCacheKey(query, grantCount);
    const cached = resultCache.get(key);

    if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_TTL_MS) {
        console.log('📦 Cache hit for query:', query);
        return cached.results;
    }

    return null;
}

function cacheResults(query: string, grantCount: number, results: GrantScore[]): void {
    const key = getCacheKey(query, grantCount);
    resultCache.set(key, { results, timestamp: Date.now() });
}

/**
 * Split grants into batches for parallel API calls
 */
function batchGrants<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
    }
    return batches;
}

/**
 * Build the scoring prompt for a batch of grants
 */
function buildScoringPrompt(
    userQuery: string,
    grants: Grant[],
    userPrefs?: UserMatchPreferences
): string {
    const grantsText = grants.map((g, i) => `
[Grant ${i + 1}] ID: ${g.id}
Title: ${g.title}
Description: ${g.description || 'No description'}
Eligibility: ${g.eligibility_criteria || 'Not specified'}
Issue Area: ${g.issue_area || 'General'}
Funding: $${g.funding_min || 0} - $${g.funding_max || 'No limit'}
`).join('\n');

    const userContext = userPrefs && (userPrefs.issueAreas?.length || userPrefs.preferredScope)
        ? `\nUSER PROFILE: Interested in ${userPrefs.issueAreas?.join(', ') || 'various areas'}. Prefers ${userPrefs.preferredScope || 'any'} scope.`
        : '';

    return `You are a helpful Singapore grant matching assistant. Score each grant's relevance to what the person is looking for and explain both why it matches AND why it might not be ideal.

What they're looking for: "${userQuery}"${userContext}

Grants to evaluate:
${grantsText}

Scoring guide:
- 85-100: Excellent fit - directly matches their needs
- 70-84: Good fit - clearly relevant and likely eligible
- 50-69: Partial fit - somewhat related
- 30-49: Weak fit - only loosely connected
- 0-29: Not relevant

For each grant, provide:
1. "whyMatches" - Array of reasons why this grant IS a good fit (positive aspects)
2. "whyDoesNotMatch" - Array of reasons why this grant might NOT be ideal or concerns (negative aspects, limitations, potential issues)

Be specific and address the user directly with "you/your".

Also extract any filters mentioned (issue area, scope, funding range, funder, deadline preferences).

Return valid JSON only:
{
  "filters": {
    "issueArea": "Youth Development" or null,
    "scope": "national" or "local" or "international" or null,
    "fundingMin": number or null,
    "fundingMax": number or null,
    "funder": "foundation name" or null,
    "deadlineWithin": 30 or 60 or 90 or null
  },
  "scores": [
    {
      "id": "grant-uuid",
      "score": 85,
      "whyMatches": ["This grant directly supports your interest in youth volunteering", "Funding range of $20,000 fits your budget", "Open to individuals and organizations"],
      "whyDoesNotMatch": ["Deadline is only 2 weeks away", "Requires prior experience in the sector"]
    }
  ]
}`;
}

/**
 * Parse the LLM response into structured scores
 */
function parseScoreResponse(response: string, grants: Grant[]): GrantScore[] {
    try {
        // Clean up response - remove markdown if present
        let cleaned = response
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        let parsed = JSON.parse(cleaned);

        // Handle wrapped responses like {scores: [...]} or {grants: [...]} or {results: [...]}
        if (!Array.isArray(parsed)) {
            // Try to find an array property
            const arrayProp = Object.values(parsed).find(v => Array.isArray(v));
            if (arrayProp) {
                console.log('Found wrapped array, extracting...');
                parsed = arrayProp;
            } else {
                console.error('Response is not an array and has no array property:', parsed);
                return [];
            }
        }

        return parsed.map((item: {
            id?: string;
            index?: number;
            score?: number;
            reason?: string;
            reasons?: string[];
            whyMatches?: string[];
            whyDoesNotMatch?: string[];
        }) => {
            // Handle both id-based and index-based responses
            let grantId = item.id;
            if (!grantId && item.index !== undefined) {
                const grant = grants[item.index - 1]; // 1-indexed
                grantId = grant?.id;
            }

            // Handle both single reason and reasons array (legacy support)
            let reasons: string[] = [];
            if (item.reasons && Array.isArray(item.reasons)) {
                reasons = item.reasons;
            } else if (item.reason) {
                reasons = [item.reason];
            }

            // Extract whyMatches and whyDoesNotMatch
            const whyMatches = item.whyMatches || [];
            const whyDoesNotMatch = item.whyDoesNotMatch || [];

            // If legacy format, try to split reasons into pros/cons
            if (reasons.length > 0 && whyMatches.length === 0) {
                reasons.forEach(r => {
                    if (r.toLowerCase().includes('not') || r.toLowerCase().includes('concern') || r.toLowerCase().includes('limit')) {
                        whyDoesNotMatch.push(r);
                    } else {
                        whyMatches.push(r);
                    }
                });
            }

            // Combine for legacy compatibility
            const combinedReasons = [...whyMatches, ...whyDoesNotMatch];

            return {
                grantId: grantId || '',
                score: Math.min(100, Math.max(0, item.score || 0)),
                reasons: combinedReasons.length > 0 ? combinedReasons : ['Match analysis complete'],
                whyMatches: whyMatches.length > 0 ? whyMatches : ['Potential match found'],
                whyDoesNotMatch,
            };
        }).filter((s: GrantScore) => s.grantId); // Remove any without valid IDs

    } catch (error) {
        console.error('Failed to parse LLM response:', error, '\nResponse:', response);
        return [];
    }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Score a batch of grants using a specific Groq client with retry logic
 */
async function scoreGrantBatch(
    userQuery: string,
    grants: Grant[],
    groqClient: Groq,
    userPrefs?: UserMatchPreferences,
    retryCount: number = 0
): Promise<GrantScore[]> {
    const MAX_RETRIES = 3;
    const prompt = buildScoringPrompt(userQuery, grants, userPrefs);

    try {
        const response = await groqClient.chat.completions.create({
            model: 'llama-3.1-8b-instant', // Using smaller model to reduce token usage
            messages: [
                { role: 'user', content: prompt }
            ],
            temperature: 0.1, // Low temperature for consistent scoring
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0].message.content || '[]';
        return parseScoreResponse(content, grants);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isRateLimit = errorMessage.includes('429') || errorMessage.includes('rate');

        // Retry with exponential backoff for rate limits
        if (isRateLimit && retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.log(`⏳ Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await sleep(delay);
            return scoreGrantBatch(userQuery, grants, groqClient, userPrefs, retryCount + 1);
        }

        console.error('Groq API error for batch:', error);
        // Return default scores on error (don't fail the whole search)
        return grants.map(g => ({
            grantId: g.id,
            score: 50,
            reasons: ['Could not analyze - showing as potential match'],
            whyMatches: ['Could not fully analyze - shown as potential match'],
            whyDoesNotMatch: ['Analysis incomplete due to service error'],
        }));
    }
}

/**
 * Main semantic scoring function - scores all grants against user query
 * Uses parallel processing across multiple API keys for ~3x faster performance
 */
export async function scoreGrantsSemantically(
    userQuery: string,
    grants: Grant[],
    userPrefs?: UserMatchPreferences
): Promise<GrantScore[]> {
    // Check cache first
    const cached = getCachedResults(userQuery, grants.length);
    if (cached) {
        return cached;
    }

    console.log(`🔍 Semantic scoring: "${userQuery}" against ${grants.length} grants`);

    // Batch grants for parallel processing
    const batches = batchGrants(grants, CONFIG.BATCH_SIZE);
    console.log(`📦 Split into ${batches.length} batches of up to ${CONFIG.BATCH_SIZE} grants`);
    console.log(`⚡ Processing in parallel using ${groqClients.length} API keys`);

    // Process batches in parallel using all available API keys
    const batchPromises = batches.map((batch, index) => {
        // Assign each batch to a different API key (round-robin)
        const clientIndex = index % groqClients.length;
        const client = groqClients[clientIndex];

        console.log(`  → Batch ${index + 1}/${batches.length} assigned to API key ${clientIndex + 1}`);

        return scoreGrantBatch(userQuery, batch, client, userPrefs);
    });

    // Wait for all batches to complete
    const startTime = Date.now();
    const allBatchResults = await Promise.all(batchPromises);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ All batches completed in ${elapsed}s`);


    // Flatten results and deduplicate (keep highest score per grant)
    const allScoresRaw = allBatchResults.flat();
    const scoreMap = new Map<string, GrantScore>();
    for (const score of allScoresRaw) {
        const existing = scoreMap.get(score.grantId);
        if (!existing || score.score > existing.score) {
            scoreMap.set(score.grantId, score);
        }
    }
    let allScores = Array.from(scoreMap.values());

    // Apply user preference boost
    if (userPrefs?.issueAreas?.length) {
        const grantsMap = new Map(grants.map(g => [g.id, g]));

        allScores = allScores.map(score => {
            const grant = grantsMap.get(score.grantId);
            if (grant && userPrefs.issueAreas?.some(area =>
                grant.issue_area?.toLowerCase().includes(area.toLowerCase())
            )) {
                return {
                    ...score,
                    score: Math.min(100, score.score + CONFIG.PREFERENCE_BOOST),
                    reasons: [...score.reasons, '✨ Matches your preferences'],
                    whyMatches: [...score.whyMatches, '✨ Matches your profile preferences'],
                };
            }
            return score;
        });
    }

    // Sort by score (highest first)
    allScores.sort((a, b) => b.score - a.score);

    // Cache results
    cacheResults(userQuery, grants.length, allScores);

    console.log(`✅ Scoring complete. Top match: ${allScores[0]?.score}%`);

    return allScores;
}

/**
 * Filter scores by minimum threshold
 */
export function filterByThreshold(
    scores: GrantScore[],
    threshold: number = CONFIG.MIN_SCORE_THRESHOLD
): GrantScore[] {
    return scores.filter(s => s.score >= threshold);
}

/**
 * Clear the result cache (useful for testing)
 */
export function clearCache(): void {
    resultCache.clear();
}
