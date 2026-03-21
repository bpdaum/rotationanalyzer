import { NextResponse } from 'next/server';
import { parseCombatLog } from '@/lib/parser';
import { loadGuide } from '@/lib/guide-data';

import { analyzeRotation } from '@/lib/analyzer';
import { getActiveTalents } from '@/lib/blizzard';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('logFile') as File;
        const classSlug = formData.get('classSlug') as string;
        const specSlug = formData.get('specSlug') as string;
        const heroSpec = formData.get('heroSpec') as string || 'None';
        const combatType = formData.get('combatType') as string || 'Single Target';

        const region = formData.get('region') as string || '';
        const realm = formData.get('realm') as string || '';
        const characterName = formData.get('characterName') as string || '';

        if (!file || !classSlug || !specSlug) {
            return NextResponse.json({ error: 'Missing file, classSlug, or specSlug' }, { status: 400 });
        }

        const logText = await file.text();

        // 1. Parse log
        const parsedContext = parseCombatLog(logText, characterName);

        // 2. Load guide from static JSON (purely offline source)
        let rotation = loadGuide(classSlug, specSlug, heroSpec, combatType);
        if (!rotation || rotation.priorityList.length === 0) {
            console.warn(`[Analyze] No static guide for ${classSlug}/${specSlug}/${heroSpec}/${combatType}.`);
            return NextResponse.json({ 
                error: 'We have not generated an offline guide for this Class/Spec/Hero combination yet.' 
            }, { status: 404 });
        }

        // 3. Fetch active talents if character info is provided
        let activeTalents: string[] | null = null;
        if (region && realm && characterName) {
            try {
                activeTalents = await getActiveTalents(region, realm, characterName);
            } catch (err) {
                console.error("[Analyze] Failed to fetch talents from Blizzard API:", err);
                // Continue without talents rather than failing the whole analysis
            }
        }

        // 4. Analyze against the timeline
        const analysis = await analyzeRotation(parsedContext.timeline, rotation, heroSpec, activeTalents);

        return NextResponse.json({
            data: {
                analysis,
                timeline: parsedContext.timeline,
                auraTracks: parsedContext.auraTracks,
                debuffTracks: parsedContext.debuffTracks,
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
