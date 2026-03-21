import fs from 'fs';
import path from 'path';

const GUIDES_DIR = path.join(process.cwd(), 'data', 'guides');

interface Guide {
    classSlug: string;
    specSlug: string;
    heroSpec: string;
    buildName: string;
    priorityList: string[];
}

// Known deprecated/removed abilities that should NEVER appear in guides
const DEPRECATED_SPELLS = [
    'Water Elemental',
    'Summon Water Elemental',
    'Rune of Power',
    'Mirror Image',
    'Pyretic Incantation',
    'Nether Tempest',
    'Living Bomb',
    'Searing Touch',
    'Kindling',
    'Conflagration',
    // General deprecated terms
    'Azerite',
    'Covenant',
    'Soulbind',
    'Conduit',
    'Legendary',
    'Shadowlands',
    'Dragonflight',
];

// Walk the nested directory structure to find all guide JSONs
function findGuideFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findGuideFiles(fullPath));
        } else if (entry.name.endsWith('.json')) {
            results.push(fullPath);
        }
    }
    return results;
}

function validateGuide(filePath: string): string[] {
    const issues: string[] = [];
    const relativePath = path.relative(GUIDES_DIR, filePath);

    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const guide: Guide = JSON.parse(raw);

        if (!guide.priorityList || guide.priorityList.length === 0) {
            issues.push(`[${relativePath}] EMPTY: No priority rules found.`);
            return issues;
        }

        // Check for deprecated spells
        for (const rule of guide.priorityList) {
            for (const deprecated of DEPRECATED_SPELLS) {
                if (rule.toLowerCase().includes(deprecated.toLowerCase())) {
                    issues.push(`[${relativePath}] DEPRECATED SPELL: "${deprecated}" found in rule: "${rule.substring(0, 80)}..."`);
                }
            }
        }

        // Check for suspiciously short rules (likely malformed)
        for (const rule of guide.priorityList) {
            if (rule.length < 10) {
                issues.push(`[${relativePath}] SUSPICIOUS: Very short rule: "${rule}"`);
            }
        }

        // Check for duplicate rules
        const seen = new Set<string>();
        for (const rule of guide.priorityList) {
            const normalized = rule.toLowerCase().trim();
            if (seen.has(normalized)) {
                issues.push(`[${relativePath}] DUPLICATE: "${rule.substring(0, 60)}..."`);
            }
            seen.add(normalized);
        }

    } catch (e: any) {
        issues.push(`[${relativePath}] PARSE ERROR: ${e.message}`);
    }

    return issues;
}

function main() {
    console.log('Validating all guides in data/guides/...\n');

    if (!fs.existsSync(GUIDES_DIR)) {
        console.error('Guides directory not found!');
        process.exit(1);
    }

    const files = findGuideFiles(GUIDES_DIR);
    console.log(`Found ${files.length} guide files.\n`);

    let totalIssues = 0;
    let filesWithIssues = 0;

    for (const file of files) {
        const issues = validateGuide(file);
        if (issues.length > 0) {
            filesWithIssues++;
            totalIssues += issues.length;
            issues.forEach(i => console.warn(`  ⚠️  ${i}`));
        }
    }

    console.log(`\n${'─'.repeat(60)}`);
    if (totalIssues === 0) {
        console.log('✅ All guides passed validation!');
    } else {
        console.log(`⚠️  Found ${totalIssues} issue(s) across ${filesWithIssues} file(s).`);
    }
}

main();
