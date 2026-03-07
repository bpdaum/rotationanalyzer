'use client';

import React, { useRef, useState } from 'react';
import type { CombatEvent } from '@/lib/parser';
import type { AnalysisFeedback } from '@/lib/analyzer';

interface VisualTimelineProps {
    timeline: CombatEvent[];
    feedback: AnalysisFeedback[];
    iconMap: Record<number, string>;
}

export function VisualTimeline({ timeline, feedback, iconMap }: VisualTimelineProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

    if (timeline.length === 0) return null;

    // Build a map of timelineIndex -> feedback items
    const feedbackByIndex: Record<number, AnalysisFeedback[]> = {};
    feedback.forEach(fb => {
        if (fb.timelineIndex !== undefined && fb.timelineIndex >= 0) {
            if (!feedbackByIndex[fb.timelineIndex]) feedbackByIndex[fb.timelineIndex] = [];
            feedbackByIndex[fb.timelineIndex].push(fb);
        }
    });

    const getGlowColor = (type: string) => {
        switch (type) {
            case 'error': return '#c0392b';
            case 'warning': return '#f39c12';
            case 'info': return '#27ae60';
            default: return 'transparent';
        }
    };

    // Extract the base spell name (without aura info)
    const getBaseSpellName = (spellName: string) => {
        const idx = spellName.indexOf(' (Active Auras:');
        return idx > -1 ? spellName.substring(0, idx) : spellName;
    };

    return (
        <div className="card animate-fade-in" style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Visual Cast Timeline</h3>

            <div
                ref={scrollRef}
                className="visual-timeline-scroll"
                style={{
                    display: 'flex',
                    overflowX: 'auto',
                    padding: '16px 8px 24px',
                    gap: '4px',
                    alignItems: 'flex-end',
                    position: 'relative',
                }}
            >
                {/* Horizontal rail */}
                <div style={{
                    position: 'absolute',
                    bottom: '52px',
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'var(--color-border)',
                    zIndex: 0,
                }} />

                {timeline.map((event, i) => {
                    const fbItems = feedbackByIndex[i];
                    const hasFeedback = fbItems && fbItems.length > 0;
                    const worstType = hasFeedback
                        ? (fbItems.some(f => f.type === 'error') ? 'error' : fbItems.some(f => f.type === 'warning') ? 'warning' : 'info')
                        : null;
                    const glowColor = worstType ? getGlowColor(worstType) : 'transparent';
                    const iconUrl = iconMap[event.spellId];
                    const baseName = getBaseSpellName(event.spellName);

                    return (
                        <div
                            key={i}
                            id={`vt-cast-${i}`}
                            className="visual-timeline-cast"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                minWidth: '56px',
                                position: 'relative',
                                zIndex: 1,
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
                            }}>
                                {event.timestamp.split(' ')[1]?.split('.')[0] || event.timestamp}
                            </span>

                            {/* Icon container */}
                            <div
                                className="spell-icon-container"
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                    border: hasFeedback ? `2px solid ${glowColor}` : '2px solid var(--color-border)',
                                    boxShadow: hasFeedback ? `0 0 12px ${glowColor}` : 'none',
                                    transition: 'all 0.2s ease',
                                    background: 'var(--color-bg-elevated)',
                                    flexShrink: 0,
                                }}
                            >
                                {iconUrl ? (
                                    <img
                                        src={iconUrl}
                                        alt={baseName}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        loading="lazy"
                                    />
                                ) : (
                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.5rem',
                                        color: 'var(--color-text-muted)',
                                        textAlign: 'center',
                                        padding: '2px',
                                    }}>
                                        {baseName.substring(0, 3)}
                                    </div>
                                )}
                            </div>

                            {/* Spell name */}
                            <span style={{
                                fontSize: '0.55rem',
                                color: hasFeedback ? glowColor : 'var(--color-text-muted)',
                                marginTop: '4px',
                                textAlign: 'center',
                                maxWidth: '56px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontWeight: hasFeedback ? 600 : 400,
                            }}>
                                {baseName}
                            </span>

                            {/* Tooltip */}
                            {activeTooltip === i && fbItems && (
                                <div className="vt-tooltip" style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    transform: 'translateY(-100%)',
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
                                            <div style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                color: glowColor,
                                                marginBottom: '4px',
                                                textTransform: 'uppercase',
                                            }}>
                                                {fb.type}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-main)' }}>
                                                {fb.message}
                                            </div>
                                            {fb.correctSequence && fb.correctSequence.length > 0 && (
                                                <div style={{ marginTop: '8px' }}>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                                                        Correct sequence:
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                        {fb.correctSequence.map((spell, si) => (
                                                            <span key={si} style={{
                                                                fontSize: '0.7rem',
                                                                padding: '2px 8px',
                                                                background: 'rgba(39, 174, 96, 0.15)',
                                                                border: '1px solid rgba(39, 174, 96, 0.3)',
                                                                borderRadius: 'var(--radius-sm)',
                                                                color: '#27ae60',
                                                            }}>
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
            </div>
        </div>
    );
}
