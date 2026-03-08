import { scrapeRotation } from './src/lib/scraper';

async function debugMage() {
    console.log('=== Scrape Debug: Frost Mage Spellslinger ST ===');
    const result = await scrapeRotation('mage', 'frost', 'Spellslinger', 'Single Target');

    const rules = result.priorityList;
    console.log(`Total rules: ${rules.length}\n`);

    const keywords = ['blizzard', 'shatter', 'comet storm', 'icy veins'];

    rules.forEach((rule, i) => {
        const lower = rule.toLowerCase();
        const found = keywords.filter(k => lower.includes(k));
        if (found.length > 0) {
            console.log(`[RULE ${i + 1}] (CONTAINS: ${found.join(', ')}) -> "${rule}"`);
        }
    });

    console.log('\n=== Full Rule List ===');
    rules.forEach((r, i) => console.log(`${i + 1}. ${r}`));
}

debugMage().catch(console.error);
