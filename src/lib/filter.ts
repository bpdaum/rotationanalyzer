import { GoogleGenerativeAI } from '@google/generative-ai';

export async function filterScrapedRules(
    rules: string[],
    classSlug: string,
    specSlug: string,
    heroSpec: string
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
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' }, { apiVersion: 'v1beta' });

    const rulesText = rules.map((r, i) => `[${i}] ${r}`).join('\n');

    const prompt = `You are an expert World of Warcraft theorycrafter. You are given a list of raw scraped priority rules for a ${specSlug} ${classSlug}.
The player is playing the **${heroSpec}** Hero Specialization.

Unfortunately, the scraper often leaks rules that are EXCLUSIVE to competing hero specializations. 
For example, for an Arcane Mage, if the player is 'Spellslinger', any rule mentioning 'Arcane Soul' or 'Sunfury' is invalid and must be removed. If the player is 'Sunfury', rules about 'Splinters' or 'Spellslinger' must be removed.

Your task:
Review the following numbered list of rules. Identify any rule that explicitly relies on or mentions a mechanic, buff, or spell that belongs STRICTLY to a HERO SPECIALIZATION OTHER THAN ${heroSpec}.
Return a JSON array containing ONLY the indices of the rules that should be KEPT.

CRITICAL INSTRUCTIONS:
1. If a rule is completely generic or applies to the base spec/class, KEEP IT.
2. If a rule explicitly belongs to ${heroSpec}, KEEP IT.
3. If a rule clearly belongs to a DIFFERENT hero specialization (e.g. mentions a specific talent of a competing hero tree), DO NOT keep it.
4. If you are unsure, default to KEEPING the rule. DO NOT remove a rule unless you are 100% certain it belongs to a competing hero specialization.

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
