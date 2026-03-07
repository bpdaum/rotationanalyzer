import { NextResponse } from 'next/server';
import { scrapeRotation } from '@/lib/scraper';

export async function POST(request: Request) {
    try {
        const { classSlug, specSlug, heroSpec, combatType } = await request.json();

        if (!classSlug || !specSlug) {
            return NextResponse.json({ error: 'Missing classSlug or specSlug' }, { status: 400 });
        }

        const rotation = await scrapeRotation(classSlug, specSlug, heroSpec, combatType);
        return NextResponse.json({ data: rotation });
    } catch (error) {
        console.error('Failed to scrape rotation:', error);
        return NextResponse.json({ error: 'Internal server error while scraping' }, { status: 500 });
    }
}
