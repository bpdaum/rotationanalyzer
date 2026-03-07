import { NextResponse } from 'next/server';
import { parseCombatLog } from '@/lib/parser';
import { scrapeRotation } from '@/lib/scraper';
import { analyzeRotation } from '@/lib/analyzer';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('logFile') as File;
        const classSlug = formData.get('classSlug') as string;
        const specSlug = formData.get('specSlug') as string;
        const heroSpec = formData.get('heroSpec') as string || 'None';
        const combatType = formData.get('combatType') as string || 'Single Target';

        if (!file || !classSlug || !specSlug) {
            return NextResponse.json({ error: 'Missing file, classSlug, or specSlug' }, { status: 400 });
        }

        const logText = await file.text();

        // 1. Parse log
        const timeline = parseCombatLog(logText);

        // 2. Scrape rotation priority list
        const rotation = await scrapeRotation(classSlug, specSlug, heroSpec, combatType);

        // 3. Analyze against the timeline
        const analysis = await analyzeRotation(timeline, rotation, heroSpec);

        return NextResponse.json({
            data: {
                analysis,
                timeline,
                rotation,
            }
        });
    } catch (error) {
        console.error('Failed to analyze log:', error);
        return NextResponse.json({ error: 'Internal server error during analysis' }, { status: 500 });
    }
}
