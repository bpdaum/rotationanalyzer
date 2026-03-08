import { NextResponse } from 'next/server';
import { parseCombatLog } from '@/lib/parser';
import { loadGuide } from '@/lib/guide-data';
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
        const parsedContext = parseCombatLog(logText);

        // 2. Load guide from static JSON (falls back to live scrape if no file exists)
        let rotation = loadGuide(classSlug, specSlug, heroSpec, combatType);
        if (!rotation || rotation.priorityList.length === 0) {
            console.warn(`[Analyze] No static guide for ${classSlug}/${specSlug}/${heroSpec}/${combatType}, falling back to live scrape`);
            rotation = await scrapeRotation(classSlug, specSlug, heroSpec, combatType);
        }

        // 3. Analyze against the timeline
        const analysis = await analyzeRotation(parsedContext.timeline, rotation, heroSpec);

        return NextResponse.json({
            data: {
                analysis,
                timeline: parsedContext.timeline,
                auraTracks: parsedContext.auraTracks,
                rotation,
            }
        });
    } catch (error: any) {
        console.error('Failed to analyze log:', error);
        return NextResponse.json({
            error: 'Internal server error during analysis',
            details: error.message
        }, { status: 500 });
    }
}
