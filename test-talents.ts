import * as cheerio from 'cheerio';

async function checkOptimalSpellslinger() {
    const url = 'https://www.icy-veins.com/wow/arcane-mage-pve-dps-rotation-cooldowns-abilities';
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);

    const heroSpec = 'spellslinger'.toLowerCase();

    let targetPresetStr = '';

    // Look for the curated loadout buttons
    $('[data-preset]').each((_, el) => {
        const text = $(el).text().trim().toLowerCase();
        // Look for the recommended icon inside this button
        const isRecommended = $(el).find('img[alt="recommended"]').length > 0;

        if (text.includes(heroSpec) && isRecommended && !targetPresetStr) {
            targetPresetStr = $(el).attr('data-preset') || '';
        }
    });

    // Fallback if no "recommended" icon is found for the spec
    if (!targetPresetStr) {
        $('[data-preset]').each((_, el) => {
            const text = $(el).text().trim().toLowerCase();
            if (text.includes(heroSpec) && !targetPresetStr) {
                targetPresetStr = $(el).attr('data-preset') || '';
            }
        });
    }

    console.log(`Matched configuration string: ${targetPresetStr}`);

    const configParts = targetPresetStr.split(' ');
    const targetPreset = configParts.find(p => p.startsWith('preset-'));
    const talentsOn = new Set(configParts.filter(p => p.startsWith('talent-')));

    console.log(`Target Preset: ${targetPreset}`);
    console.log(`Talents ON:`, talentsOn);

    const priorityList: string[] = [];

    $('ol > li').each((_, element) => {
        const classStr = $(element).attr('class') || '';

        // Filter out wrong presets
        const isPresetRule = /preset-\d+/.test(classStr);
        if (isPresetRule && targetPreset && !classStr.includes(`${targetPreset}_on`)) {
            return;
        }

        // Filter out wrong talents
        let keepTalent = true;
        const talentMatches = classStr.match(/talent-\d+_(on|off)/g);
        if (talentMatches) {
            for (const token of talentMatches) {
                const isOffRequirement = token.endsWith('_off');
                const talentId = token.replace(/_(on|off)$/, '');

                const isTalentOn = talentsOn.has(talentId);

                if (isOffRequirement && isTalentOn) keepTalent = false;
                if (!isOffRequirement && !isTalentOn) keepTalent = false;
            }
        }

        if (!keepTalent) return;

        priorityList.push($(element).text().trim().replace(/\s+/g, ' '));
    });

    console.log(`\nFiltered down to ${priorityList.length} rules. Top 5:`);
    console.log(priorityList.slice(0, 5));
}

checkOptimalSpellslinger().catch(console.error);
