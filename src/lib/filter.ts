import { GoogleGenerativeAI } from '@google/generative-ai';

export async function filterScrapedRules(
    rules: string[],
    classSlug: string,
    specSlug: string,
    heroSpec: string,
    combatType: string = 'Single Target'
): Promise<string[]> {
    if (!heroSpec || heroSpec === 'None') {
        return rules;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('GEMINI_API_KEY missing, skipping preliminary filter');
        return rules;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" }, { apiVersion: 'v1beta' });

    const rulesText = rules.map((r, i) => `[${i}] ${r}`).join('\n');

    const prompt = `You are an expert World of Warcraft theorycrafter. You are given a list of raw scraped priority rules for a ${specSlug} ${classSlug}.
The player is playing the **${heroSpec}** Hero Specialization.
The combat profile is **${combatType}**.

Your task:
Review the following numbered list of rules and identify any rule that is INVALID for this specific combination of Hero Spec and Combat Type.
Return a JSON array containing ONLY the indices of the rules that should be KEPT.

CRITICAL PRUNING INSTRUCTIONS:
34. **Hero Spec Exclusion**: If a rule mentions a mechanic, buff, or spell that belongs STRICTLY to a COMPETING hero specialization, REMOVE IT. (e.g., if Spellslinger, remove 'Arcane Soul' or 'Sunfury' rules).
35. **Combat Type Exclusion**: If the combat profile is **Single Target**, remove rules that are strictly for AoE (Area of Effect), Cleave, or Multi-target situations (e.g., 'Cast Blizzard' or 'Cast Flamestrike' should usually be removed from a Single Target list for Frost/Fire mages unless specifically required for a ST mechanic).
    - **NOTE for Devourer Demon Hunter**: 'Voidblade' or 'Void Blade' is strictly SINGLE TARGET. If the combat profile is **AoE**, remove any rule mentioning 'Voidblade' or 'Void Blade'.
36. **Generic Rules**: If a rule is generic and applies correctly to the base spec/class within the current ${combatType} profile, KEEP IT.
37. **Hero Spec Specifics**: If a rule explicitly belongs to ${heroSpec}, KEEP IT.
38. **Doubt**: If you are unsure, default to KEEPING the rule. DO NOT remove a rule unless you are 100% certain it is irrelevant for this ${heroSpec} / ${combatType} combination.

Raw Scraped Rules:
${rulesText}

Return ONLY a stringified JSON array of integers representing the indices of the rules to keep. (e.g. [0, 1, 3, 4, 7]). Do not wrap in markdown \`\`\`json blocks.`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const keepIndices = JSON.parse(responseText) as number[];

        return rules.filter((_, i) => keepIndices.includes(i));
    } catch (error) {
        console.error('Gemini Filter Error:', error);
        return rules; // Fallback to unfiltered if it fails
    }
}
