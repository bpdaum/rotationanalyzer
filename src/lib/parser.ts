export interface CombatEvent {
    timestamp: string;
    timestampMs: number;
    spellId: number;
    spellName: string;
    sourceName: string;
    activeAuras: string[];
}

export interface AuraStackChange {
    timeMs: number;
    count: number;
}

export interface AuraTrackEvent {
    name: string;
    startTimeMs: number;
    endTimeMs: number;
    stacks: AuraStackChange[];
}

export interface ParsedLog {
    timeline: CombatEvent[];
    auraTracks: AuraTrackEvent[];
}

// Format: MM/DD/YYYY HH:MM:SS.MMM
function parseTimestampToMs(dateStr: string, timeStr: string): number {
    // We only really care about the relative time within the log.
    // If dateStr is not available, we can just use timeStr.
    const [hours, minutes, secondsAndMs] = timeStr.split(':');
    const [seconds, milliseconds] = secondsAndMs.split('.');

    return (
        parseInt(hours, 10) * 3600000 +
        parseInt(minutes, 10) * 60000 +
        parseInt(seconds, 10) * 1000 +
        parseInt(milliseconds, 10)
    );
}

/**
 * Parses a WoW combat log (.txt) and extracts a timeline of the player's spell casts
 * and aura (buff/debuff) tracking events.
 */
export function parseCombatLog(logText: string): ParsedLog {
    const lines = logText.split('\n');
    const events: CombatEvent[] = [];
    const auraTracks: AuraTrackEvent[] = [];

    let playerGuid: string | null = null;
    let playerName: string | null = null;
    let firstEventMs = -1;

    // Track active auras to summarize stacks on spell casts
    const activeAuras: Record<string, number> = {};

    // In-progress aura tracking for the visual timeline
    // Key: spellName, Value: current active track
    const openAuraTracks: Record<string, AuraTrackEvent> = {};

    for (const line of lines) {
        if (!line.trim()) continue;

        const splitIndex = line.indexOf('  ');
        if (splitIndex === -1) continue;

        const timestampRaw = line.substring(0, splitIndex).trim(); // e.g. "3/7/2026 16:01:47.699"
        const [dateStr, timeStr] = timestampRaw.split(' ');

        if (!timeStr) continue;

        let msRaw = parseTimestampToMs(dateStr, timeStr);
        if (firstEventMs === -1) {
            firstEventMs = msRaw;
        }

        const timestampMs = msRaw - firstEventMs;

        const payload = line.substring(splitIndex + 2).trim();
        const columns = payload.split(',');
        if (columns.length < 11) continue;

        const eventType = columns[0];
        const sourceGuid = columns[1];
        const sourceNameRaw = columns[2];
        const sourceFlags = columns[3];
        const destGuid = columns[5];

        if (!playerGuid && sourceGuid.startsWith('Player-') && sourceFlags === '0x511') {
            playerGuid = sourceGuid;
            playerName = sourceNameRaw.replace(/"/g, '');
        }

        // Only track aura events that happen TO the player.
        if (eventType.startsWith('SPELL_AURA_') && destGuid === playerGuid) {
            const spellName = columns[10].replace(/"/g, '');
            // const auraType = columns[12]; // BUFF or DEBUFF

            if (eventType === 'SPELL_AURA_APPLIED' || eventType === 'SPELL_AURA_REFRESH') {
                activeAuras[spellName] = 1;

                // If it already existed but wasn't closed properly, close it first
                if (openAuraTracks[spellName]) {
                    openAuraTracks[spellName].endTimeMs = timestampMs;
                    auraTracks.push({ ...openAuraTracks[spellName] });
                }

                openAuraTracks[spellName] = {
                    name: spellName,
                    startTimeMs: timestampMs,
                    endTimeMs: timestampMs, // Will be updated on removal
                    stacks: [{ timeMs: timestampMs, count: 1 }]
                };

            } else if (eventType === 'SPELL_AURA_APPLIED_DOSE') {
                const dose = parseInt(columns[13], 10);
                const currentDose = isNaN(dose) ? (activeAuras[spellName] || 0) + 1 : dose;
                activeAuras[spellName] = currentDose;

                if (openAuraTracks[spellName]) {
                    openAuraTracks[spellName].stacks.push({ timeMs: timestampMs, count: currentDose });
                }

            } else if (eventType === 'SPELL_AURA_REMOVED_DOSE') {
                const dose = parseInt(columns[13], 10);
                const currentDose = isNaN(dose) ? Math.max(0, (activeAuras[spellName] || 0) - 1) : dose;
                activeAuras[spellName] = currentDose;

                if (openAuraTracks[spellName]) {
                    openAuraTracks[spellName].stacks.push({ timeMs: timestampMs, count: currentDose });
                }

                if (activeAuras[spellName] === 0) {
                    delete activeAuras[spellName];
                }

            } else if (eventType === 'SPELL_AURA_REMOVED') {
                delete activeAuras[spellName];

                if (openAuraTracks[spellName]) {
                    openAuraTracks[spellName].endTimeMs = timestampMs;
                    auraTracks.push({ ...openAuraTracks[spellName] });
                    delete openAuraTracks[spellName];
                }
            }
        }

        if (eventType === 'SPELL_CAST_SUCCESS' && sourceGuid === playerGuid) {
            const spellIdRaw = columns[9];
            const spellId = parseInt(spellIdRaw, 10) || 0;
            const spellNameRaw = columns[10];
            const spellName = spellNameRaw.replace(/"/g, '');

            const auraPairs = Object.entries(activeAuras).map(([name, count]) => count > 1 ? `${name} x${count}` : name);

            events.push({
                timestamp: timestampRaw,
                timestampMs,
                spellId,
                spellName,
                sourceName: playerName || 'Unknown',
                activeAuras: auraPairs,
            });
        }
    }

    // Close any aura tracks that were still open at the end of the log
    // We'll use the final event's timestamp as the end time, or at least a fallback
    const lastTimestampMs = events.length > 0 ? events[events.length - 1].timestampMs + 2000 : 0;

    for (const [name, track] of Object.entries(openAuraTracks)) {
        track.endTimeMs = lastTimestampMs;
        auraTracks.push(track);
    }

    // Sort aura tracks primarily by start time
    auraTracks.sort((a, b) => a.startTimeMs - b.startTimeMs);

    return {
        timeline: events,
        auraTracks
    };
}
