import { scrapeRotation } from './src/lib/scraper';

async function run() {
    console.log("Scraping rotation...");
    const result = await scrapeRotation('demon-hunter', 'vengeance', 'Fel-Scarred', 'Single Target');
    console.log("Done!");
    console.log(`Class: ${result.classSlug}`);
    console.log(`Spec: ${result.specSlug}`);
    console.log(`Rules: ${result.priorityList.length}`);
    result.priorityList.forEach((r, i) => console.log(`${i + 1}. ${r.substring(0, 100)}`));
}

run().catch(console.error);
