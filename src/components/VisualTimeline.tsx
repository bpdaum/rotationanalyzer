'use client';

import React, { useRef, useState, useMemo } from 'react';
import type { CombatEvent, AuraTrackEvent } from '@/lib/parser';
import type { AnalysisFeedback } from '@/lib/analyzer';

interface VisualTimelineProps {
    timeline: CombatEvent[];
    auraTracks?: AuraTrackEvent[];
    feedback: AnalysisFeedback[];
    iconMap: Record<number, string>;
}

export function VisualTimeline({ timeline, auraTracks = [], feedback, iconMap }: VisualTimelineProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

    if (timeline.length === 0) return null;

    // Constants for linear time scaling
    const PIXELS_PER_SECOND = 100; // Increased spacing for better readability

    const { firstEventMs, lastEventMs, totalDurationMs, totalWidthPx } = useMemo(() => {
        const first = timeline[0].timestampMs;
        const last = timeline[timeline.length - 1].timestampMs;
        const duration = Math.max(last - first + 2000, 5000); // at least 5s, with 2s buffer at end
        return {
            firstEventMs: first,
            lastEventMs: last,
            totalDurationMs: duration,
            totalWidthPx: (duration / 1000) * PIXELS_PER_SECOND
        };
    }, [timeline]);

    // Build a map of timelineIndex -> feedback items
    const feedbackByIndex: Record<number, AnalysisFeedback[]> = useMemo(() => {
        const map: Record<number, AnalysisFeedback[]> = {};
        feedback.forEach(fb => {
            if (fb.timelineIndex !== undefined && fb.timelineIndex >= 0) {
                if (!map[fb.timelineIndex]) map[fb.timelineIndex] = [];
                map[fb.timelineIndex].push(fb);
            }
        });
        return map;
    }, [feedback]);

    const getGlowColor = (type: string) => {
        switch (type) {
            case 'error': return '#c0392b';
            case 'warning': return '#f39c12';
            case 'info': return '#27ae60';
            default: return 'transparent';
        }
    };

    const getBaseSpellName = (spellName: string) => {
        const idx = spellName.indexOf(' (Active Auras:');
        return idx > -1 ? spellName.substring(0, idx) : spellName;
    };

    // Layout for aura tracks to prevent overlapping
    // We'll just assign them to rows visually
    const auraRows: AuraTrackEvent[][] = [];
    auraTracks.forEach(track => {
        let placed = false;
        for (const row of auraRows) {
            // Check if it fits in this row (needs some margin)
            const lastInRow = row[row.length - 1];
            if (lastInRow.endTimeMs + 500 <= track.startTimeMs) {
                row.push(track);
                placed = true;
                break;
            }
        }
        if (!placed) {
            auraRows.push([track]);
        }
    });

    const MAIN_RAIL_HEIGHT = 120; // Space for the cast icons and text
    const AURA_ROW_HEIGHT = 28;
    const containerHeight = MAIN_RAIL_HEIGHT + (auraRows.length * AURA_ROW_HEIGHT) + 20;

    return (
        <div className="card animate-fade-in" style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Visual Cast Timeline</h3>

            <div
                ref={scrollRef}
                className="visual-timeline-scroll"
                style={{
                    overflowX: 'auto',
                    paddingBottom: '16px',
                    position: 'relative',
                    height: `${containerHeight}px`,
                }}
            >
                <div style={{ position: 'relative', width: `${totalWidthPx}px`, height: '100%', minWidth: '100%' }}>
                    {/* Horizontal main rail */}
                    <div style={{
                        position: 'absolute',
                        top: '60px',
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'var(--color-border)',
                        zIndex: 0,
                    }} />

                    {/* Timeline Casts */}
                    {timeline.map((event, i) => {
                        const fbItems = feedbackByIndex[i];
                        const hasFeedback = fbItems && fbItems.length > 0;
                        const worstType = hasFeedback
                            ? (fbItems.some(f => f.type === 'error') ? 'error' : fbItems.some(f => f.type === 'warning') ? 'warning' : 'info')
                            : null;
                        const glowColor = worstType ? getGlowColor(worstType) : 'transparent';
                        const iconUrl = iconMap[event.spellId];
                        const baseName = getBaseSpellName(event.spellName);

                        const leftPx = ((event.timestampMs - firstEventMs) / 1000) * PIXELS_PER_SECOND;

                        return (
                            <div
                                key={`cast-${i}`}
                                id={`vt-cast-${i}`}
                                style={{
                                    position: 'absolute',
                                    left: `${leftPx}px`,
                                    top: '20px',
                                    transform: 'translateX(-50%)', // Center the icon on the exact time
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    width: '60px',
                                    zIndex: 10,
                                    cursor: hasFeedback ? 'pointer' : 'default',
                                }}
                                onClick={() => {
                                    if (hasFeedback) {
                                        setActiveTooltip(activeTooltip === i ? null : i);
                                    }
                                }}
                            >
                                {/* Timestamp */}
                                <span style={{
                                    fontSize: '0.6rem',
                                    color: 'var(--color-text-muted)',
                                    marginBottom: '4px',
                                    whiteSpace: 'nowrap',
                                    position: 'absolute',
                                    top: '-20px',
                                }}>
                                    {((event.timestampMs - firstEventMs) / 1000).toFixed(1)}s
                                </span>

                                {/* Icon */}
                                <div
                                    className="spell-icon-container"
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '6px',
                                        overflow: 'hidden',
                                        border: hasFeedback ? `2px solid ${glowColor}` : '2px solid var(--color-border)',
                                        boxShadow: hasFeedback ? `0 0 12px ${glowColor}` : '0 2px 4px rgba(0,0,0,0.5)',
                                        transition: 'all 0.2s ease',
                                        background: 'var(--color-bg-elevated)',
                                        zIndex: 2,
                                    }}
                                >
                                    {iconUrl ? (
                                        <img src={iconUrl} alt={baseName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '2px' }}>
                                            {baseName.substring(0, 3)}
                                        </div>
                                    )}
                                </div>

                                {/* Connector to Rail */}
                                <div style={{
                                    width: '2px',
                                    height: '8px',
                                    background: hasFeedback ? glowColor : 'var(--color-border)',
                                    marginTop: '0px',
                                    zIndex: 1
                                }} />

                                {/* Spell Name */}
                                <span style={{
                                    fontSize: '0.55rem',
                                    color: hasFeedback ? glowColor : 'var(--color-text-muted)',
                                    marginTop: '4px',
                                    textAlign: 'center',
                                    width: '100%',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontWeight: hasFeedback ? 600 : 400,
                                }}>{baseName}</span>

                                {/* Tooltip */}
                                {activeTooltip === i && fbItems && (
                                    <div className="vt-tooltip" style={{
                                        position: 'absolute',
                                        top: '-32px',
                                        left: '50%',
                                        transform: 'translate(-50%, -100%)',
                                        background: 'var(--color-bg-elevated)',
                                        border: `1px solid ${glowColor}`,
                                        borderRadius: 'var(--radius-md)',
                                        padding: '12px',
                                        minWidth: '240px',
                                        maxWidth: '320px',
                                        zIndex: 100,
                                        boxShadow: `0 4px 20px rgba(0,0,0,0.6), 0 0 15px ${glowColor}33`,
                                    }}>
                                        {fbItems.map((fb, fi) => (
                                            <div key={fi} style={{ marginBottom: fi < fbItems.length - 1 ? '8px' : 0 }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: glowColor, marginBottom: '4px', textTransform: 'uppercase' }}>{fb.type}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-main)' }}>{fb.message}</div>
                                                {fb.sourceQuote && (
                                                    <div style={{
                                                        fontSize: '0.7rem',
                                                        color: 'var(--color-text-muted)',
                                                        fontStyle: 'italic',
                                                        marginTop: '4px',
                                                    }}>
                                                        &quot;{fb.sourceQuote}&quot;
                                                    </div>
                                                )}
                                                {fb.correctSequence && fb.correctSequence.length > 0 && (
                                                    <div style={{ marginTop: '8px' }}>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Correct sequence:</div>
                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                            {fb.correctSequence.map((spell, si) => (
                                                                <span key={si} style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(39, 174, 96, 0.15)', border: '1px solid rgba(39, 174, 96, 0.3)', borderRadius: 'var(--radius-sm)', color: '#27ae60' }}>
                                                                    {si > 0 && '→ '}{spell}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Aura Tracks */}
                    {auraRows.map((row, rowIndex) => {
                        const topPx = MAIN_RAIL_HEIGHT + (rowIndex * AURA_ROW_HEIGHT);
                        return row.map((track, trackIndex) => {
                            const effStart = Math.max(track.startTimeMs, firstEventMs);
                            const leftPx = ((effStart - firstEventMs) / 1000) * PIXELS_PER_SECOND;
                            // Ensure there is at least a small visible width for instant auras or small gaps
                            const widthPx = Math.max(((track.endTimeMs - effStart) / 1000) * PIXELS_PER_SECOND, 20);

                            return (
                                <div key={`aura-${rowIndex}-${trackIndex}`} style={{
                                    position: 'absolute',
                                    top: `${topPx}px`,
                                    left: `${leftPx}px`,
                                    width: `${widthPx}px`,
                                    height: '24px',
                                    background: 'rgba(155, 89, 182, 0.15)', // Purple aura theme
                                    border: '1px solid rgba(155, 89, 182, 0.4)',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 6px',
                                    overflow: 'hidden',
                                    fontSize: '0.65rem',
                                    color: '#d2b4de',
                                    whiteSpace: 'nowrap',
                                    zIndex: 5,
                                    boxShadow: 'inset 0 0 8px rgba(155, 89, 182, 0.1)'
                                }}>
                                    <span style={{ fontWeight: 500, marginRight: '6px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.name}</span>

                                    {/* Show final stack size if it grew */}
                                    {track.stacks.length > 0 && track.stacks[track.stacks.length - 1].count > 1 && (
                                        <span style={{
                                            background: 'rgba(155, 89, 182, 0.6)',
                                            color: '#fff',
                                            padding: '1px 5px',
                                            borderRadius: '10px',
                                            fontSize: '0.55rem',
                                            fontWeight: 'bold',
                                        }}>
                                            x{track.stacks[track.stacks.length - 1].count}
                                        </span>
                                    )}
                                </div>
                            );
                        });
                    })}
                </div>
            </div>
        </div>
    );
}
