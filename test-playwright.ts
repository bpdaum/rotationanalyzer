import { chromium } from 'playwright';

async function extractWowhead() {
    console.log("Starting Chrome...");
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();

        await page.goto('https://www.wowhead.com/guide/classes/mage/arcane/rotation-cooldowns-pve-dps', { waitUntil: 'domcontentloaded' });

        console.log("Waiting for headers...");
        await page.waitForSelector('#tab-rotations-rotation ol', { timeout: 10000 });

        const data = await page.evaluate(() => {
            const rotNodes = Array.from(document.querySelectorAll('#tab-rotations-rotation ol > li:not([data-option-active="false"])'));
            const opnNodes = Array.from(document.querySelectorAll('#tab-rotations-opener-cooldowns ol > li:not([data-option-active="false"])'));

            return {
                rotation: rotNodes.map(li => li.textContent?.replace(/\\s+/g, ' ').trim() || ''),
                opener: opnNodes.map(li => li.textContent?.replace(/\\s+/g, ' ').trim() || '')
            };
        });

        console.log("Rotation:");
        data.rotation.forEach((t, i) => console.log(`${i + 1}. ${t}`));

        console.log("\nOpener:");
        data.opener.forEach((t, i) => console.log(`${i + 1}. ${t}`));

    } finally {
        await browser.close();
    }
}

extractWowhead().catch(console.error);
