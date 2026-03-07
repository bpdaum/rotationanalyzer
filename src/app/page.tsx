'use client';

import React, { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { Timeline } from '@/components/Timeline';
import { Feedback } from '@/components/Feedback';
import type { CombatEvent } from '@/lib/parser';
import type { ScrapedRotation } from '@/lib/scraper';
import type { AnalysisResult } from '@/lib/analyzer';

interface AnalysisPayload {
  analysis: AnalysisResult;
  timeline: CombatEvent[];
  rotation: ScrapedRotation;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<AnalysisPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (file: File, classSlug: string, specSlug: string, heroSpec: string, combatType: string) => {
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const formData = new FormData();
      formData.append('logFile', file);
      formData.append('classSlug', classSlug);
      formData.append('specSlug', specSlug);
      formData.append('heroSpec', heroSpec);
      formData.append('combatType', combatType);

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
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container" style={{ padding: '40px 24px' }}>
      <header className="text-center" style={{ marginBottom: '40px' }}>
        <h1 className="text-gradient" style={{ display: 'inline-block' }}>WoW Rotation Analyzer</h1>
        <p className="text-muted" style={{ fontSize: '1.125rem', maxWidth: '600px', margin: '0 auto', marginTop: '8px' }}>
          Evaluate your target dummy performance against optimal community priority lists.
        </p>
      </header>

      <FileUpload onAnalyze={handleAnalyze} isLoading={isLoading} />

      {error && (
        <div className="card animate-fade-in" style={{ marginTop: '24px', borderColor: 'var(--color-error)', background: 'rgba(192, 57, 43, 0.1)' }}>
          <p style={{ color: 'var(--color-error)', margin: 0, fontWeight: 500 }}>{error}</p>
        </div>
      )}

      {data && (
        <div className="animate-fade-in" style={{ marginTop: '40px' }}>
          <hr style={{ borderColor: 'var(--color-border)', margin: '40px 0' }} />

          <div className="flex flex-col gap-lg" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="flex justify-between items-center text-muted" style={{ textTransform: 'capitalize' }}>
              <h2>Results for {data.rotation.specSlug} {data.rotation.classSlug}</h2>
            </div>

            <Feedback analysis={data.analysis} />
            <Timeline timeline={data.timeline} />
          </div>
        </div>
      )}
    </main>
  );
}
