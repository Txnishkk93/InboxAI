'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { RecommendationsList } from './recommendations-list';

type Check = { id: string; checkType: string; status: string; rawValue?: string | null; parsedDetail?: any; createdAt: string };
type Domain = { id: string; domainName: string };
type Recommendation = { id: string; title: string; description: string; severity: string; confidence: number; category: string; status: string; relatedCheckIds?: any };
type ScorePoint = { id: string; totalScore: number; calculatedAt: string };
type AlertMarker = { id: string; triggeredAt: string; type: string; severity: string };

export function DnsDashboard({ workspaceId, domains }: { workspaceId: string; domains: Domain[] }) {
  const [selectedDomainId, setSelectedDomainId] = useState(domains[0]?.id ?? '');
  const [checks, setChecks] = useState<Check[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [history, setHistory] = useState<ScorePoint[]>([]);
  const [alertMarkers, setAlertMarkers] = useState<AlertMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanPending, setScanPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedDomainId) void loadData(selectedDomainId);
  }, [selectedDomainId]);

  async function loadData(domainId: string) {
    setLoading(true);
    try {
      const [checksRes, recRes, historyRes, alertsRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/domains/${domainId}/checks`),
        fetch(`/api/workspaces/${workspaceId}/recommendations?domainId=${domainId}`),
        fetch(`/api/workspaces/${workspaceId}/domains/${domainId}/history`),
        fetch(`/api/workspaces/${workspaceId}/alerts?domainId=${domainId}`),
      ]);
      const checksData = await checksRes.json();
      const recData = await recRes.json();
      const historyData = await historyRes.json();
      const alertsData = await alertsRes.json();
      setChecks(checksData || []);
      setRecommendations(recData || []);
      setHistory(historyData || []);
      setAlertMarkers(alertsData || []);
    } catch (err) {
      console.error('Failed to load DNS dashboard diagnostics data.', err);
    } finally {
      setLoading(false);
    }
  }

  async function scanNow() {
    if (!selectedDomainId) return;
    setScanPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/domains/${selectedDomainId}/scan`, { method: 'POST' });
      const data = await response.json();
      setMessage(data.duplicate ? 'Scan already in progress.' : 'Diagnostic scan complete.');
      if (response.ok) await loadData(selectedDomainId);
    } catch {
      setMessage('Error running scan.');
    } finally {
      setScanPending(false);
    }
  }

  if (domains.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-alt p-8 text-center font-sans">
        <p className="text-sm text-ink-muted">No domains available for checks. Add a domain in Settings to begin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans select-none">
      {message ? (
        <div className="rounded-md border border-border bg-surface-alt px-4 py-3 text-sm text-ink font-mono tracking-tight flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-ink-muted hover:text-ink font-semibold">&times;</button>
        </div>
      ) : null}

      {/* Control bar */}
      <div className="rounded-xl border border-border bg-surface-alt p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-serif font-normal text-ink tracking-tight">DNS Diagnostics</h3>
            <p className="text-sm text-ink-muted mt-1 font-mono uppercase tracking-wider text-[11px]">Compile and audit live domain records</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedDomainId}
              onChange={(event) => setSelectedDomainId(event.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px] cursor-pointer"
            >
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.domainName}
                </option>
              ))}
            </select>
            <button
              onClick={scanNow}
              disabled={scanPending || loading}
              className="relative rounded-md bg-ink text-surface px-5 py-2 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95 border border-transparent overflow-hidden"
            >
              {scanPending ? 'Scanning...' : 'Rescan Records'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center border border-border rounded-xl bg-surface-alt">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink border-t-transparent mb-2" />
          <p className="text-xs font-mono text-ink-muted">RECALLING RECORD DIAGNOSTICS...</p>
        </div>
      ) : (
        <>
          {/* Main diagnostics & chart layout */}
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            {/* Checks Monospace Table */}
            <div className="rounded-xl border border-border bg-surface-alt p-6">
              <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-4 border-b border-border pb-3">DIAGNOSTIC MATRIX</h4>
              
              {checks.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-ink-muted">No diagnostic record checks found. Run a rescan to start auditing.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse select-text">
                    <thead>
                      <tr className="border-b border-border/80 font-mono text-xs uppercase text-ink-muted">
                        <th className="py-3 px-4 font-semibold">Diagnostic</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checks.map((check) => {
                        const isExpanded = expandedCheckId === check.id;
                        return (
                          <>
                            <tr key={check.id} className="border-b border-border/60 hover:bg-surface transition-colors duration-150 group">
                              <td className="py-4 px-4 font-mono font-medium text-ink text-sm uppercase">
                                {check.checkType}
                              </td>
                              <td className="py-4 px-4">
                                <span className="inline-flex items-center gap-2 text-xs font-mono">
                                  {check.status === 'pass' && (
                                    <>
                                      <span className="h-2 w-2 rounded-full bg-ink" />
                                      <span className="text-ink font-semibold">PASS</span>
                                    </>
                                  )}
                                  {check.status === 'warn' && (
                                    <>
                                      <span className="h-2.5 w-2.5 bg-surface border-2 border-border-strong rotate-45 flex-shrink-0" />
                                      <span className="text-ink-muted font-bold">WARN</span>
                                    </>
                                  )}
                                  {check.status === 'fail' && (
                                    <>
                                      <span className="h-2 w-2 bg-accent-critical flex-shrink-0" />
                                      <span className="text-accent-critical font-bold">FAIL</span>
                                    </>
                                  )}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <button
                                  onClick={() => setExpandedCheckId(isExpanded ? null : check.id)}
                                  className="font-mono text-xs text-ink-muted hover:text-ink hover:underline transition"
                                >
                                  {isExpanded ? 'Hide Raw Record' : 'Inspect Raw Record'}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={3} className="bg-surface px-6 py-4 border-b border-border">
                                  <div className="rounded-md border border-border bg-surface-alt p-4 overflow-x-auto">
                                    <pre className="font-mono text-[13px] text-ink leading-relaxed whitespace-pre-wrap">
                                      {check.rawValue ?? 'No record value returned from query.'}
                                    </pre>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Score History Graph */}
            <div className="rounded-xl border border-border bg-surface-alt p-6 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-4 border-b border-border pb-3">SCORE TREND</h4>
                <div className="h-56 mt-4">
                  {history.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-xs font-mono text-ink-muted">NO SCORE COMPILED YET</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history} margin={{ left: -25, right: 10, top: 10, bottom: 0 }}>
                        <Line
                          type="monotone"
                          dataKey="totalScore"
                          stroke="var(--ink)"
                          strokeWidth={1.5}
                          dot={{ stroke: 'var(--border-strong)', strokeWidth: 1, r: 3.5, fill: 'var(--surface)' }}
                          activeDot={{ r: 4, fill: 'var(--ink)' }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'var(--ink-muted)', fontSize: 11, fontFamily: 'var(--font-ibm-plex-mono)' }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface-alt)',
                            border: '1px solid var(--border)',
                            fontFamily: 'var(--font-ibm-plex-mono)',
                            fontSize: 11,
                            color: 'var(--ink)',
                            borderRadius: '4px',
                          }}
                        />
                        {alertMarkers.map((alert) => (
                          <line
                            key={alert.id}
                            x1={new Date(alert.triggeredAt).getTime()}
                            x2={new Date(alert.triggeredAt).getTime()}
                            y1={0}
                            y2={100}
                            stroke="var(--accent-critical)"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="mt-6 text-xs font-mono text-ink-muted leading-relaxed">
                * Score history points represent compiled checks over time. Dotted markers identify high-priority event alerts.
              </div>
            </div>
          </div>

          {/* Recommendations Block */}
          <div className="rounded-xl border border-border bg-surface-alt p-6">
            <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-4 border-b border-border pb-3">REMEDIAL RECOMMENDATIONS</h4>
            <RecommendationsList
              key={selectedDomainId + '-' + recommendations.length}
              workspaceId={workspaceId}
              domainId={selectedDomainId}
              initialRecommendations={recommendations}
              checks={checks}
              showActions={true}
            />
          </div>
        </>
      )}
    </div>
  );
}
