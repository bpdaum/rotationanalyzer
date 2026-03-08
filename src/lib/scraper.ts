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
    }).map(rule => {
        // Fix typos
        let fixed = rule;
        fixed = fixed.replace(/Feral Frenzy/g, 'Frantic Frenzy');
        return fixed;
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

    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        const html = await page.content();
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
            $('[id^="rotation_tool_block_"][id$="_button"]').each((_, el) => {
                const buttonId = $(el).attr('id') || '';
                const blockId = buttonId.replace('_button', '');
                const prevSibling = $(el).prev();
                const headingText = prevSibling.text().trim().toLowerCase();

                if (headingText.includes(lowerHero) && headingText.includes(lowerCombatType)) {
                    targetBlockIds.push(blockId);
                    console.log(`[Icy Veins] Section match: "${blockId}" heading="${headingText.substring(0, 80)}"`);
                }
            });
        }

        // ──────────────────────────────────────────────
        // Strategy 4: Fallback for NEW Midnight-style pages (no tool block, just classes)
        // ──────────────────────────────────────────────
        if (targetBlockIds.length === 0) {
            const lowerHeroCompact = lowerHero.replace(/[-\s]/g, '');
            const midnightClass = lowerHero ? `rotation_line_${lowerHero.replace(/\s+/g, '-')}_on` : '';
            const midnightClassCompact = lowerHeroCompact ? `rotation_line_${lowerHeroCompact}_on` : '';

            console.log(`[Icy Veins] Strategy 4 (Midnight) starting. Searching for classes: .${midnightClass} or .${midnightClassCompact}`);

            $('ul > li, ol > li').each((_, el) => {
                const element = $(el);
                const classStr = (element.attr('class') || '').toLowerCase();

                const isSpecLine = lowerHero && (classStr.includes(midnightClass) || classStr.includes(midnightClassCompact));
                const isGeneralLine = !classStr.includes('rotation_line_') && !classStr.includes('hidden_section');

                if (isSpecLine || (isGeneralLine && !lowerHero)) {
                    // Search for ALL preceding headings to get full context
                    let combinedContext = '';
                    let current: any = element.parent();
                    while (current.length > 0) {
                        let sib = current.prev();
                        while (sib.length > 0) {
                            const h = sib.is('h2, h3') ? sib : sib.find('h2, h3');
                            h.each((_idx: number, hVal: any) => {
                                combinedContext += ' ' + $(hVal).text().toLowerCase();
                            });
                            sib = sib.prev();
                        }
                        current = current.parent();
                        if (current.is('body') || current.is('html')) break;
                    }

                    const matchesCombatType = combinedContext.includes(lowerCombatType) ||
                        (lowerCombatType === 'single target' && (combinedContext.includes('opener') || combinedContext.includes('single-target')));

                    if (combinedContext.includes('rotation') && matchesCombatType) {
                        const text = element.text().trim().replace(/\s+/g, ' ');
                        if (text.length > 5 && text.length < 500) {
                            priorityList.push(text);
                        }
                    }
                }
            });
            if (priorityList.length > 0) {
                console.log(`[Icy Veins] Strategy 4 successfully found ${priorityList.length} rules.`);
            }
        }

        // ──────────────────────────────────────────────
        // STEP 3: Extract <li> elements from matched sections if priorityList still empty
        // ──────────────────────────────────────────────
        if (priorityList.length === 0 && targetBlockIds.length > 0) {
            console.log(`[Icy Veins] Scraping from sections: ${targetBlockIds.join(', ')}`);

            for (const blockId of targetBlockIds) {
                $(`#${blockId} ol > li`).each((_, element) => {
                    const classStr = $(element).attr('class') || '';
                    let keepTalent = true;
                    // (talent filtering logic)
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
                    if (keepTalent) {
                        const text = $(element).text().trim().replace(/\s+/g, ' ');
                        if (text.length > 10 && text.length < 500) {
                            priorityList.push(text);
                        }
                    }
                });
            }
        }

        // Final fallback: Global scan
        if (priorityList.length === 0) {
            console.log(`[Icy Veins] No matching sections or Midnight classes found, using global li scan.`);
            $('ol > li').each((_, element) => {
                const text = $(element).text().trim().replace(/\s+/g, ' ');
                if (text.length > 10 && text.length < 300) {
                    priorityList.push(text);
                }
            });
        }

        const uniqueRules = scrubRules(Array.from(new Set(priorityList)));
        if (uniqueRules.length > 0) {
            const label = `--- Icy Veins ${heroSpec || ''} Rotation ---`;
            return [label, ...uniqueRules];
        }

        return [];
    } catch (error) {
        console.error(`[Icy Veins Scraper] Error:`, error);
        return [];
    } finally {
        if (browser) {
            await browser.close().catch(console.error);
        }
    }
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

    const isDevourerAnnihilator = specSlug === 'devourer' && heroSpec === 'Annihilator';

    const [icyVeinsRules, wowheadRules] = await Promise.all([
        scrapeIcyVeins(classSlug, specSlug, heroSpec, combatType),
        isDevourerAnnihilator ? Promise.resolve([]) : scrapeWowhead(classSlug, specSlug, heroSpec, combatType)
    ]);

    const combinedList = [...icyVeinsRules, ...wowheadRules];

    if (combinedList.length === 0) {
        combinedList.push('Follow standard builder-spender rotation priorities (Scrapers returned 0 data).');
    }

    const filteredList = await filterScrapedRules(combinedList, classSlug, specSlug, heroSpec || 'None', combatType);

    const result = {
        classSlug,
        specSlug,
        priorityList: filteredList
    };

    cache[cacheKey] = result;
    return result;
}
