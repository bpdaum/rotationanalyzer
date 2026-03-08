import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

export interface ScrapedRotation {
    classSlug: string;
    specSlug: string;
    priorityList: string[];
}

// In-memory cache for MVP
const cache: Record<string, ScrapedRotation> = {};

// Helper function to resolve the correct URL slug based on the spec's role
function getRoleSuffix(specSlug: string, source: 'icy-veins' | 'wowhead'): string {
    const tanks = ['blood', 'vengeance', 'guardian', 'brewmaster', 'protection'];
    const healers = ['restoration', 'preservation', 'holy', 'discipline', 'mistweaver'];

    if (tanks.includes(specSlug)) {
        return 'pve-tank';
    }
    if (healers.includes(specSlug)) {
        return source === 'icy-veins' ? 'pve-healing' : 'pve-healer';
    }
    return 'pve-dps';
}

async function scrapeWowhead(classSlug: string, specSlug: string, combatType: string = 'Single Target'): Promise<string[]> {
    console.log(`[WoWhead Scraper] Starting for ${specSlug} ${classSlug} (${combatType})...`);
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        const roleSuffix = getRoleSuffix(specSlug, 'wowhead');
        const url = `https://www.wowhead.com/guide/classes/${classSlug}/${specSlug}/rotation-cooldowns-${roleSuffix}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        console.log(`[WoWhead Scraper] Searching for rotation in ${url}`);

        const idsToTry = ['#tab-rotations-rotation'];
        if (combatType.toLowerCase().includes('aoe')) {
            idsToTry.unshift('#tab-rotations-aoe-priority');
        } else {
            idsToTry.unshift('#tab-rotations-single-target-priority');
        }

        const data = await page.evaluate((ids) => {
            const targetId = ids.find(id => document.querySelector(id + ' ol'));
            if (!targetId) return null;

            const rotNodes = Array.from(document.querySelectorAll(`${targetId} > div > div[data-option-active="true"] ol > li:not([data-option-active="false"])`));
            const opnNodes = Array.from(document.querySelectorAll('#tab-rotations-opener > div > div[data-option-active="true"] ol > li:not([data-option-active="false"]), #tab-rotations-opener-cooldowns > div > div[data-option-active="true"] ol > li:not([data-option-active="false"])'));

            const finalRot = rotNodes.length > 0 ? rotNodes : Array.from(document.querySelectorAll(`${targetId} ol > li:not([data-option-active="false"])`));
            const finalOpn = opnNodes.length > 0 ? opnNodes : Array.from(document.querySelectorAll('#tab-rotations-opener ol > li:not([data-option-active="false"]), #tab-rotations-opener-cooldowns ol > li:not([data-option-active="false"])'));

            return {
                rotation: finalRot.map(li => li.textContent?.replace(/\s+/g, ' ').trim() || '').filter(Boolean),
                opener: finalOpn.map(li => li.textContent?.replace(/\s+/g, ' ').trim() || '').filter(Boolean)
            };
        }, idsToTry);

        if (!data) {
            console.warn(`[WoWhead Scraper] No rotation OL found for IDs: ${idsToTry.join(', ')}`);
            return [];
        }

        const priorityList: string[] = [];
        if (data.opener.length > 0) {
            priorityList.push('--- WoWhead Opener (Priority List) ---');
            priorityList.push(...data.opener);
        }
        if (data.rotation.length > 0) {
            priorityList.push('--- WoWhead Rotation (Priority List) ---');
            priorityList.push(...data.rotation);
        }

        return priorityList;
    } catch (error) {
        console.error(`[WoWhead Scraper] Error fetching wowhead for ${specSlug} ${classSlug}:`, error);
        return [];
    } finally {
        if (browser) {
            await browser.close().catch(console.error);
        }
    }
}

async function scrapeIcyVeins(classSlug: string, specSlug: string, heroSpec?: string, combatType: string = 'Single Target'): Promise<string[]> {
    console.log(`[Icy Veins Scraper] Starting for ${specSlug} ${classSlug} (heroSpec=${heroSpec}, combatType=${combatType})...`);
    const roleSuffix = getRoleSuffix(specSlug, 'icy-veins');
    const url = `https://www.icy-veins.com/wow/${specSlug}-${classSlug}-${roleSuffix}-rotation-cooldowns-abilities`;
    const priorityList: string[] = [];

    try {
        const res = await fetch(url, { next: { revalidate: 3600 } });
        if (!res.ok) {
            throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
        }
        const html = await res.text();
        const $ = cheerio.load(html);

        const lowerHero = (heroSpec && heroSpec !== 'None') ? heroSpec.toLowerCase() : '';
        const lowerCombatType = combatType.toLowerCase();

        // ──────────────────────────────────────────────
        // STEP 1: Identify the correct data-preset string for the hero spec + combat type.
        // ──────────────────────────────────────────────
        let targetPresetStr = '';

        if (lowerHero) {
            // Priority 1: hero + combat type + recommended
            $('[data-preset]').each((_, el) => {
                const text = $(el).text().trim().toLowerCase();
                const isRecommended = $(el).find('img[alt="recommended"]').length > 0;
                if (text.includes(lowerHero) && text.includes(lowerCombatType) && isRecommended && !targetPresetStr) {
                    targetPresetStr = $(el).attr('data-preset') || '';
                }
            });
            // Priority 2: hero + recommended
            if (!targetPresetStr) {
                $('[data-preset]').each((_, el) => {
                    const text = $(el).text().trim().toLowerCase();
                    const isRecommended = $(el).find('img[alt="recommended"]').length > 0;
                    if (text.includes(lowerHero) && isRecommended && !targetPresetStr) {
                        targetPresetStr = $(el).attr('data-preset') || '';
                    }
                });
            }
            // Priority 3: hero + combat type
            if (!targetPresetStr) {
                $('[data-preset]').each((_, el) => {
                    const text = $(el).text().trim().toLowerCase();
                    if (text.includes(lowerHero) && text.includes(lowerCombatType) && !targetPresetStr) {
                        targetPresetStr = $(el).attr('data-preset') || '';
                    }
                });
            }
            // Priority 4: hero only
            if (!targetPresetStr) {
                $('[data-preset]').each((_, el) => {
                    const text = $(el).text().trim().toLowerCase();
                    if (text.includes(lowerHero) && !targetPresetStr) {
                        targetPresetStr = $(el).attr('data-preset') || '';
                    }
                });
            }
        }

        const configParts = targetPresetStr.split(' ').filter(Boolean);
        const targetPreset = configParts.find(p => p.startsWith('preset-'));
        const activeTalents = new Set(configParts.filter(p => p.startsWith('talent-')));

        console.log(`[Icy Veins] Matched preset: "${targetPreset}", talents: [${[...activeTalents].join(', ')}]`);

        // ──────────────────────────────────────────────
        // STEP 2: Section-based filtering.
        // Icy Veins has rotation sections inside rotation_tool_block_N containers.
        // Each block has a corresponding _button element. The prev sibling of the _button
        // is a clean heading like "Spellslinger Single Target Rotation".
        // We use these headings to identify which blocks belong to which hero spec + combat type.
        // ──────────────────────────────────────────────
        let targetBlockIds: string[] = [];

        if (lowerHero) {
            // Strategy 1: Use _button prev sibling headings (most reliable source)
            $('[id^="rotation_tool_block_"][id$="_button"]').each((_, el) => {
                const buttonId = $(el).attr('id') || '';
                const blockId = buttonId.replace('_button', '');

                // Skip blocks with no list items
                if ($(`#${blockId} ol > li`).length === 0) return;

                const prevSibling = $(el).prev();
                const headingText = prevSibling.text().trim().toLowerCase();

                if (headingText.includes(lowerHero) && headingText.includes(lowerCombatType)) {
                    targetBlockIds.push(blockId);
                    console.log(`[Icy Veins] Section match: "${blockId}" heading="${headingText.substring(0, 80)}"`);
                }
            });

            // Strategy 2: hero spec only (without combat type)
            if (targetBlockIds.length === 0) {
                $('[id^="rotation_tool_block_"][id$="_button"]').each((_, el) => {
                    const buttonId = $(el).attr('id') || '';
                    const blockId = buttonId.replace('_button', '');
                    if ($(`#${blockId} ol > li`).length === 0) return;

                    const prevSibling = $(el).prev();
                    const headingText = prevSibling.text().trim().toLowerCase();

                    if (headingText.includes(lowerHero)) {
                        targetBlockIds.push(blockId);
                        console.log(`[Icy Veins] Section fallback: "${blockId}" heading="${headingText.substring(0, 80)}"`);
                    }
                });
            }

            // Strategy 3: Check block prev siblings directly (for pages without _button elements)
            if (targetBlockIds.length === 0) {
                $('[id^="rotation_tool_block_"]').each((_, el) => {
                    const id = $(el).attr('id') || '';
                    if (id.includes('_button')) return;
                    if ($(el).find('ol > li').length === 0) return;

                    const prevSibling = $(el).prev();
                    const prevText = prevSibling.text().trim().toLowerCase();

                    if (prevText.includes(lowerHero) && prevText.includes(lowerCombatType)) {
                        targetBlockIds.push(id);
                        console.log(`[Icy Veins] Section block-prev match: "${id}" prev="${prevText.substring(0, 80)}"`);
                    }
                });
            }
        }

        // ──────────────────────────────────────────────
        // STEP 3: Extract <li> elements.
        // If we matched specific sections, only pull from those.
        // Otherwise, fall back to global li scan with preset/talent class filtering.
        // ──────────────────────────────────────────────
        if (targetBlockIds.length > 0) {
            console.log(`[Icy Veins] Scraping from sections: ${targetBlockIds.join(', ')}`);

            for (const blockId of targetBlockIds) {
                $(`#${blockId} ol > li`).each((_, element) => {
                    const classStr = $(element).attr('class') || '';

                    // Apply talent filtering within the section
                    let keepTalent = true;
                    const talentMatches = classStr.match(/talent-\d+_(on|off)/g);
                    if (talentMatches && activeTalents.size > 0) {
                        for (const token of talentMatches) {
                            const isOffReq = token.endsWith('_off');
                            const talentId = token.replace(/_(on|off)$/, '');
                            const isTalentActive = activeTalents.has(talentId);
                            if (isOffReq && isTalentActive) keepTalent = false;
                            if (!isOffReq && !isTalentActive) keepTalent = false;
                        }
                    }

                    if (!keepTalent) return;

                    const text = $(element).text().trim().replace(/\s+/g, ' ');
                    if (text.length > 10 && text.length < 300) {
                        priorityList.push(text);
                    }
                });
            }
        } else {
            // Fallback: no section match found. Use old global li scan with preset/talent filtering.
            console.log(`[Icy Veins] No section match, using global li scan with preset/talent filtering`);

            $('ol > li').each((_, element) => {
                const classStr = $(element).attr('class') || '';
                const isPresetRule = /preset-\d+/.test(classStr);
                if (isPresetRule && targetPreset && !classStr.includes(`${targetPreset}_on`)) {
                    return;
                }

                let keepTalent = true;
                const talentMatches = classStr.match(/talent-\d+_(on|off)/g);
                if (talentMatches) {
                    for (const token of talentMatches) {
                        const isOffReq = token.endsWith('_off');
                        const talentId = token.replace(/_(on|off)$/, '');
                        const isTalentActive = activeTalents.has(talentId);
                        if (isOffReq && isTalentActive) keepTalent = false;
                        if (!isOffReq && !isTalentActive) keepTalent = false;
                    }
                }

                if (!keepTalent) return;

                const text = $(element).text().trim().replace(/\s+/g, ' ');
                if (text.length > 10 && text.length < 300) {
                    priorityList.push(text);
                }
            });
        }

        const uniqueIcy = Array.from(new Set(priorityList));
        if (uniqueIcy.length > 0) {
            return ['--- Icy Veins Rotation (Priority List) ---', ...uniqueIcy];
        }
    } catch (error) {
        console.error('Icy Veins Scraping error:', error);
    }

    return priorityList;
}

/**
 * Scrapes Icy Veins & WoWhead for the given WoW class and spec.
 * Merges the Priority Lists into a single array for Gemini Context.
 */
export async function scrapeRotation(classSlug: string, specSlug: string, heroSpec?: string, combatType: string = 'Single Target'): Promise<ScrapedRotation> {
    const hk = heroSpec ? `-${heroSpec.toLowerCase()}` : '';
    const ck = combatType ? `-${combatType.toLowerCase().replace(/\s+/g, '-')}` : '';
    const cacheKey = `${classSlug}-${specSlug}${hk}${ck}-v3`;
    if (cache[cacheKey]) {
        return cache[cacheKey];
    }

    const [icyVeinsRules, wowheadRules] = await Promise.all([
        scrapeIcyVeins(classSlug, specSlug, heroSpec, combatType),
        scrapeWowhead(classSlug, specSlug, combatType)
    ]);

    const combinedList = [...icyVeinsRules, ...wowheadRules];

    if (combinedList.length === 0) {
        combinedList.push('Follow standard builder-spender rotation priorities (Scrapers returned 0 data).');
    }

    const result = {
        classSlug,
        specSlug,
        priorityList: combinedList
    };

    cache[cacheKey] = result;
    return result;
}
