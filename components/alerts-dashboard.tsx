'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

type AlertItem = {
  id: string;
  domainId: string;
  domainName: string;
  type: string;
  severity: string;
  message: string;
  triggeredAt: string;
  channel: string;
  status: string;
  deliveredAt: string | null;
  dedupeKey: string;
};

type DomainItem = {
  id: string;
  domainName: string;
};

type AlertRules = {
  blacklistAlert: boolean;
  dnsAlert: boolean;
  placementDropAlert: boolean;
  placementThreshold: number;
  dmarcAlert: boolean;
};

export function AlertsDashboard({
  workspaceId,
  initialAlerts,
  domains,
  initialRules,
}: {
  workspaceId: string;
  initialAlerts: AlertItem[];
  domains: DomainItem[];
  initialRules: AlertRules;
}) {
  const [alerts] = useState<AlertItem[]>(initialAlerts);
  const [activeTab, setActiveTab] = useState<'history' | 'rules'>('history');

  // Filter States
  const [filterDomainId, setFilterDomainId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  // Rules States
  const [rules, setRules] = useState<AlertRules>(initialRules);
  const [saving, setSaving] = useState(false);

  // Message States
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchDomain = !filterDomainId || alert.domainId === filterDomainId;
      const matchType = !filterType || alert.type === filterType;
      const matchSeverity = !filterSeverity || alert.severity === filterSeverity;
      return matchDomain && matchType && matchSeverity;
    });
  }, [alerts, filterDomainId, filterType, filterSeverity]);

  async function handleSaveRules(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/settings/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update alert rules.');
      }

      setRules(data);
      setMessage('Alert threshold rules updated successfully.');
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  }

  function formatDate(isoString: string) {
    const d = new Date(isoString);
    return (
      d.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' }) +
      ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  }

  function formatType(val: string) {
    return val.replace(/_/g, ' ').toUpperCase();
  }

  function renderSeverity(severity: string) {
    const isCritical = severity === 'critical';
    return (
      <span
        className={`text-[11px] font-mono uppercase tracking-wider ${
          isCritical ? 'text-accent-critical font-bold' : 'text-ink-muted'
        }`}
      >
        {severity}
      </span>
    );
  }

  function renderStatus(status: string) {
    const isFailed = status === 'failed';
    const isSuppressed = status === 'suppressed';
    if (isFailed) {
      return <span className="text-accent-critical font-bold font-mono text-xs uppercase">FAILED</span>;
    }
    if (isSuppressed) {
      return <span className="text-ink-muted text-[10px] font-mono uppercase">SUPPRESSED</span>;
    }
    return <span className="text-ink-muted font-mono text-xs uppercase">{status}</span>;
  }

  return (
    <div className="space-y-6 font-sans select-none animate-bento [animation-delay:100ms]">
      {message ? (
        <div className="rounded-md border border-border bg-surface-alt px-4 py-3 text-sm text-ink font-mono tracking-tight flex items-center justify-between">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage(null)} className="text-ink-muted hover:text-ink font-semibold">&times;</button>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-accent-critical/20 bg-surface px-4 py-3 text-sm text-accent-critical font-mono tracking-tight flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-accent-critical hover:text-accent-critical/80 font-semibold">&times;</button>
        </div>
      ) : null}

      {/* Header and Tabs */}
      <div className="rounded-xl border border-border bg-surface-alt p-6 space-y-4">
        <div>
          <h3 className="text-lg font-serif font-normal text-ink tracking-tight">Alert Notifications</h3>
          <p className="text-sm text-ink-muted mt-1 font-mono uppercase tracking-wider text-[11px]">
            View incident history records and configure trigger thresholds
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-border/60 pt-2 gap-6">
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 text-sm font-semibold transition-colors duration-150 relative ${
              activeTab === 'history'
                ? 'text-ink border-b-2 border-border-strong'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Alert History
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`pb-2.5 text-sm font-semibold transition-colors duration-150 relative ${
              activeTab === 'rules'
                ? 'text-ink border-b-2 border-border-strong'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Configure Rules
          </button>
        </div>
      </div>

      {activeTab === 'history' ? (
        <>
          {/* Filter controls */}
          <div className="rounded-xl border border-border bg-surface-alt p-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-muted">Filter by Domain</label>
                <select
                  value={filterDomainId}
                  onChange={(e) => setFilterDomainId(e.target.value)}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px] cursor-pointer"
                >
                  <option value="">All Domains</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.domainName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-muted">Filter by Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px] cursor-pointer"
                >
                  <option value="">All Types</option>
                  <option value="score_drop">Score Drop</option>
                  <option value="placement_drop">Placement Drop</option>
                  <option value="dns_check_failed">DNS Check Failed</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-muted">Filter by Severity</label>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px] cursor-pointer"
                >
                  <option value="">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table / Empty State */}
          {filteredAlerts.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface-alt p-12 text-center max-w-xl mx-auto font-sans">
              <div className="h-10 w-10 rounded-full border-2 border-border-strong flex items-center justify-center font-mono text-ink-muted mx-auto">!</div>
              <h3 className="mt-4 text-lg font-serif text-ink tracking-tight">No alerts found</h3>
              <p className="mt-2 text-sm text-ink-muted leading-relaxed">
                No alerts yet — you'll be notified here if a score drops, placement worsens, or a DNS check fails.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface-alt p-6">
              <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-4 border-b border-border pb-3">
                ALERTS FEED
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse select-text">
                  <thead>
                    <tr className="border-b border-border/80 font-mono text-xs uppercase text-ink-muted">
                      <th className="py-3 px-4 font-semibold">Timestamp</th>
                      <th className="py-3 px-4 font-semibold">Domain</th>
                      <th className="py-3 px-4 font-semibold">Alert Type</th>
                      <th className="py-3 px-4 font-semibold">Severity</th>
                      <th className="py-3 px-4 font-semibold">Message</th>
                      <th className="py-3 px-4 font-semibold text-right">Delivery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.map((alert) => (
                      <tr
                        key={alert.id}
                        className="border-b border-border/60 hover:bg-surface transition-colors duration-150 group font-sans text-sm"
                      >
                        <td className="py-4 px-4 font-mono text-xs text-ink-muted whitespace-nowrap">
                          {formatDate(alert.triggeredAt)}
                        </td>
                        <td className="py-4 px-4 font-mono text-xs">
                          <Link
                            href={`/${workspaceId}/domain-health?domainId=${alert.domainId}`}
                            className="hover:underline text-ink hover:text-ink-muted transition"
                          >
                            {alert.domainName}
                          </Link>
                        </td>
                        <td className="py-4 px-4 font-mono text-xs font-medium text-ink">
                          {formatType(alert.type)}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          {renderSeverity(alert.severity)}
                        </td>
                        <td className="py-4 px-4 text-ink-muted leading-relaxed">
                          {alert.message}
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          {renderStatus(alert.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Rules Settings Tab */
        <form onSubmit={handleSaveRules} className="rounded-xl border border-border bg-surface-alt p-6 space-y-6">
          <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted border-b border-border pb-3">
            ALERT THRESHOLD CONFIGURATION
          </h4>

          <div className="space-y-4 font-sans text-sm">
            {/* Rule: Blacklist */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rules.blacklistAlert}
                onChange={(e) => setRules({ ...rules, blacklistAlert: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-border text-ink focus:ring-ink"
              />
              <div>
                <span className="font-semibold text-ink">Blacklist RBL Detections</span>
                <p className="text-xs text-ink-muted mt-0.5">Trigger alerts immediately if any monitored domain is logged on major IP blocklists.</p>
              </div>
            </label>

            {/* Rule: DNS */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rules.dnsAlert}
                onChange={(e) => setRules({ ...rules, dnsAlert: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-border text-ink focus:ring-ink"
              />
              <div>
                <span className="font-semibold text-ink">DNS Record Degradations</span>
                <p className="text-xs text-ink-muted mt-0.5">Alert if SPF, DKIM, DMARC, or MX configuration checks transition to warning/failure states.</p>
              </div>
            </label>

            {/* Rule: DMARC Failures */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rules.dmarcAlert}
                onChange={(e) => setRules({ ...rules, dmarcAlert: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-border text-ink focus:ring-ink"
              />
              <div>
                <span className="font-semibold text-ink">DMARC Policy Failure Spikes</span>
                <p className="text-xs text-ink-muted mt-0.5">Send alerts if alignment fail rates exceed standard verification thresholds.</p>
              </div>
            </label>

            {/* Rule: Placement Drop */}
            <div className="border-t border-border pt-4 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rules.placementDropAlert}
                  onChange={(e) => setRules({ ...rules, placementDropAlert: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-border text-ink focus:ring-ink"
                />
                <div>
                  <span className="font-semibold text-ink">Inbox Placement Drop Alerts</span>
                  <p className="text-xs text-ink-muted mt-0.5">Notify the workspace if seed deliverability indicators sink below target boundaries.</p>
                </div>
              </label>

              {rules.placementDropAlert && (
                <div className="pl-7 space-y-1.5 max-w-xs">
                  <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-ink-muted">
                    Min Placement Threshold (%)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={rules.placementThreshold}
                    onChange={(e) => setRules({ ...rules, placementThreshold: Number(e.target.value) })}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px]"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-ink text-surface px-6 py-2.5 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95 border border-transparent"
            >
              {saving ? 'Saving Alert Rules...' : 'Save Rules'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
