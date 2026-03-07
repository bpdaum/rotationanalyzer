import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

export interface ScrapedRotation {
    classSlug: string;
    specSlug: string;
    priorityList: string[];
}

// In-memory cache for MVP
const cache: Record<string, ScrapedRotation> = {};

async function scrapeWowhead(classSlug: string, specSlug: string): Promise<string[]> {
    console.log(`[WoWhead Scraper] Starting for ${specSlug} ${classSlug}...`);
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        const url = `https://www.wowhead.com/guide/classes/${classSlug}/${specSlug}/rotation-cooldowns-pve-dps`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        console.log(`[WoWhead Scraper] Waiting for rotation headers on ${url}`);
        await page.waitForSelector('#tab-rotations-rotation ol', { timeout: 15000 });

        const wowheadLists = await page.evaluate(() => {
            // We use the active tab's list to avoid pulling rules from explicitly toggled OFF builds
            const rotNodes = Array.from(document.querySelectorAll('#tab-rotations-rotation > div > div[data-option-active="true"] ol > li:not([data-option-active="false"])'));
            const opnNodes = Array.from(document.querySelectorAll('#tab-rotations-opener-cooldowns > div > div[data-option-active="true"] ol > li:not([data-option-active="false"])'));

            // If the structure is slightly different and we didn't find specific active blocks, fallback to all active LIs
            const fallbackRot = rotNodes.length > 0 ? rotNodes : Array.from(document.querySelectorAll('#tab-rotations-rotation ol > li:not([data-option-active="false"])'));
            const fallbackOpn = opnNodes.length > 0 ? opnNodes : Array.from(document.querySelectorAll('#tab-rotations-opener-cooldowns ol > li:not([data-option-active="false"])'));

            return {
                rotation: fallbackRot.map(li => li.textContent?.replace(/\s+/g, ' ').trim() || '').filter(Boolean),
                opener: fallbackOpn.map(li => li.textContent?.replace(/\s+/g, ' ').trim() || '').filter(Boolean)
            };
        });

        const priorityList: string[] = [];
        priorityList.push('--- WoWhead Opener (Priority List) ---');
        priorityList.push(...wowheadLists.opener);
        priorityList.push('--- WoWhead Rotation (Priority List) ---');
        priorityList.push(...wowheadLists.rotation);

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
    console.log(`[Icy Veins Scraper] Starting for ${specSlug} ${classSlug}...`);
    const url = `https://www.icy-veins.com/wow/${specSlug}-${classSlug}-pve-dps-rotation-cooldowns-abilities`;
    const priorityList: string[] = [];

    try {
        const res = await fetch(url, { next: { revalidate: 3600 } });
        if (!res.ok) {
            throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
        }
        const html = await res.text();
        const $ = cheerio.load(html);

        let targetPresetStr = '';
        const lowerHero = (heroSpec && heroSpec !== 'None') ? heroSpec.toLowerCase() : '';
        const lowerCombatType = combatType.toLowerCase();

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

        const configParts = targetPresetStr.split(' ');
        const targetPreset = configParts.find(p => p.startsWith('preset-'));
        const activeTalents = new Set(configParts.filter(p => p.startsWith('talent-')));

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
            if (text.length > 10 && text.length < 200) {
                priorityList.push(text);
            }
        });

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
    const cacheKey = `${classSlug}-${specSlug}${hk}${ck}-v2`;
    if (cache[cacheKey]) {
        return cache[cacheKey];
    }

    if (classSlug === 'demon-hunter' && specSlug === 'devourer') {
        const devourerFallback: ScrapedRotation = {
            classSlug,
            specSlug,
            priorityList: [
                'Cast Void Metamorphosis',
                'Cast Collapsing Star on cooldown',
                'Cast Void Ray',
                'Cast Reap when you have enough fragments',
                'Cast Consume to generate fragments'
            ]
        };
        cache[cacheKey] = devourerFallback;
        return devourerFallback;
    }

    // Run both scrapers concurrently to save time
    const [icyVeinsRules, wowheadRules] = await Promise.all([
        scrapeIcyVeins(classSlug, specSlug, heroSpec, combatType),
        scrapeWowhead(classSlug, specSlug)
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

