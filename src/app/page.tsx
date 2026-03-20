'use client';

import React, { useState, useCallback } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { VisualTimeline } from '@/components/VisualTimeline';
import { Timeline } from '@/components/Timeline';
import { Feedback } from '@/components/Feedback';
import type { CombatEvent, AuraTrackEvent } from '@/lib/parser';
import type { ScrapedRotation } from '@/lib/guide-data';
import type { AnalysisResult } from '@/lib/analyzer';

interface AnalysisPayload {
  analysis: AnalysisResult;
  timeline: CombatEvent[];
  auraTracks: AuraTrackEvent[];
  rotation: ScrapedRotation;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [data, setData] = useState<AnalysisPayload | null>(null);
  const [iconMap, setIconMap] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (file: File, classSlug: string, specSlug: string, heroSpec: string, combatType: string, region: string, realm: string, characterName: string) => {
    setIsLoading(true);
    setError(null);
    setData(null);
    setIconMap({});

    try {
      setLoadingStatus('Analyzing rotation...');
      const formData = new FormData();
      formData.append('logFile', file);
      formData.append('classSlug', classSlug);
      formData.append('specSlug', specSlug);
      formData.append('heroSpec', heroSpec);
      formData.append('combatType', combatType);

      if (region) formData.append('region', region);
      if (realm) formData.append('realm', realm);
      if (characterName) formData.append('characterName', characterName);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        const msg = errData.details ? `${errData.error}: ${errData.details}` : (errData.error || 'Failed to analyze log.');
        throw new Error(msg);
      }

      const result = await res.json();
      setData(result.data);

      // Resolve spell icons in the background
      if (result.data?.timeline?.length > 0) {
        setLoadingStatus('Loading spell icons...');
        const spellIds = [...new Set(result.data.timeline.map((e: CombatEvent) => e.spellId).filter(Boolean))];
        if (spellIds.length > 0) {
          try {
            const iconRes = await fetch('/api/icons', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ spellIds }),
            });
            if (iconRes.ok) {
              const iconData = await iconRes.json();
              setIconMap(iconData.iconMap || {});
            }
          } catch (iconErr) {
            console.warn('Failed to load spell icons:', iconErr);
            // Non-critical, continue without icons
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const handleFeedbackClick = useCallback((timelineIndex: number) => {
    const el = document.getElementById(`vt-cast-${timelineIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      // Flash the icon
      const iconEl = el.querySelector('.spell-icon-container') as HTMLElement;
      if (iconEl) {
        iconEl.style.transform = 'scale(1.4)';
        setTimeout(() => { iconEl.style.transform = 'scale(1)'; }, 600);
      }
    }
  }, []);

  return (
    <main className="container" style={{ padding: '40px 24px' }}>
      <header className="text-center" style={{ marginBottom: '40px' }}>
        <h1 className="text-gradient" style={{ display: 'inline-block' }}>WoW Rotation Analyzer</h1>
        <p className="text-muted" style={{ fontSize: '1.125rem', maxWidth: '600px', margin: '0 auto', marginTop: '8px' }}>
          Evaluate your target dummy performance against optimal community priority lists.
        </p>
      </header>

      <FileUpload onAnalyze={handleAnalyze} isLoading={isLoading} />

      {isLoading && loadingStatus && (
        <div className="card animate-fade-in" style={{ marginTop: '24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <div className="loading-spinner" />
            <span className="text-muted">{loadingStatus}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="card animate-fade-in" style={{ marginTop: '24px', borderColor: 'var(--color-error)', background: 'rgba(192, 57, 43, 0.1)' }}>
          <p style={{ color: 'var(--color-error)', margin: 0, fontWeight: 500 }}>{error}</p>
        </div>
      )}

      {data && (
        <div className="animate-fade-in" style={{ marginTop: '40px' }}>
          <hr style={{ borderColor: 'var(--color-border)', margin: '40px 0' }} />

          <div className="flex flex-col gap-lg" style={{ maxWidth: '100%', margin: '0 auto' }}>
            <div className="flex justify-between items-center text-muted" style={{ textTransform: 'capitalize' }}>
              <h2>Results for {data.rotation.specSlug} {data.rotation.classSlug}</h2>
            </div>

            <Feedback
              analysis={data.analysis}
              timeline={data.timeline}
              iconMap={iconMap}
              onFeedbackClick={handleFeedbackClick}
            />
            <VisualTimeline
              timeline={data.timeline}
              auraTracks={data.auraTracks}
              feedback={data.analysis.feedback}
              iconMap={iconMap}
            />
            <Timeline timeline={data.timeline} iconMap={iconMap} />
          </div>
        </div>
      )}
    </main>
  );
}
