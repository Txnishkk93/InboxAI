'use client';

import { useState } from 'react';
import { emitReticleSignal } from '@/app/reticle-dev';

type Recommendation = {
  id: string;
  title: string;
  description: string;
  severity: string;
  confidence: number;
  category: string;
  status: string;
  relatedCheckIds?: any;
};

type Check = {
  id: string;
  checkType: string;
  status: string;
};

export function RecommendationsList({
  workspaceId,
  domainId,
  initialRecommendations,
  checks = [],
  showActions = true,
}: {
  workspaceId: string;
  domainId: string;
  initialRecommendations: Recommendation[];
  checks?: Check[];
  showActions?: boolean;
}) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>(initialRecommendations);
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  async function toggleExplanation(recommendation: Recommendation) {
    if (expandedRecId === recommendation.id) {
      setExpandedRecId(null);
      return;
    }

    setExpandedRecId(recommendation.id);

    if (explanations[recommendation.id]) return;

    setLoadingMap((prev) => ({ ...prev, [recommendation.id]: true }));

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/domains/${domainId}/explanation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: recommendation.title,
          description: recommendation.description,
          severity: recommendation.severity,
          relatedChecks: checks
            .filter((c) => recommendation.relatedCheckIds?.includes(c.id))
            .map((c) => ({ checkType: c.checkType, status: c.status })),
        }),
      });

      if (!response.ok) throw new Error();
      const data = await response.json();
      setExplanations((prev) => ({ ...prev, [recommendation.id]: data.explanation }));
    } catch {
      setExplanations((prev) => ({ ...prev, [recommendation.id]: 'Failed to generate diagnostic explanation.' }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [recommendation.id]: false }));
    }
  }

  async function updateRecommendation(recommendationId: string, status: string) {
    await fetch(`/api/workspaces/${workspaceId}/recommendations/${recommendationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setRecommendations((prev) =>
      prev.map((rec) => (rec.id === recommendationId ? { ...rec, status } : rec))
    );
    
    // Emit signal based on status
    if (status === 'resolved') {
      await emitReticleSignal('recommendation:resolved', { recommendationId });
    } else if (status === 'dismissed') {
      await emitReticleSignal('recommendation:dismissed', { recommendationId });
    }
  }

  function renderExplanation(text: string) {
    const lines = text.split('\n');
    const sections: { title: string; content: string }[] = [];

    let currentTitle = '';
    let currentContent = '';

    for (const line of lines) {
      const match = line.match(/^(What's wrong|Why it matters|What to do next)[:\-\s]*(.*)/i);
      if (match) {
        if (currentTitle) {
          sections.push({ title: currentTitle, content: currentContent.trim() });
        }
        currentTitle = match[1];
        currentContent = match[2];
      } else {
        if (currentTitle) {
          currentContent += '\n' + line;
        } else {
          currentContent += line;
        }
      }
    }
    if (currentTitle) {
      sections.push({ title: currentTitle, content: currentContent.trim() });
    }

    if (sections.length === 0) {
      return <p className="text-sm text-ink-muted leading-relaxed font-sans">{text}</p>;
    }

    return (
      <div className="grid gap-4 mt-3 md:grid-cols-3 font-sans">
        {sections.map((sec) => (
          <div key={sec.title} className="rounded border border-border bg-surface p-4">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-ink-muted">
              {sec.title}
            </p>
            <p className="mt-2 text-sm text-ink leading-relaxed font-sans whitespace-pre-wrap">
              {sec.content}
            </p>
          </div>
        ))}
      </div>
    );
  }

  const activeRecs = recommendations.filter((r) => r.status !== 'dismissed');

  if (activeRecs.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm font-mono text-ink-muted">ALL DIAGNOSTIC RECOMMANDATIONS CAUGHT UP</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeRecs.map((recommendation) => {
        const isExpanded = expandedRecId === recommendation.id;
        const explanation = explanations[recommendation.id];
        const isLoading = loadingMap[recommendation.id];

        const isCritical = recommendation.severity === 'critical';
        const isWarning = recommendation.severity === 'high' || recommendation.severity === 'medium';

        return (
          <div
            key={recommendation.id}
            data-testid="recommendation-card"
            className={`rounded-xl border bg-surface transition-all duration-150 shadow-sm ${
              isCritical
                ? 'border-l-4 border-l-accent-critical border-border'
                : isWarning
                ? 'border-l-2 border-l-border-strong border-border'
                : 'border-l border-border'
            }`}
          >
            <div className="p-5 flex flex-wrap items-start justify-between gap-4 font-sans">
              <div className="space-y-2 flex-1 min-w-[280px]">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider ${
                    isCritical
                      ? 'text-accent-critical'
                      : 'text-ink-muted'
                  }`}>
                    {recommendation.severity}
                  </span>
                  <span className="text-xs text-ink-muted font-mono">CONFIDENCE: {recommendation.confidence}%</span>
                </div>
                <h5 className="font-serif text-lg font-normal text-ink leading-tight tracking-tight">
                  {recommendation.title}
                </h5>
                <p className="text-sm text-ink-muted leading-relaxed font-sans">
                  {recommendation.description}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => toggleExplanation(recommendation)}
                  className="rounded border border-border bg-surface-alt px-3.5 py-1.5 text-xs font-mono font-semibold tracking-wider uppercase text-ink-muted hover:text-ink hover:border-border-strong transition min-h-[44px]"
                >
                  {isExpanded ? 'Hide info' : 'Inspect details'}
                </button>
                {showActions && (
                  <>
                    <button
                      onClick={() => updateRecommendation(recommendation.id, 'resolved')}
                      className="rounded border border-border bg-surface-alt px-3.5 py-1.5 text-xs font-mono font-semibold tracking-wider uppercase text-ink hover:text-ink-muted transition min-h-[44px]"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => updateRecommendation(recommendation.id, 'dismissed')}
                      className="rounded border border-border bg-surface-alt px-3.5 py-1.5 text-xs font-mono font-semibold tracking-wider uppercase text-ink-muted hover:text-ink transition min-h-[44px]"
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>
            {isExpanded && (
              <div className="border-t border-border bg-surface-alt/40 p-5">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-xs font-mono text-ink-muted">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-transparent" />
                    COMPILING EXPLANATION RECORDS...
                  </div>
                ) : explanation ? (
                  renderExplanation(explanation)
                ) : (
                  <p className="text-xs font-mono text-ink-muted">No diagnostic record detailed.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
