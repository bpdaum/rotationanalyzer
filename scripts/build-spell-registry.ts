import fs from 'fs';
import path from 'path';

const GUIDES_DIR = path.join(process.cwd(), 'data', 'guides');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'spell-registry.json');

interface Guide {
    classSlug: string;
    specSlug: string;
    priorityList: string[];
}

function extractSpells(text: string): string[] {
    // Look for patterns like "Cast [Spell]", "Use [Spell]", "[Spell] if...", etc.
    // This is a naive heuristic but good for building a whitelist.
    const spells = new Set<string>();

    // Common patterns in priority lists
    const matches = text.match(/(Cast|Use|Activate|Spend|Channel)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g);
    if (matches) {
        matches.forEach(m => {
            const spell = m.split(/\s+/).slice(1).join(' ').replace(/[,.!]$/, '').trim();
            if (spell.length > 3) spells.add(spell);
        });
    }

    // Also look for things like "Arcane Blast", "Arcane Missiles" as standalone capitalized phrases
    const standalone = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g);
    if (standalone) {
        standalone.forEach(s => {
            if (s.length > 5) spells.add(s.trim());
        });
    }

    return Array.from(spells);
}

function main() {
    const files = fs.readdirSync(GUIDES_DIR).filter(f => f.endsWith('.json') && !f.includes('\\') && !f.includes('/'));
    const registry: Record<string, string[]> = {};

    for (const file of files) {
        const fullPath = path.join(GUIDES_DIR, file);
        try {
            const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as Guide;
            const key = `${data.classSlug}-${data.specSlug}`;

            if (!registry[key]) registry[key] = [];

            data.priorityList.forEach(rule => {
                const spells = extractSpells(rule);
                registry[key] = Array.from(new Set([...registry[key], ...spells]));
            });
        } catch (e) {
            // Skip folders or malformed files
        }
    }

    // Clean up registry - remove common filler words that might have been caught
    const forbidden = ['If', 'When', 'While', 'Your', 'This', 'Every', 'Only', 'Always'];
    for (const key in registry) {
        registry[key] = registry[key].filter(s => !forbidden.includes(s) && s.split(' ').length <= 4);
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(registry, null, 2));
    console.log(`✅ Spell registry built with ${Object.keys(registry).length} spec entries.`);
}

main();
