import { NextResponse } from 'next/server';

// In-memory cache for icon lookups
const iconCache: Record<number, string> = {};

async function resolveIcon(spellId: number): Promise<string> {
    if (iconCache[spellId]) return iconCache[spellId];

    try {
        const res = await fetch(`https://nether.wowhead.com/tooltip/spell/${spellId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!res.ok) {
            console.warn(`[Icon Resolver] Failed to fetch tooltip for spell ${spellId}: ${res.status}`);
            return '';
        }
        const data = await res.json();
        const iconName: string = data.icon || '';
        if (!iconName) return '';

        const url = `https://wow.zamimg.com/images/wow/icons/medium/${iconName}.jpg`;
        iconCache[spellId] = url;
        return url;
    } catch (err) {
        console.error(`[Icon Resolver] Error resolving spell ${spellId}:`, err);
        return '';
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const spellIds: number[] = body.spellIds || [];

        if (spellIds.length === 0) {
            return NextResponse.json({ iconMap: {} });
        }

        // Deduplicate
        const uniqueIds = [...new Set(spellIds)];

        // Resolve in parallel (batch of 10 at a time to avoid flooding)
        const iconMap: Record<number, string> = {};
        for (let i = 0; i < uniqueIds.length; i += 10) {
            const batch = uniqueIds.slice(i, i + 10);
            const results = await Promise.all(batch.map(id => resolveIcon(id)));
            batch.forEach((id, idx) => {
                if (results[idx]) {
                    iconMap[id] = results[idx];
                }
            });
        }

        return NextResponse.json({ iconMap });
    } catch (error: any) {
        console.error('[Icon API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
