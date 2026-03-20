import { CombatEvent } from './parser';
import { ScrapedRotation } from './guide-data';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AnalysisFeedback {
    type: 'error' | 'warning' | 'info' | 'good';
    timestamp: string;
    message: string;
    spellName?: string;
    timelineIndex?: number;
    correctSequence?: string[];
    sourceQuote?: string; // Direct quote from the guidelines that justifies this feedback
}

export interface AnalysisResult {
    score: number; // 0 to 100
    tldr: string;
    feedback: AnalysisFeedback[];
    missingSpells: string[];
}

const SPEC_MECHANICS: Record<string, string[]> = {
    'devourer': [
        "Void Metamorphosis requires 50 Souls. Do NOT suggest casting it unless the player has enough Soul Fragments/Souls.",
        "Cull is only castable while in Void Metamorphosis. If Void Metamorphosis is not active (check buffs), casting Cull is an error.",
        "Void Metamorphosis is active when the 'Void Metamorphosis' buff is present in the Buffs list.",
    ]
};

/**
 * Uses Google Gemini API to compare the user's parsed combat log timeline against the scraped priority list instructions.
 */
export async function analyzeRotation(
    timeline: CombatEvent[],
    rotation: ScrapedRotation,
    heroSpec: string = 'None',
    activeTalents: string[] | null = null
): Promise<AnalysisResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is missing.');
    }

    if (timeline.length === 0) {
        return {
            score: 0,
            tldr: 'No combat events found in this log.',
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

    const prompt = `You are a world-first raider and expert World of Warcraft analyst evaluating a player's combat log against optimal target dummy guidelines.
Class: ${rotation.classSlug}
Spec: ${rotation.specSlug}
Hero Specialization: ${heroSpec}

### Optimal Rotation Guidelines / Priorities
${conciseInstructions}

${SPEC_MECHANICS[rotation.specSlug] ? `### Specialization-Specific Mechanical Knowledge\n${SPEC_MECHANICS[rotation.specSlug].map(m => `- ${m}`).join('\n')}\n` : ''}
${activeTalents && activeTalents.length > 0 ? `### Active Talents\nThe player has the following active talents equipped: [${activeTalents.join(', ')}]. \nCRITICAL INSTRUCTION: If a priority rule requires a spell or talent they DO NOT have equipped, IGNORE that rule completely and do not penalize them for it.` : ''}

### Player Combat Log (Chronological Casts)
Each line is formatted as: [index] [timestamp] SpellName | Buffs: [Active Aura List]
${conciseTimeline}

### Task: Expert Guide-Based Analysis
As a world-first raider, your mindset is about perfection and fundamental concepts like "Always Be Casting" (ABC). 
Compare the player's chronological casts to the provided optimal rotation guidelines using the provided text as your primary evidence.

CRITICAL INSTRUCTION: HIERARCHY OF TRUTH.
- The SimulationCraft APL lines (starting with '--- SimulationCraft APL ---') are the MOST MATHEMATICALLY ACCURATE guidelines.
- The Icy Veins and WoWhead sections are "General" rules for humans. 
- If a general rule (e.g. "Always spend Clearcasting at 2 stacks") conflicts with a specific SimulationCraft rule (e.g. "Barrage if Salvo >= 20"), YOU MUST FOLLOW THE SIMC RULE. 
- Do NOT penalize a player for violating a general rule if they were following a more specific SimulationCraft priority line.

CRITICAL INSTRUCTION: SimC VARIABLE TRANSLATION.
- \`talent.some_talent_name\`: Evaluates as true if "Some Talent Name" (case-insensitive, ignore punctuation) is in the player's Active Talents list.
- \`buff.some_buff.up\` or \`buff.some_buff.react\`: Evaluates as true if that buff is in the [Buffs] list in the combat log.
- \`buff.clearcasting.react\`: Refers to the number of 'Clearcasting' stacks.
- \`buff.arcane_salvo.react\`: Refers to 'Arcane Salvo' stacks (specific to Spellslinger).
- \`buff.arcane_charge.stack\`: Refers to the number of Arcane Charges.

CRITICAL INSTRUCTION: EVIDENCE-BASED EXPERTISE.
- You must explain WHY a sequence is optimal (procs, resource generation), but YOUR FEEDBACK MUST BE MAJORLY GROUNDED IN THE PROVIDED GUIDELINES.
- You are REQUIRED to provide a direct quote from the "Optimal Rotation Guidelines" that supports every piece of feedback.
- Do NOT hallucinate mechanics or spells not in the guidelines.

Provide a JSON object with this exact structure (no markdown fences, just the JSON):
{
  "score": <number between 0 and 100 representing how well they followed the guidelines>,
  "tldr": "<World-first raider summary of their performance and the #1 thing to work on>",
  "missingSpells": [<array of strings of critical spells they failed to cast entirely>],
  "feedback": [
    {
      "type": "error" | "warning" | "info" | "good",
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
            tldr: 'Analysis failed due to an error.',
            feedback: [{
                type: 'error',
                timestamp: '00:00',
                message: `AI Analysis Error: ${error.message || 'Unknown error'}`
            }],
            missingSpells: []
        };
    }
}
