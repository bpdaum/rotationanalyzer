/**
 * CLI Script: Scrape all DPS guide combinations and write static JSON files.
 *
 * Usage:
 *   npx tsx scripts/scrape-all-guides.ts
 *
 * Options:
 *   --class=mage       Only scrape a specific class
 *   --spec=frost        Only scrape a specific spec (requires --class)
 *   --dry-run          List all combinations without scraping
 */

import fs from 'fs';
import path from 'path';
import { DPS_SPECS, guideKey } from '../src/lib/guide-data';

// We need to import the individual scraper functions, not the combined one,
// since scrapeRotation() uses its own in-memory cache and calls filter.
// Instead, we'll just reuse scrapeRotation which does both + filter.
import { scrapeRotation } from '../src/lib/scraper';

const GUIDES_DIR = path.join(process.cwd(), 'data', 'guides');

interface GuideFile {
    classSlug: string;
    specSlug: string;
    heroSpec: string;
    combatType: string;
    scrapedAt: string;
    priorityList: string[];
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const classFilter = args.find(a => a.startsWith('--class='))?.split('=')[1];
    const specFilter = args.find(a => a.startsWith('--spec='))?.split('=')[1];

    // Build the full list of combos
    const combos: { classSlug: string; specSlug: string; heroSpec: string; combatType: string }[] = [];
    for (const entry of DPS_SPECS) {
        if (classFilter && entry.classSlug !== classFilter) continue;
        if (specFilter && entry.specSlug !== specFilter) continue;

        for (const heroSpec of entry.heroSpecs) {
            for (const combatType of entry.combatTypes) {
                combos.push({
                    classSlug: entry.classSlug,
                    specSlug: entry.specSlug,
                    heroSpec,
                    combatType,
                });
            }
        }
    }

    console.log(`\n🎯 Total combinations to scrape: ${combos.length}`);
    if (classFilter) console.log(`   Filtered by class: ${classFilter}`);
    if (specFilter) console.log(`   Filtered by spec: ${specFilter}`);
    console.log('');

    if (dryRun) {
        console.log('DRY RUN — listing all combinations:\n');
        for (const c of combos) {
            const key = guideKey(c.classSlug, c.specSlug, c.heroSpec, c.combatType);
            console.log(`  ${key}.json`);
        }
        console.log(`\nTotal: ${combos.length} files would be generated.`);
        return;
    }

    // Ensure output directory exists
    fs.mkdirSync(GUIDES_DIR, { recursive: true });

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < combos.length; i++) {
        const c = combos[i];
        const key = guideKey(c.classSlug, c.specSlug, c.heroSpec, c.combatType);
        const progress = `[${i + 1}/${combos.length}]`;

        console.log(`${progress} Scraping ${key}...`);

        try {
            const rotation = await scrapeRotation(c.classSlug, c.specSlug, c.heroSpec, c.combatType);

            const guideFile: GuideFile = {
                classSlug: c.classSlug,
                specSlug: c.specSlug,
                heroSpec: c.heroSpec,
                combatType: c.combatType,
                scrapedAt: new Date().toISOString(),
                priorityList: rotation.priorityList,
            };

            const filePath = path.join(GUIDES_DIR, `${key}.json`);
            fs.writeFileSync(filePath, JSON.stringify(guideFile, null, 2), 'utf-8');

            console.log(`  ✅ ${rotation.priorityList.length} rules → ${key}.json`);
            success++;
        } catch (err: any) {
            console.error(`  ❌ FAILED: ${err.message}`);
            errors.push(`${key}: ${err.message}`);
            failed++;
        }

        // Small delay to be polite to source sites
        if (i < combos.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Success: ${success}  ❌ Failed: ${failed}  Total: ${combos.length}`);
    if (errors.length > 0) {
        console.log('\nErrors:');
        errors.forEach(e => console.log(`  - ${e}`));
    }
    console.log('='.repeat(60) + '\n');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
