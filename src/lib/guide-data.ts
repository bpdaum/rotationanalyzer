import fs from 'fs';
import path from 'path';
import type { ScrapedRotation } from './scraper';

/**
 * Every valid DPS spec + its available hero specs.
 * Hero specs are listed per-spec (not per-class) for accuracy.
 * combatTypes: the combat profiles we scrape for.
 */
export interface DpsSpecEntry {
    classSlug: string;
    specSlug: string;
    heroSpecs: string[];
    combatTypes: string[];
}

export const DPS_SPECS: DpsSpecEntry[] = [
    // Death Knight
    { classSlug: 'death-knight', specSlug: 'frost', heroSpecs: ['Rider of the Apocalypse', 'Deathbringer'], combatTypes: ['Single Target', 'AoE'] },
    { classSlug: 'death-knight', specSlug: 'unholy', heroSpecs: ['Rider of the Apocalypse', "San'layn"], combatTypes: ['Single Target', 'AoE'] },

    // Demon Hunter
    { classSlug: 'demon-hunter', specSlug: 'havoc', heroSpecs: ['Aldrachi Reaver', 'Fel-Scarred', 'Devourer'], combatTypes: ['Single Target', 'AoE'] },

    // Druid
    { classSlug: 'druid', specSlug: 'balance', heroSpecs: ['Keeper of the Grove', "Elune's Chosen"], combatTypes: ['Single Target', 'AoE'] },
    { classSlug: 'druid', specSlug: 'feral', heroSpecs: ['Wildstalker', 'Druid of the Claw'], combatTypes: ['Single Target', 'AoE'] },

    // Evoker
    { classSlug: 'evoker', specSlug: 'devastation', heroSpecs: ['Scalecommander', 'Flameshaper'], combatTypes: ['Single Target', 'AoE'] },
    { classSlug: 'evoker', specSlug: 'augmentation', heroSpecs: ['Chronowarden', 'Scalecommander'], combatTypes: ['Single Target', 'AoE'] },

    // Hunter
    { classSlug: 'hunter', specSlug: 'beast-mastery', heroSpecs: ['Pack Leader', 'Sentinel'], combatTypes: ['Single Target', 'AoE'] },
    { classSlug: 'hunter', specSlug: 'marksmanship', heroSpecs: ['Sentinel', 'Dark Ranger'], combatTypes: ['Single Target', 'AoE'] },
    { classSlug: 'hunter', specSlug: 'survival', heroSpecs: ['Pack Leader', 'Dark Ranger'], combatTypes: ['Single Target', 'AoE'] },

    // Mage
    { classSlug: 'mage', specSlug: 'arcane', heroSpecs: ['Spellslinger', 'Sunfury'], combatTypes: ['Single Target', 'AoE'] },
    { classSlug: 'mage', specSlug: 'fire', heroSpecs: ['Sunfury', 'Frostfire'], combatTypes: ['Single Target', 'AoE'] },
    { classSlug: 'mage', specSlug: 'frost', heroSpecs: ['Spellslinger', 'Frostfire'], combatTypes: ['Single Target', 'AoE'] },

    // Monk
    { classSlug: 'monk', specSlug: 'windwalker', heroSpecs: ['Master of Harmony', 'Shado-Pan'], combatTypes: ['Single Target', 'AoE'] },

    // Paladin
    { classSlug: 'paladin', specSlug: 'retribution', heroSpecs: ['Herald of the Sun', 'Templar'], combatTypes: ['Single Target', 'AoE'] },

    // Priest
    { classSlug: 'priest', specSlug: 'shadow', heroSpecs: ['Voidweaver', 'Archon'], combatTypes: ['Single Target', 'AoE'] },

    // Rogue
    { classSlug: 'rogue', specSlug: 'assassination', heroSpecs: ['Deathstalker', 'Fatebound'], combatTypes: ['Single Target', 'AoE'] },
    { classSlug: 'rogue', specSlug: 'outlaw', heroSpecs: ['Trickster', 'Fatebound'], combatTypes: ['Single Target', 'AoE'] },
    { classSlug: 'rogue', specSlug: 'subtlety', heroSpecs: ['Deathstalker', 'Trickster'], combatTypes: ['Single Target', 'AoE'] },

    // Shaman
    { classSlug: 'shaman', specSlug: 'elemental', heroSpecs: ['Stormbringer', 'Farseer'], combatTypes: ['Single Target', 'AoE'] },
    { classSlug: 'shaman', specSlug: 'enhancement', heroSpecs: ['Stormbringer', 'Totemic'], combatTypes: ['Single Target', 'AoE'] },

    // Warlock
    { classSlug: 'warlock', specSlug: 'affliction', heroSpecs: ['Soul Harvester', 'Hellcaller'], combatTypes: ['Single Target', 'AoE'] },
    { classSlug: 'warlock', specSlug: 'demonology', heroSpecs: ['Soul Harvester', 'Diabolist'], combatTypes: ['Single Target', 'AoE'] },
    { classSlug: 'warlock', specSlug: 'destruction', heroSpecs: ['Hellcaller', 'Diabolist'], combatTypes: ['Single Target', 'AoE'] },

    // Warrior
    { classSlug: 'warrior', specSlug: 'arms', heroSpecs: ['Colossus', 'Slayer'], combatTypes: ['Single Target', 'AoE'] },
    { classSlug: 'warrior', specSlug: 'fury', heroSpecs: ['Slayer', 'Mountain Thane'], combatTypes: ['Single Target', 'AoE'] },
];

/**
 * Produces a consistent filename key for a guide combination.
 */
export function guideKey(classSlug: string, specSlug: string, heroSpec: string, combatType: string): string {
    const hero = heroSpec.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    const combat = combatType.toLowerCase().replace(/\s+/g, '-');
    return `${classSlug}-${specSlug}-${hero}-${combat}`;
}

/**
 * Loads a pre-scraped guide from the static JSON directory.
 * Returns null if no file exists for this combination.
 */
export function loadGuide(classSlug: string, specSlug: string, heroSpec: string, combatType: string): ScrapedRotation | null {
    const key = guideKey(classSlug, specSlug, heroSpec, combatType);
    const filePath = path.join(process.cwd(), 'data', 'guides', `${key}.json`);

    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        return {
            classSlug: data.classSlug,
            specSlug: data.specSlug,
            priorityList: data.priorityList || [],
        };
    } catch {
        return null;
    }
}
