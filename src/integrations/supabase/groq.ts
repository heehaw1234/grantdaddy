import Groq from 'groq-sdk';

const API_KEY = import.meta.env.VITE_GROQ_API_KEY;

if (!API_KEY) {
  throw new Error('VITE_GROQ_API_KEY is not set');
}

const groq = new Groq({
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true
});

export async function generateText(prompt: string) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0].message.content || '';
}

export interface ParsedGrantQuery {
  issueAreas: string[];
  fundingMin: number | null;
  fundingMax: number | null;
  scope: 'local' | 'national' | 'international' | null;
  urgency: 'immediate' | 'soon' | 'flexible' | null;
  deadlineBefore: string | null;
  keywords: string[];
  organizationType: string | null;
  kpiPreferences: string[];
  excludeTerms: string[];
  originalQuery: string;
  parseConfidence: number;
}

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

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
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
}`;

export async function parseGrantQuery(userQuery: string): Promise<ParsedGrantQuery> {
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: QUERY_SCHEMA_PROMPT },
        { role: 'user', content: `User query: "${userQuery}"` }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0].message.content || '{}';
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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