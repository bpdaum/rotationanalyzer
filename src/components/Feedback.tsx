'use client';

import React from 'react';
import type { AnalysisResult, AnalysisFeedback } from '@/lib/analyzer';
import type { CombatEvent } from '@/lib/parser';

interface FeedbackProps {
    analysis: AnalysisResult;
    timeline?: CombatEvent[];
    iconMap?: Record<number, string>;
    onFeedbackClick?: (timelineIndex: number) => void;
}

export function Feedback({ analysis, timeline, iconMap, onFeedbackClick }: FeedbackProps) {
    const isPerfect = analysis.score === 100;

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'error': return '#c0392b';
            case 'warning': return '#f39c12';
            case 'info': return '#3498db';
            case 'good': return '#27ae60';
            default: return 'var(--color-text-muted)';
        }
    };

    const getTypeBg = (type: string) => {
        switch (type) {
            case 'error': return 'rgba(192, 57, 43, 0.1)';
            case 'warning': return 'rgba(243, 156, 18, 0.1)';
            case 'info': return 'rgba(52, 152, 219, 0.1)';
            case 'good': return 'rgba(39, 174, 96, 0.1)';
            default: return 'var(--color-bg-elevated)';
        }
    };

    return (
        <div className="card animate-fade-in" style={{ marginTop: '24px', borderColor: isPerfect ? 'var(--color-success)' : 'var(--color-border)' }}>
            <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Analysis Overview</h2>
                <div style={{
                    background: isPerfect ? 'rgba(39, 174, 96, 0.1)' : 'var(--color-bg-elevated)',
                    color: isPerfect ? 'var(--color-success)' : 'var(--color-primary)',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 'bold',
                    fontSize: '1.25rem'
                }}>
                    Score: {analysis.score} / 100
                </div>
            </div>

            {analysis.tldr && (
                <div style={{
                    marginBottom: '20px',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--color-border)',
                }}>
                    <h3 style={{ marginTop: 0, marginBottom: '8px', color: 'var(--color-primary)', fontSize: '1.1rem' }}>
                        TL;DR
                    </h3>
                    <p style={{ margin: 0, color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                        {analysis.tldr}
                    </p>
                </div>
            )}

            {isPerfect ? (
                <p style={{ color: 'var(--color-success)', fontWeight: 500 }}>
                    Excellent work! Your rotation matches the highest priority abilities perfectly.
                </p>
            ) : (
                <div className="flex flex-col gap-sm">
                    {analysis.feedback.length > 0 ? (
                        analysis.feedback.map((fb, idx) => (
                            <div
                                key={idx}
                                style={{
                                    padding: '12px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: getTypeBg(fb.type),
                                    borderLeft: `4px solid ${getTypeColor(fb.type)}`,
                                    cursor: fb.timelineIndex !== undefined && fb.timelineIndex >= 0 ? 'pointer' : 'default',
                                    transition: 'all 0.15s ease',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '12px',
                                }}
                                onClick={() => {
                                    if (fb.timelineIndex !== undefined && fb.timelineIndex >= 0 && onFeedbackClick) {
                                        onFeedbackClick(fb.timelineIndex);
                                    }
                                }}
                                onMouseEnter={(e) => {
                                    if (fb.timelineIndex !== undefined && fb.timelineIndex >= 0) {
                                        (e.currentTarget as HTMLDivElement).style.transform = 'translateX(4px)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLDivElement).style.transform = 'translateX(0)';
                                }}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            color: getTypeColor(fb.type),
                                            letterSpacing: '0.05em',
                                        }}>
                                            {fb.type}
                                        </span>
                                        <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                            [{fb.timestamp}]
                                        </span>
                                        {fb.spellName && (
                                            <span style={{
                                                fontSize: '0.8rem',
                                                color: 'var(--color-primary)',
                                                fontWeight: 600,
                                            }}>
                                                {fb.spellName}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', marginBottom: fb.sourceQuote ? '4px' : '0' }}>{fb.message}</div>
                                    {fb.sourceQuote && (
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--color-text-muted)',
                                            fontStyle: 'italic',
                                            paddingLeft: '12px',
                                            borderLeft: '2px solid var(--color-border)',
                                            marginTop: '4px',
                                            marginBottom: '8px',
                                        }}>
                                            &quot;{fb.sourceQuote}&quot;
                                        </div>
                                    )}
                                    {fb.timelineIndex !== undefined && fb.timelineIndex >= 0 && timeline && (
                                        <div style={{ marginTop: '12px', marginBottom: '8px' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Actual Sequence:</div>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                {(() => {
                                                    const start = Math.max(0, fb.timelineIndex! - 2);
                                                    const end = Math.min(timeline.length - 1, fb.timelineIndex! + 1);
                                                    const slice = timeline.slice(start, end + 1);
                                                    return slice.map((event, sIdx) => {
                                                        const isTarget = (start + sIdx === fb.timelineIndex);
                                                        const src = iconMap?.[event.spellId];
                                                        return (
                                                            <React.Fragment key={sIdx}>
                                                                {sIdx > 0 && <span style={{ color: 'var(--color-border)' }}>→</span>}
                                                                <div style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    padding: '4px 8px',
                                                                    background: isTarget ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.2)',
                                                                    border: isTarget ? `1px solid ${getTypeColor(fb.type)}` : '1px solid var(--color-border)',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                }}>
                                                                    {src ? (
                                                                        <img src={src} alt={event.spellName} style={{ width: '16px', height: '16px', borderRadius: '4px' }} />
                                                                    ) : (
                                                                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'var(--color-border)' }} />
                                                                    )}
                                                                    <span style={{ fontSize: '0.75rem', color: isTarget ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                                                                        {event.spellName}
                                                                    </span>
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                    {fb.correctSequence && fb.correctSequence.length > 0 && (
                                        <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Expected Sequence:</span>
                                            {fb.correctSequence.map((spell, si) => (
                                                <span key={si} style={{
                                                    fontSize: '0.75rem',
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
                                    )}
                                </div>
                                {fb.timelineIndex !== undefined && fb.timelineIndex >= 0 && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                        Cast #{fb.timelineIndex + 1} →
                                    </span>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-muted">No specific feedback points found.</p>
                    )}
                </div>
            )}

            {analysis.missingSpells.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                    <h4 style={{ color: 'var(--color-error)', marginBottom: '8px' }}>Missing Priority Spells:</h4>
                    <ul style={{ paddingLeft: '20px', color: 'var(--color-text-muted)' }}>
                        {analysis.missingSpells.map((spell, i) => <li key={i}>{spell}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
}
