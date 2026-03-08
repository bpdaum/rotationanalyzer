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
    sourceQuote?: string; // Direct quote from the guidelines that justifies this feedback
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
    // Use a clear pipe separator for auras/buffs to ensure prominence
    const conciseTimeline = timeline.map((e, i) => {
        const auras = e.activeAuras.length > 0 ? ` | Buffs: [${e.activeAuras.join(', ')}]` : '';
        return `[${i}] [${e.timestamp}] ${e.spellName}${auras}`;
    }).join('\n');
    const conciseInstructions = rotation.priorityList.map((str, i) => `${i + 1}. ${str}`).join('\n');

    const prompt = `You are a World of Warcraft expert analyst evaluating a player's combat log against optimal target dummy guidelines.
Class: ${rotation.classSlug}
Spec: ${rotation.specSlug}
Hero Specialization: ${heroSpec}

### Optimal Rotation Guidelines / Priorities
${conciseInstructions}

### Player Combat Log (Chronological Casts)
Each line is formatted as: [index] [timestamp] SpellName | Buffs: [Active Aura List]
${conciseTimeline}

### Task: Expert Guide-Based Analysis
Compare the player's chronological casts to the provided optimal rotation guidelines using the provided text as your primary evidence.
Evaluate their opener, their adherence to the priorities, and whether they missed any critical, high-priority abilities mentioned in the guidelines.

CRITICAL INSTRUCTION: TRANSPARENT SPELLS (Off-GCD / Utilities).
- Spells like **Touch of the Magi**, **Presence of Mind**, **Time Warp**, **Arcane Surge**, **Icy Veins**, **Bloodlust**, and Trinkets are "Transparent Spells".
- These spells are typically off the Global Cooldown (GCD) or are utility/setup spells.
- They **DO NOT** break strict "sequence" or "immediately follow" relationships in the guide.
- Example: If a guide says "Cast Arcane Orb immediately after Arcane Barrage", the sequence \`[Barrage] -> [Touch of the Magi] -> [Arcane Orb]\` is **CORRECT** because Touch of the Magi is transparent.

CRITICAL INSTRUCTION: AURA & PROC EQUIVALENCE.
- In the combat log, the "Buffs" section lists active auras.
- If a guide says "Cast X if you have Clearcasting", this is EXACTLY the same as checking if "Clearcasting" is in the [Buffs] list for that cast.
- Always prioritize the provided [Buffs] list over your own assumptions. If "Clearcasting" is in the list, the player HAS the proc.

CRITICAL INSTRUCTION: EVIDENCE-BASED EXPERTISE.
- You are a World of Warcraft expert. You may use your expertise to explain **why** a certain sequence is optimal (e.g., mention interactions like procs, cooldown reduction, or splinter generation) **AS LONG AS** those explanations align with the provided guidelines.
- YOUR FEEDBACK MUST BE GROUNDED IN THE PROVIDED GUIDELINES. You are **REQUIRED** to provide a direct quote from the "Optimal Rotation Guidelines" that supports every piece of feedback.
- However, do **NOT** hallucinate mechanics or spells that are not in the provided guidelines. If the guidelines for ${heroSpec} don't mention a spell, don't penalize the player for not using it.
- Avoid outdated terminology from past expansions.

Provide a JSON object with this exact structure (no markdown fences, just the JSON):
{
  "score": <number between 0 and 100 representing how well they followed the guidelines>,
  "missingSpells": [<array of strings of critical spells they failed to cast entirely>],
  "feedback": [
    {
      "type": "error" | "warning" | "info",
      "timestamp": "<the timestamp from the combat log where the issue occurred, or 00:00 for overall stuff>",
      "message": "<A brief, actionable critique>",
      "spellName": "<The name of the spell being critiqued>",
      "timelineIndex": <the 0-based index from the combat log where this issue occurred, or -1 for overall feedback>,
      "correctSequence": [<optional array showing what the player SHOULD have cast at this moment>],
      "sourceQuote": "<MANDATORY: The exact text from the Guidelines that justifies this feedback.>"
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
