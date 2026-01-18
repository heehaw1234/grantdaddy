import Groq from 'groq-sdk';
import { Grant } from '@/types/database';
import { GrantWithScore } from '@/services/grantMatcher';
import { OrganizationProfile } from './userPreferencesService';

// Groq API keys with rotation support
const API_KEYS = [
    import.meta.env.VITE_GROQ_API_KEY,
    import.meta.env.VITE_GROQ_API_KEY_2,
    import.meta.env.VITE_GROQ_API_KEY_3,
].filter(Boolean);

if (API_KEYS.length === 0) {
    throw new Error('At least one VITE_GROQ_API_KEY must be set');
}

let currentKeyIndex = 0;

function getGroqClient(): Groq {
    const apiKey = API_KEYS[currentKeyIndex];
    return new Groq({
        apiKey,
        dangerouslyAllowBrowser: true
    });
}

function rotateApiKey(): void {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    console.log(`🔄 Rotated to writeup API key ${currentKeyIndex + 1}/${API_KEYS.length}`);
}

export interface WriteupContext {
    grant: GrantWithScore;
    userProfile?: OrganizationProfile;
    searchQuery?: string;
    appliedFilters?: {
        issueArea?: string | null;
        scope?: string | null;
        fundingMin?: number;
        fundingMax?: number;
    };
    customInstructions?: string;
}

/**
 * Generate a grant fit analysis writeup in markdown format
 * Focuses on why the organization is a good match for the grant
 */
export async function generateGrantWriteup(context: WriteupContext): Promise<string> {
    const { grant, userProfile, searchQuery, appliedFilters, customInstructions } = context;

    // Build the prompt with all available context
    const prompt = buildWriteupPrompt(grant, userProfile, searchQuery, appliedFilters, customInstructions);

    try {
        const groq = getGroqClient();
        const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile', // Updated to current supported model
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert grant consultant who analyzes why organizations are a good fit for specific grant opportunities. You write clear, evidence-based assessments that highlight strengths and address concerns.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 3000,
        });

        const writeup = response.choices[0].message.content || '';
        return writeup;

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isRateLimit = errorMessage.includes('429') || errorMessage.includes('rate');

        if (isRateLimit && API_KEYS.length > 1) {
            console.log('⚠️ Rate limited during writeup generation, trying next API key...');
            rotateApiKey();
            return generateGrantWriteup(context);
        }

        console.error('Failed to generate writeup:', error);
        throw new Error('Failed to generate writeup. Please try again.');
    }
}

/**
 * Build the AI prompt for fit analysis generation
 */
function buildWriteupPrompt(
    grant: GrantWithScore,
    userProfile?: OrganizationProfile,
    searchQuery?: string,
    appliedFilters?: any,
    customInstructions?: string
): string {
    const sections = [];

    // Header
    sections.push(`# Grant Fit Analysis

Analyze why the following organization is a good fit for this grant opportunity.

## Grant Details

**Title:** ${grant.title}
**Funder:** ${grant.funder_name || 'Not specified'}
**Funding:** $${grant.funding_min?.toLocaleString() || '0'} - $${grant.funding_max?.toLocaleString() || 'No limit'}
**Issue Area:** ${grant.issue_area || 'General'}
**Scope:** ${grant.scope || 'Not specified'}
**Deadline:** ${grant.application_due_date || 'Not specified'}

**Description:** ${grant.description || 'No description'}
**Eligibility:** ${grant.eligibility_criteria || 'Not specified'}
**Required KPIs:** ${grant.kpis?.join(', ') || 'Not specified'}`);

    // Organization profile
    if (userProfile) {
        sections.push(`

## Organization Profile

**Name:** ${userProfile.org_name || 'The Organization'}
**Type:** ${userProfile.org_type || 'Not specified'}
**Founded:** ${userProfile.year_founded || 'Not specified'}
**Team Size:** ${userProfile.team_size || 'Not specified'}

**Mission:**
${userProfile.mission_statement || 'Not provided'}

**Focus Areas:** ${userProfile.issue_areas?.join(', ') || 'Not specified'}
**Geographic Scope:** ${userProfile.geographic_scope?.join(', ') || 'Not specified'}
**Annual Budget:** $${userProfile.annual_budget_min?.toLocaleString() || '0'} - $${userProfile.annual_budget_max?.toLocaleString() || 'Not specified'}`);
    }

    // AI match analysis
    if (grant.matchScore !== undefined) {
        sections.push(`

## AI Match Analysis (${grant.matchScore}%)

${grant.whyMatches && grant.whyMatches.length > 0 ? `**Strengths:**
${grant.whyMatches.map(r => `- ${r}`).join('\n')}` : ''}

${grant.whyDoesNotMatch && grant.whyDoesNotMatch.length > 0 ? `**Considerations:**
${grant.whyDoesNotMatch.map(r => `- ${r}`).join('\n')}` : ''}`);
    }

    // Custom instructions
    if (customInstructions && customInstructions.trim()) {
        sections.push(`

## Additional Instructions

${customInstructions}`);
    }

    // Task instructions
    sections.push(`

---

## Task

Write a **concise fit analysis** (under 800 words) in markdown explaining why this organization is well-suited for this grant.

### Structure:

1. **Executive Summary** (2-3 sentences) - Overall assessment of fit

2. **Alignment with Grant Objectives** - How mission and focus areas align

3. **Organizational Strengths** - Relevant experience, capacity, and expertise

4. **Meeting Requirements** - Eligibility, budget, geographic match

5. **Expected Impact** - Outcomes and KPIs you could deliver

6. **Considerations** - Address any gaps or concerns, explain how to overcome them

### Style:
- Concise and evidence-based
- Professional and persuasive
- Acknowledge both strengths and limitations
- Use specific details from the profiles above

Generate the analysis now (markdown format):`);

    return sections.join('\n');
}

/**
 * Download writeup as text file
 */
export function downloadWriteupAsMarkdown(
    writeup: string,
    grantTitle: string
): void {
    const fileName = `${grantTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_fit_analysis.txt`;

    const blob = new Blob([writeup], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
