import { CombatEvent } from './parser';
import { ScrapedRotation } from './scraper';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AnalysisFeedback {
    type: 'error' | 'warning' | 'info';
    timestamp: string;
    message: string;
    spellName?: string;
    timelineIndex?: number;
    correctSequence?: string[];
}

export interface AnalysisResult {
    score: number; // 0 to 100
    feedback: AnalysisFeedback[];
    missingSpells: string[];
}

/**
 * Uses Google Gemini API to compare the user's parsed combat log timeline against the scraped priority list instructions.
 */
export async function analyzeRotation(
    timeline: CombatEvent[],
    rotation: ScrapedRotation,
    heroSpec: string = 'None'
): Promise<AnalysisResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is missing.');
    }

    if (timeline.length === 0) {
        return {
            score: 0,
            feedback: [{ type: 'error', timestamp: '00:00', message: 'No SPELL_CAST_SUCCESS events found for player. Did you upload the right log?' }],
            missingSpells: [],
        };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" }, { apiVersion: 'v1beta' });

    // Map the timeline down to something concise to save prompt tokens
    // Include the index so the AI can reference specific casts
    const conciseTimeline = timeline.map((e, i) => `[${i}] [${e.timestamp}] ${e.spellName}`).join('\n');
    const conciseInstructions = rotation.priorityList.map((str, i) => `${i + 1}. ${str}`).join('\n');

    const prompt = `You are a World of Warcraft expert analyst evaluating a player's combat log against optimal target dummy guidelines.
Class: ${rotation.classSlug}
Spec: ${rotation.specSlug}
Hero Specialization: ${heroSpec}

### Optimal Rotation Guidelines / Priorities
${conciseInstructions}

### Player Combat Log (Chronological Casts)
Each line is formatted as: [index] [timestamp] SpellName (Active Auras)
${conciseTimeline}

### Task
Compare the player's chronological casts to the optimal rotation guidelines. 
Evaluate their opener, their adherence to the priorities, and whether they missed any critical, high-priority abilities mentioned in the guidelines.

CRITICAL DATA PRIORITY: The guidelines above come from multiple sources. Sources labeled "Hero-Spec Specific" are filtered specifically for the player's hero specialization (${heroSpec}) and should be treated as the PRIMARY authority. Sources labeled "GENERIC - not filtered by hero spec" may contain rules for OTHER hero specs and MUST be treated with skepticism. If a GENERIC rule mentions a spell that is NOT part of the ${heroSpec} talent tree, IGNORE that rule entirely. Do NOT flag the player for not using spells from other hero specs.
CRITICAL INSTRUCTION: You MUST ONLY evaluate the player against the rules that apply to their specific Hero Specialization (${heroSpec}), plus any base class/spec rules. Ignore rules explicitly meant for other Hero Specs.
CRITICAL INSTRUCTION: Only reference spells that exist in the CURRENT version of World of Warcraft (The War Within, Patch 11.x). Do NOT reference deprecated or removed spells. For example, "Icy Veins" is NOT a Mage spell anymore — it was removed.
CRITICAL INSTRUCTION: Accommodate implicit spell queueing and flight-time mechanics! For example, if a player casts a projectile (like Arcane Barrage) immediately *before* an instant-cast vulnerability debuff (like Touch of the Magi, Arcane Surge, etc.), DO NOT penalize them.

Provide a JSON object with this exact structure (no markdown fences, just the JSON):
{
  "score": <number between 0 and 100 representing how well they followed the guidelines>,
  "missingSpells": [<array of strings of critical spells they failed to cast entirely>],
  "feedback": [
    {
      "type": "error" | "warning" | "info",
      "timestamp": "<the timestamp from the combat log where the issue occurred, or 00:00 for overall stuff>",
      "message": "<A brief, actionable critique>",
      "spellName": "<The name of the spell being critiqued, without aura info. e.g. 'Arcane Blast' not 'Arcane Blast (Active Auras: ...)'>",
      "timelineIndex": <the 0-based index from the combat log where this issue occurred, or -1 for overall feedback>,
      "correctSequence": [<optional array of 2-5 spell names showing what the player SHOULD have cast at this moment, in order. Only include this for errors and warnings where the correct sequence is clear from the guidelines.>]
    }
  ]
}

Return ONLY the raw JSON string. Do not include \`\`\`json wrappers.`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(responseText) as AnalysisResult;
        return parsed;
    } catch (error: any) {
        console.error('Gemini Analysis Error:', error);
        return {
            score: 50,
            feedback: [{
                type: 'error',
                timestamp: '00:00',
                message: `AI Analysis Error: ${error.message || 'Unknown error'}`
            }],
            missingSpells: []
        };
    }
}
