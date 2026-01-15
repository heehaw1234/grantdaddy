import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error('VITE_GEMINI_API_KEY is not set');
}

export const genAI = new GoogleGenerativeAI(API_KEY);
export const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function generateText(prompt: string) {
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

/**
 * Parsed query structure - designed to be extensible for future filtering needs
 * Add new fields here as your matching requirements grow
 */
export interface ParsedGrantQuery {
  // Core matching criteria
  issueAreas: string[];
  fundingMin: number | null;
  fundingMax: number | null;
  scope: 'local' | 'national' | 'international' | null;

  // Timing preferences
  urgency: 'immediate' | 'soon' | 'flexible' | null;
  deadlineBefore: string | null; // ISO date string

  // Content matching
  keywords: string[];
  organizationType: string | null;

  // Future extensibility fields
  kpiPreferences: string[];
  excludeTerms: string[];

  // Raw query for fallback matching
  originalQuery: string;

  // Confidence score from NLP parsing (0-1)
  parseConfidence: number;
}

/**
 * Schema definition for Gemini - update this when adding new ParsedGrantQuery fields
 * This makes the NLP parsing scalable and maintainable
 */
const QUERY_SCHEMA_PROMPT = `
You are a grant matching assistant. Analyze the user's natural language query and extract structured search criteria.

IMPORTANT: Be generous in interpretation. If the user mentions anything related to a topic, include relevant issue areas.

Issue area mappings (use these exact values when relevant):
- Environment, climate, sustainability, green → "Environment"
- Education, schools, learning, students → "Education"  
- Health, medical, wellness, mental health → "Healthcare"
- Arts, culture, theater, music, creative → "Arts & Culture"
- Community, social services, welfare → "Community Development"
- Youth, children, young people → "Youth Development"
- Elderly, seniors, aging → "Elderly Care"
- Technology, digital, innovation → "Technology"

Scope mappings:
- local, community, neighborhood → "local"
- national, country-wide, Singapore → "national"  
- international, global, overseas → "international"

Urgency mappings:
- urgent, ASAP, immediately, this month → "immediate"
- soon, next few months, upcoming → "soon"
- flexible, no rush, whenever → "flexible"

Return ONLY valid JSON with this exact structure:
{
  "issueAreas": ["array of matched issue areas from the list above"],
  "fundingMin": number or null,
  "fundingMax": number or null,
  "scope": "local" | "national" | "international" | null,
  "urgency": "immediate" | "soon" | "flexible" | null,
  "deadlineBefore": "YYYY-MM-DD" or null,
  "keywords": ["additional relevant keywords not covered by issue areas"],
  "organizationType": "nonprofit" | "charity" | "social enterprise" | null,
  "kpiPreferences": ["any mentioned KPIs or outcomes"],
  "excludeTerms": ["any terms user wants to avoid"],
  "parseConfidence": 0.0 to 1.0 based on how clear the query was
}
`;

/**
 * Parse a natural language grant query using Gemini
 * Designed to be scalable - just update QUERY_SCHEMA_PROMPT and ParsedGrantQuery interface
 */
export async function parseGrantQuery(userQuery: string): Promise<ParsedGrantQuery> {
  const prompt = `${QUERY_SCHEMA_PROMPT}

User query: "${userQuery}"

Respond with ONLY the JSON object, no markdown formatting or explanation.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean up response - remove markdown code blocks if present
    const cleanedText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanedText);

    return {
      issueAreas: parsed.issueAreas || [],
      fundingMin: parsed.fundingMin || null,
      fundingMax: parsed.fundingMax || null,
      scope: parsed.scope || null,
      urgency: parsed.urgency || null,
      deadlineBefore: parsed.deadlineBefore || null,
      keywords: parsed.keywords || [],
      organizationType: parsed.organizationType || null,
      kpiPreferences: parsed.kpiPreferences || [],
      excludeTerms: parsed.excludeTerms || [],
      originalQuery: userQuery,
      parseConfidence: parsed.parseConfidence || 0.5,
    };
  } catch (error) {
    console.error('Failed to parse grant query:', error);
    // Return a fallback with just keywords extracted from the query
    return {
      issueAreas: [],
      fundingMin: null,
      fundingMax: null,
      scope: null,
      urgency: null,
      deadlineBefore: null,
      keywords: userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3),
      organizationType: null,
      kpiPreferences: [],
      excludeTerms: [],
      originalQuery: userQuery,
      parseConfidence: 0.1,
    };
  }
}