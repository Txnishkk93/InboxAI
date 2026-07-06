'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Domain = { id: string; domainName: string };
type ScorePoint = { id: string; totalScore: number; calculatedAt: string };
type AlertMarker = { id: string; triggeredAt: string; type: string; severity: string; message: string };

export function HistoryDashboard({ workspaceId, domains }: { workspaceId: string; domains: Domain[] }) {
  const [selectedDomainId, setSelectedDomainId] = useState(domains[0]?.id ?? '');
  const [history, setHistory] = useState<ScorePoint[]>([]);
  const [alerts, setAlerts] = useState<AlertMarker[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedDomainId) void loadData(selectedDomainId);
  }, [selectedDomainId]);

  async function loadData(domainId: string) {
    setLoading(true);
    try {
      const [historyRes, alertsRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/domains/${domainId}/history`),
        fetch(`/api/workspaces/${workspaceId}/alerts?domainId=${domainId}`),
      ]);
      const historyData = await historyRes.json();
      const alertsData = await alertsRes.json();
      setHistory(historyData || []);
      setAlerts(alertsData || []);
    } catch (err) {
      console.error('Failed to load history trend diagnostics.', err);
    } finally {
      setLoading(false);
    }
  }

  if (domains.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-alt p-8 text-center font-sans">
        <p className="text-sm text-ink-muted">No domains available for history monitoring. Onboard a domain to start tracking progress.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans select-none">
      {/* Selection Control */}
      <div className="rounded-xl border border-border bg-surface-alt p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-serif font-normal text-ink tracking-tight">Audit Score History</h3>
            <p className="text-sm text-ink-muted mt-1 font-mono uppercase tracking-wider text-[11px]">Chronological trend of domain performance scores</p>
          </div>
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
        </div>
      </div>

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center border border-border rounded-xl bg-surface-alt">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink border-t-transparent mb-2" />
          <p className="text-xs font-mono text-ink-muted">RECALLING SCORE RECORDS LOG...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-alt p-8 text-center max-w-lg mx-auto">
          <p className="text-sm text-ink-muted">
            No score metrics compiled yet for this domain. Run a scan in Domain Health to initiate scores history logs.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Main Chart */}
          <div className="rounded-xl border border-border bg-surface-alt p-6">
            <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-6 border-b border-border pb-3">DIAGNOSTIC PERFORMANCE TREND</h4>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ left: -25, right: 10, top: 10, bottom: 0 }}>
                  <Line
                    type="monotone"
                    dataKey="totalScore"
                    stroke="var(--ink)"
                    strokeWidth={1.5}
                    dot={{ stroke: 'var(--border-strong)', strokeWidth: 1, r: 4, fill: 'var(--surface)' }}
                    activeDot={{ r: 5, fill: 'var(--ink)' }}
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
                  {alerts.map((alert) => (
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
            </div>
          </div>

          {/* Alerts feed */}
          <div className="rounded-xl border border-border bg-surface-alt p-6">
            <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-4 border-b border-border pb-3">ALERTS LOGFEED</h4>
            {alerts.length === 0 ? (
              <p className="text-xs font-mono text-ink-muted">0 CRITICAL REGRESSIONS LOGGED</p>
            ) : (
              <div className="divide-y divide-border/60">
                {alerts.map((alert) => {
                  const isCritical = alert.severity === 'critical' || alert.severity === 'high';
                  const dateStr = new Date(alert.triggeredAt).toLocaleDateString([], { month: 'short', day: '2-digit' }) + ' ' + new Date(alert.triggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={alert.id} className="py-3.5 flex items-start justify-between gap-4 font-mono text-xs">
                      <div className="space-y-1 select-text">
                        <div className="flex items-center gap-2">
                          <span className="text-ink-muted">[{dateStr}]</span>
                          <span className={`font-semibold uppercase tracking-wider ${isCritical ? 'text-accent-critical' : 'text-ink'}`}>
                            {alert.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-ink-muted font-sans text-sm leading-relaxed">{alert.message}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase flex-shrink-0 ${
                        isCritical ? 'bg-accent-critical/10 text-accent-critical border border-accent-critical/20' : 'bg-border/40 text-ink-muted border border-border'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
