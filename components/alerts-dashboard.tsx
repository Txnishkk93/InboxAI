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

export function AlertsDashboard({
  workspaceId,
  initialAlerts,
  domains,
}: {
  workspaceId: string;
  initialAlerts: AlertItem[];
  domains: DomainItem[];
}) {
  const [alerts] = useState<AlertItem[]>(initialAlerts);
  const [filterDomainId, setFilterDomainId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchDomain = !filterDomainId || alert.domainId === filterDomainId;
      const matchType = !filterType || alert.type === filterType;
      const matchSeverity = !filterSeverity || alert.severity === filterSeverity;
      return matchDomain && matchType && matchSeverity;
    });
  }, [alerts, filterDomainId, filterType, filterSeverity]);

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
    <div className="space-y-6 font-sans select-none">
      {/* Header card */}
      <div className="rounded-xl border border-border bg-surface-alt p-6">
        <h3 className="text-lg font-serif font-normal text-ink tracking-tight">Alert History</h3>
        <p className="text-sm text-ink-muted mt-1 font-mono uppercase tracking-wider text-[11px]">
          Workspace alerts log history and delivery details
        </p>
      </div>

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
    </div>
  );
}
