/**
 * CLI Script: Fetch SimulationCraft APLs and append them to existing JSON guides.
 *
 * Usage:
 *   npx tsx scripts/fetch-apls.ts
 */

import fs from 'fs';
import path from 'path';
import { DPS_SPECS, guideKey } from '../src/lib/guide-data';

const GUIDES_DIR = path.join(process.cwd(), 'data', 'guides');
const SIMC_APL_MARKER = '--- SimulationCraft APL ---';

async function fetchSimC(classSlug: string, specSlug: string): Promise<string[]> {
    const formattedClass = classSlug.replace(/-/g, '').toLowerCase();
    const formattedSpec = specSlug.replace(/-/g, '_').toLowerCase();
    const url = `https://raw.githubusercontent.com/simulationcraft/simc/midnight/ActionPriorityLists/default/${formattedClass}_${formattedSpec}.simc`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`[SimC Scraper] Could not fetch APL: ${response.statusText} (${url})`);
            return [];
        }

        const text = await response.text();
        const lines = text.split('\n');

        const priorityList: string[] = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('actions=') || trimmed.startsWith('actions+') || trimmed.startsWith('actions.')) {
                priorityList.push(trimmed);
            }
        }

        if (priorityList.length > 0) {
            return [SIMC_APL_MARKER, ...priorityList];
        }

        return [];
    } catch (error) {
        console.error(`[SimC Scraper] Error fetching SimC for ${specSlug} ${classSlug}:`, error);
        return [];
    }
}

function processGuideFile(filePath: string, simCRules: string[]) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const guideData = JSON.parse(fileContent);

        if (!guideData.priorityList) {
            return;
        }

        // Remove existing SimC rules to ensure idempotency
        const markerIndex = guideData.priorityList.findIndex((rule: string) => rule === SIMC_APL_MARKER);
        if (markerIndex !== -1) {
            guideData.priorityList = guideData.priorityList.slice(0, markerIndex);
        }

        // Append new SimC rules
        if (simCRules.length > 0) {
            guideData.priorityList.push(...simCRules);
        }

        fs.writeFileSync(filePath, JSON.stringify(guideData, null, 2), 'utf-8');
    } catch (error) {
        console.error(`[File Error] Could not process ${filePath}:`, error);
    }
}

async function main() {
    console.log('Fetching SimC APLs and appending to existing static guides...');

    if (!fs.existsSync(GUIDES_DIR)) {
        console.error(`Guides directory not found at ${GUIDES_DIR}. Please run scrape-all-guides.ts first.`);
        process.exit(1);
    }

    let successCount = 0;

    for (const entry of DPS_SPECS) {
        const { classSlug, specSlug, heroSpecs, combatTypes } = entry;

        console.log(`\nFetching SimC APL for ${classSlug} - ${specSlug}...`);
        const simCRules = await fetchSimC(classSlug, specSlug);

        if (simCRules.length === 0) {
            console.log(`  -> No APL found or failed to fetch.`);
            continue;
        }

        console.log(`  -> Fetched ${simCRules.length - 1} priority rules.`); // -1 to exclude marker

        // Find all JSON files for this class/spec combo
        let updatedFiles = 0;
        for (const heroSpec of heroSpecs) {
            for (const combatType of combatTypes) {
                const fileName = `${guideKey(classSlug, specSlug, heroSpec, combatType)}.json`;
                const filePath = path.join(GUIDES_DIR, fileName);

                if (fs.existsSync(filePath)) {
                    processGuideFile(filePath, simCRules);
                    updatedFiles++;
                }
            }
        }
        console.log(`  -> Appended to ${updatedFiles} static JSON guides.`);
        if (updatedFiles > 0) successCount++;

        // Politeness delay
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\nDone! Successfully updated APLs for ${successCount} class/spec combinations.`);
}

main().catch(console.error);
