'use client';

import { useState } from 'react';
import Link from 'next/link';

type DomainMetric = {
  id: string;
  domainName: string;
  status: string;
  createdAt: string;
  lastScanDate: string | null;
  recCount: number;
};

export function DomainsDashboard({
  workspaceId,
  initialDomains,
}: {
  workspaceId: string;
  initialDomains: DomainMetric[];
}) {
  const [domains, setDomains] = useState<DomainMetric[]>(initialDomains);
  const [showAddForm, setShowAddForm] = useState(false);
  const [domainName, setDomainName] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAddDomain(event: React.FormEvent) {
    event.preventDefault();
    if (!domainName.trim()) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainName: domainName.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add domain');
      }

      const newDomain: DomainMetric = {
        id: data.id,
        domainName: data.domainName,
        status: data.status || 'active',
        createdAt: data.createdAt,
        lastScanDate: null,
        recCount: 0,
      };

      setDomains((current) => [newDomain, ...current]);
      setDomainName('');
      setShowAddForm(false);
      setMessage('Domain added successfully.');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/domains/${confirmDeleteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete domain');
      }

      setDomains((current) => current.filter((d) => d.id !== confirmDeleteId));
      setMessage('Domain removed from active monitoring.');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setConfirmDeleteId(null);
      setLoading(false);
    }
  }

  function formatDate(isoString: string | null) {
    if (!isoString) return 'NEVER SCANNED';
    const d = new Date(isoString);
    return (
      d.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' }) +
      ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  }

  return (
    <div className="space-y-6 font-sans select-none">
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

      {/* Header card */}
      <div className="rounded-xl border border-border bg-surface-alt p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-serif font-normal text-ink tracking-tight">Monitored Domains</h3>
            <p className="text-sm text-ink-muted mt-1 font-mono uppercase tracking-wider text-[11px]">
              Manage the domains being monitored in the active workspace
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            data-testid="add-domain-btn"
            className="rounded-md bg-ink text-surface px-5 py-2 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95 border border-transparent"
          >
            {showAddForm ? 'Cancel Add' : 'Add Domain'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={handleAddDomain} className="rounded-xl border border-border bg-surface-alt p-6 space-y-4">
          <div>
            <h4 className="text-base font-semibold text-ink">Add a Domain</h4>
            <p className="text-xs text-ink-muted font-mono uppercase mt-0.5 tracking-wider">
              Register domain identity for diagnostic queries
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
              placeholder="example.com"
              className="flex-1 rounded-md border border-border bg-surface px-4 py-2.5 text-base text-ink font-mono focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px]"
            />
            <button
              type="submit"
              disabled={loading || !domainName.trim()}
              className="rounded-md bg-ink text-surface px-6 py-2.5 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95"
            >
              Add Domain
            </button>
          </div>
        </form>
      )}

      {/* Table / Empty State */}
      {domains.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-alt p-12 text-center max-w-xl mx-auto font-sans">
          <div className="h-10 w-10 rounded-full border-2 border-border-strong flex items-center justify-center font-mono text-ink-muted mx-auto">!</div>
          <h3 className="mt-4 text-lg font-serif text-ink tracking-tight">No domains yet</h3>
          <p className="mt-2 text-sm text-ink-muted leading-relaxed">
            No domains yet — add your first domain to start monitoring.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowAddForm(true)}
              className="rounded-md bg-ink text-surface px-5 py-2 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted active:scale-95"
            >
              Add Domain
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-alt p-6">
          <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-4 border-b border-border pb-3">
            DOMAINS MATRIX
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse select-text">
              <thead>
                <tr className="border-b border-border/80 font-mono text-xs uppercase text-ink-muted">
                  <th className="py-3 px-4 font-semibold">Domain Name</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Last Scan Date</th>
                  <th className="py-3 px-4 font-semibold">Open Recommendations</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((domain) => (
                  <tr
                    key={domain.id}
                    data-testid="domain-row"
                    className="border-b border-border/60 hover:bg-surface transition-colors duration-150 group cursor-pointer"
                  >
                    <td className="py-4 px-4 font-mono font-medium text-ink text-sm">
                      <Link
                        href={`/${workspaceId}/domain-health?domainId=${domain.id}`}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {domain.domainName}
                      </Link>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-2 text-xs font-mono">
                        <span className="h-2 w-2 rounded-full bg-ink" />
                        <span className="text-ink font-semibold uppercase">{domain.status}</span>
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-ink-muted">
                      {formatDate(domain.lastScanDate)}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm text-ink-muted">
                      {domain.recCount}
                    </td>
                    <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(domain.id)}
                        className="text-accent-critical font-bold uppercase tracking-wider text-xs hover:underline min-h-[44px] px-2"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm p-4">
          <div className="rounded-xl border border-border bg-surface-alt p-6 max-w-md w-full shadow-lg space-y-4">
            <div>
              <h4 className="text-base font-semibold text-ink font-serif tracking-tight">Confirm Deletion</h4>
              <p className="text-sm text-ink-muted mt-2 leading-relaxed">
                This will remove the domain from active monitoring but preserve its scan history.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded border border-border bg-surface-alt px-4 py-2 text-xs font-mono font-semibold uppercase text-ink-muted hover:text-ink hover:border-border-strong transition min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="rounded bg-accent-critical text-surface px-4 py-2 text-xs font-mono font-semibold uppercase hover:bg-accent-critical/90 transition min-h-[44px]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
