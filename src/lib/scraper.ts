import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import { filterScrapedRules } from './filter';

export interface ScrapedRotation {
    classSlug: string;
    specSlug: string;
    priorityList: string[];
}

// In-memory cache for MVP
const cache: Record<string, ScrapedRotation> = {};

function scrubRules(rules: string[]): string[] {
    // Always remove "Icy Veins" keyword if it's being used as a spell name (it's removed in TWW)
    // unless it's clearly talking about the website or a specific buff that still exists.
    // But typically "Cast Icy Veins" is what we want to catch.
    const universalForbidden = ['cast icy veins', 'activate icy veins', 'use icy veins'];

    return rules.filter(rule => {
        const lowerRule = rule.toLowerCase();

        // Remove universal forbidden patterns
        if (universalForbidden.some(f => lowerRule.includes(f))) return false;

        return true;
    });
}

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

async function scrapeWowhead(classSlug: string, specSlug: string, heroSpec?: string, combatType: string = 'Single Target'): Promise<string[]> {
    console.log(`[WoWhead Scraper] Starting for ${specSlug} ${classSlug} (heroSpec=${heroSpec}, combatType=${combatType})...`);
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        const roleSuffix = getRoleSuffix(specSlug, 'wowhead');
        const url = `https://www.wowhead.com/guide/classes/${classSlug}/${specSlug}/rotation-cooldowns-${roleSuffix}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        console.log(`[WoWhead Scraper] Searching for rotation in ${url}`);

        // Try to click the correct hero spec tab if one exists
        const lowerHero = (heroSpec && heroSpec !== 'None') ? heroSpec.toLowerCase() : '';
        let heroSpecFiltered = false;

        if (lowerHero) {
            heroSpecFiltered = await page.evaluate((hero) => {
                // Look for option tabs that mention the hero spec
                const allOptions = document.querySelectorAll('[data-option]');
                for (const opt of Array.from(allOptions)) {
                    const text = (opt.textContent?.trim() || '').toLowerCase();
                    if (text.includes(hero) && opt instanceof HTMLElement) {
                        opt.click();
                        return true;
                    }
                }
                // Also check for tab-like buttons
                const buttons = document.querySelectorAll('button, [role="tab"], .tab, .option');
                for (const btn of Array.from(buttons)) {
                    const text = (btn.textContent?.trim() || '').toLowerCase();
                    if (text.includes(hero) && btn instanceof HTMLElement) {
                        btn.click();
                        return true;
                    }
                }
                return false;
            }, lowerHero);

            if (heroSpecFiltered) {
                console.log(`[WoWhead Scraper] Clicked hero spec tab for "${heroSpec}"`);
                await page.waitForTimeout(1000);
            } else {
                console.log(`[WoWhead Scraper] No hero spec tab found for "${heroSpec}" — data will be generic/unfiltered`);
            }
        }

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
        // Label as unfiltered if we couldn't select the hero spec
        const label = heroSpecFiltered
            ? `--- WoWhead ${heroSpec} Rotation ---`
            : `--- WoWhead Rotation (GENERIC - not filtered by hero spec, may contain irrelevant rules) ---`;

        if (data.opener.length > 0) {
            const openerLabel = heroSpecFiltered
                ? `--- WoWhead ${heroSpec} Opener ---`
                : `--- WoWhead Opener (GENERIC - not filtered by hero spec) ---`;
            priorityList.push(openerLabel);
            priorityList.push(...data.opener);
        }
        if (data.rotation.length > 0) {
            priorityList.push(label);
            priorityList.push(...data.rotation);
        }

        return scrubRules(priorityList);
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
            $('[data-preset]').each((_, el) => {
                const text = $(el).text().trim().toLowerCase();
                const isRecommended = $(el).find('img[alt="recommended"]').length > 0;
                if (text.includes(lowerHero) && text.includes(lowerCombatType) && isRecommended && !targetPresetStr) {
                    targetPresetStr = $(el).attr('data-preset') || '';
                }
            });
            if (!targetPresetStr) {
                $('[data-preset]').each((_, el) => {
                    const text = $(el).text().trim().toLowerCase();
                    const isRecommended = $(el).find('img[alt="recommended"]').length > 0;
                    if (text.includes(lowerHero) && isRecommended && !targetPresetStr) {
                        targetPresetStr = $(el).attr('data-preset') || '';
                    }
                });
            }
            if (!targetPresetStr) {
                $('[data-preset]').each((_, el) => {
                    const text = $(el).text().trim().toLowerCase();
                    if (text.includes(lowerHero) && text.includes(lowerCombatType) && !targetPresetStr) {
                        targetPresetStr = $(el).attr('data-preset') || '';
                    }
                });
            }
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
        // STEP 2: Section-based filtering via _button headings.
        // ──────────────────────────────────────────────
        let targetBlockIds: string[] = [];

        if (lowerHero) {
            // Strategy 1: _button prev sibling headings (most reliable)
            $('[id^="rotation_tool_block_"][id$="_button"]').each((_, el) => {
                const buttonId = $(el).attr('id') || '';
                const blockId = buttonId.replace('_button', '');
                if ($(`#${blockId} ol > li`).length === 0) return;

                const prevSibling = $(el).prev();
                const headingText = prevSibling.text().trim().toLowerCase();

                if (headingText.includes(lowerHero) && headingText.includes(lowerCombatType)) {
                    targetBlockIds.push(blockId);
                    console.log(`[Icy Veins] Section match: "${blockId}" heading="${headingText.substring(0, 80)}"`);
                }
            });

            // Strategy 2: hero spec only
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

            // Strategy 3: block prev siblings directly
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
        // STEP 3: Extract <li> elements from matched sections or fall back to global scan.
        // ──────────────────────────────────────────────
        if (targetBlockIds.length > 0) {
            console.log(`[Icy Veins] Scraping from sections: ${targetBlockIds.join(', ')}`);

            for (const blockId of targetBlockIds) {
                $(`#${blockId} ol > li`).each((_, element) => {
                    const classStr = $(element).attr('class') || '';

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

        const uniqueIcy = scrubRules(Array.from(new Set(priorityList)));
        if (uniqueIcy.length > 0) {
            // Label as hero-spec-specific when we matched a section
            const label = targetBlockIds.length > 0
                ? `--- Icy Veins ${heroSpec || ''} Rotation (Hero-Spec Specific) ---`
                : `--- Icy Veins Rotation (Priority List) ---`;
            return [label, ...uniqueIcy];
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
    const cacheKey = `${classSlug}-${specSlug}${hk}${ck}-v4`;
    if (cache[cacheKey]) {
        return cache[cacheKey];
    }

    const [icyVeinsRules, wowheadRules] = await Promise.all([
        scrapeIcyVeins(classSlug, specSlug, heroSpec, combatType),
        scrapeWowhead(classSlug, specSlug, heroSpec, combatType)
    ]);

    const combinedList = [...icyVeinsRules, ...wowheadRules];

    if (combinedList.length === 0) {
        combinedList.push('Follow standard builder-spender rotation priorities (Scrapers returned 0 data).');
    }

    const filteredList = await filterScrapedRules(combinedList, classSlug, specSlug, heroSpec || 'None');

    const result = {
        classSlug,
        specSlug,
        priorityList: filteredList
    };

    cache[cacheKey] = result;
    return result;
}
