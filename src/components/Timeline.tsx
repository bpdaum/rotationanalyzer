'use client';

import React from 'react';
import type { CombatEvent } from '@/lib/parser';

interface TimelineProps {
    timeline: CombatEvent[];
}

export function Timeline({ timeline }: TimelineProps) {
    if (timeline.length === 0) {
        return (
            <div className="card text-center text-muted animate-fade-in" style={{ marginTop: '24px' }}>
                No spells were detected in the log.
            </div>
        );
    }

    return (
        <div className="card animate-fade-in" style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Spell Casting Timeline</h3>

            <div style={{ position: 'relative', paddingLeft: '24px' }}>
                {/* Vertical line connecting the dots */}
                <div style={{
                    position: 'absolute',
                    top: '12px',
                    bottom: '12px',
                    left: '9px', // Center of the 10px dot
                    width: '2px',
                    background: 'var(--color-border)',
                    zIndex: 0
                }} />

                {timeline.map((event, i) => (
                    <div key={i} className="flex items-center gap-md" style={{ marginBottom: '16px', position: 'relative', zIndex: 1 }}>
                        {/* The Dot */}
                        <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: 'var(--color-primary)',
                            boxShadow: 'var(--glow-primary)',
                            flexShrink: 0,
                            marginLeft: '-19px', // align with the line
                        }} />

                        <div style={{ background: 'var(--color-bg-base)', padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{event.spellName}</span>
                            <span className="text-muted" style={{ fontSize: '0.85rem' }}>{event.timestamp}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
