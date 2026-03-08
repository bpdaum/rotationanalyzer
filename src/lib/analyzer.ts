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

### Task: Zero-Knowledge Literal Extraction
Compare the player's chronological casts to the provided optimal rotation guidelines using **ONLY** the provided text.
Evaluate their opener, their adherence to the priorities, and whether they missed any critical, high-priority abilities mentioned in the guidelines.

CRITICAL INSTRUCTION: ZERO-KNOWLEDGE MODE.
- **IGNORE everything you know about World of Warcraft.** Act as if you have never heard of the game before this moment.
- You are a literal text-matching engine. If a mechanic, spell interaction, or term is not explicitly defined in the "Optimal Rotation Guidelines", it **DOES NOT EXIST**.
- **VERBOTEN TERMINOLOGY:** Never use the following terms unless they appear in the guidelines: "Shatter", "Procs", "Winter's Chill", "Fingers of Frost", "Brain Freeze", "Global Cooldown (GCD)", "Uptime". 
- If you use a term not in the guidelines, the analysis is invalid.

CRITICAL FEEDBACK GROUNDING:
- Every piece of feedback MUST cite the rule number it is following from the "Optimal Rotation Guidelines" (e.g., "Rule #4 says cast X, but you cast Y").
- If the Guidelines don't explain WHY a spell is cast, do NOT invent an explanation. Stick to: "Rule #X requires Y at this point."

CRITICAL DATA PRIORITY:
- Guidelines labeled "Hero-Spec Specific" are the absolute source of truth.
- Guidelines labeled "GENERIC" are supplemental; if a GENERIC rule contradicts or introduces a spell not in the Hero-Spec Specific list, **DISCARD IT**.

CRITICAL INSTRUCTION: INTERPOLATION PROHIBITED.
- Do NOT hallucinate mechanics.
- ONLY reference spells that exist in the CURRENT guidelines provided.
- Accommodate implicit spell queueing and flight-time mechanics as previously defined.

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
