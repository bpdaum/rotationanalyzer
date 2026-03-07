import * as cheerio from 'cheerio';

async function testWowhead() {
    const url = 'https://www.wowhead.com/guide/classes/mage/arcane/rotation-cooldowns-pve-dps';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
    const text = await res.text();
    const $ = cheerio.load(text);
    console.log("MARKDOWN: ", $('.markdown').text().substring(0, 200).replace(/\s+/g, ' '));
}

testWowhead().catch(console.error);
