import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SUPPORTED_SPECS, getGuidePath } from '../src/lib/guide-data';

const GUIDES_DIR = path.join(process.cwd(), 'data', 'guides');

function getSimCUrl(classSlug: string, specSlug: string, heroSpec: string): string {
    const formattedClass = classSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('_');
    const formattedSpec = specSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('_');
    const formattedHero = heroSpec !== 'None' ? heroSpec.split(/[\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('_') : '';

    // E.g., MID1_Death_Knight_Frost
    const baseUrl = `https://raw.githubusercontent.com/simulationcraft/simc/midnight/profiles/MID1/MID1_${formattedClass}_${formattedSpec}`;
    return baseUrl;
}

async function fetchSimCBase(classSlug: string, specSlug: string): Promise<string> {
    const baseUrl = getSimCUrl(classSlug, specSlug, 'None') + '.simc';
    try {
        const response = await fetch(baseUrl);
        if (response.ok) {
            return await response.text();
        }
    } catch (e) {
        console.error('Failed to fetch', baseUrl, e);
    }
    return '';
}

async function translateAPLWithGemini(rawAPL: string, classSlug: string, specSlug: string, heroSpec: string, combatType: string): Promise<string[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('GEMINI_API_KEY missing, cannot translate');
        return [];
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" }, { apiVersion: 'v1beta' });

    // Extract only 'actions' lines to save tokens
    const actionLines = rawAPL.split('\n')
        .map(l => l.trim())
        .filter(l => l.startsWith('actions=') || l.startsWith('actions+') || l.startsWith('actions.'));
    
    if (actionLines.length === 0) return [];

    const prompt = `You are an expert World of Warcraft theorycrafter mapping a SimulationCraft APL to a human-readable priority list.
Class: ${classSlug}
Spec: ${specSlug}
Hero Specialization: ${heroSpec}
Combat Type: ${combatType}

Here are the RAW SimulationCraft Action Priority List lines:
${actionLines.join('\n').substring(0, 30000)}

Task:
Translate the complex SimulationCraft logic into a simplified, human-executable priority list.
1. COMBAT TYPE FILTERING: If Combat Type is "AoE" or "Cleave", you MUST completely ignore lines from "actions.single_target" or purely single-target logic. If Combat Type is "Single Target", you MUST completely ignore lines from "actions.aoe" or "actions.cleave".
2. ANTI-HALLUCINATION: Do NOT hallucinate legacy abilities (e.g., Frost Mages do NOT use Water Elemental). Only include abilities EXPLICITLY present in the provided APL text.
3. Strip out micro-optimizations (e.g., precise time_to_die checks, complicated pooling logic that a human can't execute perfectly).
4. Prune any information or actions specifically meant for COMPETING hero specializations.
5. Keep the most important "If X, then Y" rules and output a maximum of 15 key rules.

Format your response exactly as a JSON array of strings:
[
  "Rule 1",
  "Rule 2"
]
Return ONLY the JSON array without markdown backticks.`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        return JSON.parse(text);
    } catch (error) {
        console.error('Gemini error:', error);
        return [];
    }
}

async function main() {
    console.log('Starting offline guide generation from SimulationCraft...');

    if (!fs.existsSync(GUIDES_DIR)) {
        fs.mkdirSync(GUIDES_DIR, { recursive: true });
    }

    const SIMC_CACHE: Record<string, string> = {};

    for (const spec of SUPPORTED_SPECS) {
        console.log(`\nFetching base APL for ${spec.classSlug} ${spec.specSlug}...`);
        const cacheKey = `${spec.classSlug}-${spec.specSlug}`;
        
        if (!SIMC_CACHE[cacheKey]) {
            const raw = await fetchSimCBase(spec.classSlug, spec.specSlug);
            if (!raw) {
                console.warn(`!! Could not find APL for ${cacheKey}`);
                continue;
            }
            SIMC_CACHE[cacheKey] = raw;
        }

        const rawAPL = SIMC_CACHE[cacheKey];

        for (const hero of spec.heroSpecs) {
            for (const combatType of spec.combatTypes) {
                console.log(`Translating -> ${hero} / ${combatType}`);
                const rules = await translateAPLWithGemini(rawAPL, spec.classSlug, spec.specSlug, hero, combatType);
                
                if (rules && rules.length > 0) {
                    const relativePath = getGuidePath(spec.classSlug, spec.specSlug, hero, combatType, 'default');
                    const fullPath = path.join(GUIDES_DIR, relativePath);
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    
                    fs.writeFileSync(fullPath, JSON.stringify({
                        classSlug: spec.classSlug,
                        specSlug: spec.specSlug,
                        heroSpec: hero,
                        buildName: 'default',
                        priorityList: rules
                    }, null, 2), 'utf-8');
                    console.log(`  Saved: ${relativePath}`);
                }
                
                // Rate limit
                await new Promise(r => setTimeout(r, 1500));
            }
        }
    }
    console.log('\nUpdates complete!');
}

main().catch(console.error);
