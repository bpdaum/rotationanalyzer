import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto('https://www.wowhead.com/guide/classes/demon-hunter/vengeance/rotation-cooldowns-pve-tank', { waitUntil: 'domcontentloaded' });

        const ids = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('[id]'))
                .map(el => el.id)
                .filter(id => id.includes('rotation') || id.includes('priority') || id.includes('opener'));
        });

        console.log("Found IDs:", ids);
    } finally {
        await browser.close();
    }
}
run();
