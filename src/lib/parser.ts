export interface CombatEvent {
    timestamp: string;
    spellId: number;
    spellName: string;
    sourceName: string;
}

/**
 * Parses a WoW combat log (.txt) and extracts a timeline of the player's spell casts.
 * Specifically looks for SPELL_CAST_SUCCESS.
 */
export function parseCombatLog(logText: string): CombatEvent[] {
    const lines = logText.split('\n');
    const events: CombatEvent[] = [];

    let playerGuid: string | null = null;
    let playerName: string | null = null;

    const activeAuras: Record<string, number> = {};

    for (const line of lines) {
        if (!line.trim()) continue;

        const splitIndex = line.indexOf('  ');
        if (splitIndex === -1) continue;

        const timestamp = line.substring(0, splitIndex).trim();
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
            const auraType = columns[12];
            // Typically only care about BUFFs on ourselves, but some mechanics are technically DEBUFFs
            // We'll track all auras for completeness to avoid missing specific class mechanics.

            if (eventType === 'SPELL_AURA_APPLIED' || eventType === 'SPELL_AURA_REFRESH') {
                if (!activeAuras[spellName]) {
                    activeAuras[spellName] = 1;
                }
            } else if (eventType === 'SPELL_AURA_APPLIED_DOSE') {
                const dose = parseInt(columns[13], 10);
                activeAuras[spellName] = isNaN(dose) ? (activeAuras[spellName] || 0) + 1 : dose;
            } else if (eventType === 'SPELL_AURA_REMOVED_DOSE') {
                const dose = parseInt(columns[13], 10);
                activeAuras[spellName] = isNaN(dose) ? Math.max(0, (activeAuras[spellName] || 0) - 1) : dose;
                if (activeAuras[spellName] === 0) delete activeAuras[spellName];
            } else if (eventType === 'SPELL_AURA_REMOVED') {
                delete activeAuras[spellName];
            }
        }

        if (eventType === 'SPELL_CAST_SUCCESS' && sourceGuid === playerGuid) {
            const spellIdRaw = columns[9];
            const spellId = parseInt(spellIdRaw, 10) || 0;
            const spellNameRaw = columns[10];
            const spellName = spellNameRaw.replace(/"/g, '');

            // Format active auras into a readable string (e.g. "Arcane Charge x4, Arcane Salvo x20")
            const auraPairs = Object.entries(activeAuras).map(([name, count]) => count > 1 ? `${name} x${count}` : name);
            const auraStr = auraPairs.length > 0 ? ` (Active Auras: ${auraPairs.join(', ')})` : '';

            events.push({
                timestamp,
                spellId,
                spellName: `${spellName}${auraStr}`,
                sourceName: playerName || 'Unknown',
            });
        }
    }

    return events;
}
