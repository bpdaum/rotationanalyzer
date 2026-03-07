'use client';

import React from 'react';
import type { AnalysisResult } from '@/lib/analyzer';

interface FeedbackProps {
    analysis: AnalysisResult;
}

export function Feedback({ analysis }: FeedbackProps) {
    const isPerfect = analysis.score === 100;

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

            {isPerfect ? (
                <p style={{ color: 'var(--color-success)', fontWeight: 500 }}>
                    Excellent work! Your rotation matches the highest priority abilities perfectly.
                </p>
            ) : (
                <div className="flex flex-col gap-sm">
                    {analysis.feedback.length > 0 ? (
                        analysis.feedback.map((fb, idx) => (
                            <div key={idx} style={{
                                padding: '12px',
                                borderRadius: 'var(--radius-sm)',
                                background: fb.type === 'error' ? 'rgba(192, 57, 43, 0.1)' : 'rgba(243, 156, 18, 0.1)',
                                borderLeft: `4px solid ${fb.type === 'error' ? 'var(--color-error)' : '#f39c12'}`,
                            }}>
                                <span style={{ fontWeight: 'bold', marginRight: '8px' }}>[{fb.timestamp}]</span>
                                <span>{fb.message}</span>
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
