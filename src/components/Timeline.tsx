'use client';

import React, { useState } from 'react';
import type { CombatEvent } from '@/lib/parser';

interface TimelineProps {
    timeline: CombatEvent[];
    iconMap?: Record<number, string>;
}

export function Timeline({ timeline, iconMap }: TimelineProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (timeline.length === 0) {
        return (
            <div className="card text-center text-muted animate-fade-in" style={{ marginTop: '24px' }}>
                No spells were detected in the log.
            </div>
        );
    }

    // Extract the base spell name (without aura info)
    const getBaseSpellName = (spellName: string) => {
        const idx = spellName.indexOf(' (Active Auras:');
        return idx > -1 ? spellName.substring(0, idx) : spellName;
    };

    return (
        <div className="card animate-fade-in" style={{ marginTop: '24px' }}>
            <details open={isOpen} onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}>
                <summary style={{
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    padding: '4px 0',
                    listStyle: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <span style={{
                        display: 'inline-block',
                        transition: 'transform 0.2s ease',
                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}>
                        ▶
                    </span>
                    Raw Spell Casting Log ({timeline.length} casts)
                </summary>

                <div style={{ position: 'relative', paddingLeft: '24px', marginTop: '16px' }}>
                    {/* Vertical line connecting the dots */}
                    <div style={{
                        position: 'absolute',
                        top: '12px',
                        bottom: '12px',
                        left: '9px',
                        width: '2px',
                        background: 'var(--color-border)',
                        zIndex: 0
                    }} />

                    {timeline.map((event, i) => {
                        const iconUrl = iconMap ? iconMap[event.spellId] : undefined;
                        const baseName = getBaseSpellName(event.spellName);

                        return (
                            <div key={i} className="flex items-center gap-md" style={{ marginBottom: '12px', position: 'relative', zIndex: 1 }}>
                                {/* The Dot or Icon */}
                                {iconUrl ? (
                                    <img
                                        src={iconUrl}
                                        alt={baseName}
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '3px',
                                            marginLeft: '-15px',
                                            flexShrink: 0,
                                            border: '1px solid var(--color-border)',
                                        }}
                                        loading="lazy"
                                    />
                                ) : (
                                    <div style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        background: 'var(--color-primary)',
                                        boxShadow: 'var(--glow-primary)',
                                        flexShrink: 0,
                                        marginLeft: '-19px',
                                    }} />
                                )}

                                <div style={{
                                    background: 'var(--color-bg-base)',
                                    padding: '6px 12px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    flex: 1,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '0.85rem',
                                }}>
                                    <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{event.spellName}</span>
                                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>{event.timestamp}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </details>
        </div>
    );
}
