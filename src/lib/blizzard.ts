// src/lib/blizzard.ts

export interface BlizzardTalent {
    id: number;
    name: string;
}

export async function getBlizzardToken(): Promise<string> {
    const clientId = process.env.BLIZZARD_CLIENT_ID;
    const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Missing Blizzard API credentials in environment variables.');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    // In a production app, we would cache this token until its expiry (usually 24h)
    // For now, we fetch it per-request, but we can add simple memory caching later.
    const response = await fetch('https://oauth.battle.net/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials',
        next: { revalidate: 3600 } // Use Next.js fetch cache where possible
    });

    if (!response.ok) {
        throw new Error(`Failed to get Blizzard token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
}

export async function getActiveTalents(region: string, realmSlug: string, characterName: string): Promise<string[]> {
    const token = await getBlizzardToken();
    const cleanRegion = region.toLowerCase() || 'us';
    const cleanRealm = realmSlug.toLowerCase().replace(/\s+/g, '-');
    const cleanName = characterName.toLowerCase();

    const url = `https://${cleanRegion}.api.blizzard.com/profile/wow/character/${cleanRealm}/${cleanName}/specializations?namespace=profile-${cleanRegion}&locale=en_US`;

    console.log(`[Blizzard API] Fetching talents for ${cleanName}-${cleanRealm} (${cleanRegion})`);

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        },
        next: { revalidate: 3600 } // Cache character profiles for an hour
    });

    if (!response.ok) {
        if (response.status === 404) {
            console.warn(`[Blizzard API] Character not found: ${cleanName}-${cleanRealm}`);
            return []; // Return empty rather than crashing the whole analysis
        }
        const errText = await response.text();
        throw new Error(`Failed to get character talents: ${response.status} ${errText}`);
    }

    const data = await response.json();

    if (!data.specializations || data.specializations.length === 0) {
        return [];
    }

    // Usually the first object is the active spec in modern API responses, but we check loadouts
    const currentSpec = data.specializations[0];

    if (!currentSpec.loadouts || currentSpec.loadouts.length === 0) {
        console.warn(`[Blizzard API] No loadouts found for ${cleanName}`);
        return [];
    }

    // Find the active loadout (or just take the first one if `is_active` is missing for some reason)
    const activeLoadout = currentSpec.loadouts.find((l: any) => l.is_active) || currentSpec.loadouts[0];

    const talentNames: string[] = [];

    const classTalents = activeLoadout.selected_class_talents || [];
    const specTalents = activeLoadout.selected_spec_talents || [];
    const heroTalents = activeLoadout.selected_hero_talents || [];

    const allNodes = [...classTalents, ...specTalents, ...heroTalents];

    for (const node of allNodes) {
        if (node.tooltip && node.tooltip.talent && node.tooltip.talent.name) {
            talentNames.push(node.tooltip.talent.name);
        }
    }

    console.log(`[Blizzard API] Successfully extracted ${talentNames.length} talents for ${cleanName}`);
    return talentNames;
}
