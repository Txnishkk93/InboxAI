'use client';

import { useState } from 'react';
import Link from 'next/link';

type MailboxItem = {
  id: string;
  senderEmail: string;
  provider: string;
  createdAt: string;
  domainName: string;
  domainId: string;
};

type DomainItem = {
  id: string;
  domainName: string;
};

export function MailboxesDashboard({
  workspaceId,
  initialMailboxes,
  domains,
}: {
  workspaceId: string;
  initialMailboxes: MailboxItem[];
  domains: DomainItem[];
}) {
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>(initialMailboxes);
  const [showAddForm, setShowAddForm] = useState(false);
  const [senderEmail, setSenderEmail] = useState('');
  const [domainId, setDomainId] = useState('');
  const [provider, setProvider] = useState('google');
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAddMailbox(event: React.FormEvent) {
    event.preventDefault();
    if (!senderEmail.trim() || !domainId || !provider) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/mailboxes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderEmail: senderEmail.trim(),
          domainId,
          provider,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add mailbox');
      }

      const domain = domains.find((d) => d.id === domainId);

      const newMailbox: MailboxItem = {
        id: data.id,
        senderEmail: data.senderEmail,
        provider: data.provider,
        createdAt: data.createdAt,
        domainName: domain ? domain.domainName : 'Unknown',
        domainId: data.domainId,
      };

      setMailboxes((current) => [newMailbox, ...current]);
      setSenderEmail('');
      setDomainId('');
      setProvider('google');
      setShowAddForm(false);
      setMessage('Mailbox added successfully.');
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
      const response = await fetch(`/api/workspaces/${workspaceId}/mailboxes/${confirmDeleteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete mailbox');
      }

      setMailboxes((current) => current.filter((m) => m.id !== confirmDeleteId));
      setMessage('Mailbox removed from active monitoring.');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setConfirmDeleteId(null);
      setLoading(false);
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

  function formatProviderLabel(val: string) {
    if (val === 'google') return 'Google';
    if (val === 'outlook') return 'Outlook';
    return 'Other';
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
            <h3 className="text-lg font-serif font-normal text-ink tracking-tight">Sender Mailboxes</h3>
            <p className="text-sm text-ink-muted mt-1 font-mono uppercase tracking-wider text-[11px]">
              Manage sender identities per domain in the active workspace
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={domains.length === 0}
            className="rounded-md bg-ink text-surface px-5 py-2 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95 border border-transparent"
          >
            {showAddForm ? 'Cancel Add' : 'Add Sender'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={handleAddMailbox} className="rounded-xl border border-border bg-surface-alt p-6 space-y-4">
          <div>
            <h4 className="text-base font-semibold text-ink">Add a Sender Mailbox</h4>
            <p className="text-xs text-ink-muted font-mono uppercase mt-0.5 tracking-wider">
              Configure associated mailbox outbound addresses
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_140px]">
            <input
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="sender@example.com"
              type="email"
              required
              className="rounded-md border border-border bg-surface px-4 py-2.5 text-base text-ink font-mono focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px]"
            />
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px] cursor-pointer"
            >
              <option value="google">Google</option>
              <option value="outlook">Outlook</option>
              <option value="other">Other</option>
            </select>
            <select
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
              required
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px] cursor-pointer"
            >
              <option value="">Select domain</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.domainName}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={loading || !senderEmail.trim() || !domainId}
              className="rounded-md bg-ink text-surface px-6 py-2.5 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95"
            >
              Add Sender
            </button>
          </div>
        </form>
      )}

      {/* Table / Empty State */}
      {mailboxes.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-alt p-12 text-center max-w-xl mx-auto font-sans">
          <div className="h-10 w-10 rounded-full border-2 border-border-strong flex items-center justify-center font-mono text-ink-muted mx-auto">!</div>
          <h3 className="mt-4 text-lg font-serif text-ink tracking-tight">No mailboxes yet</h3>
          <p className="mt-2 text-sm text-ink-muted leading-relaxed">
            No mailboxes configured yet — add your first sender mailbox to start placement monitoring.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowAddForm(true)}
              disabled={domains.length === 0}
              className="rounded-md bg-ink text-surface px-5 py-2 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted active:scale-95 disabled:opacity-60"
            >
              Add Sender
            </button>
            {domains.length === 0 && (
              <p className="text-xs text-accent-critical font-mono mt-2">
                * You must add a domain first before adding a sender mailbox.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-alt p-6">
          <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-4 border-b border-border pb-3">
            MAILBOXES MATRIX
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse select-text">
              <thead>
                <tr className="border-b border-border/80 font-mono text-xs uppercase text-ink-muted">
                  <th className="py-3 px-4 font-semibold">Sender Email</th>
                  <th className="py-3 px-4 font-semibold">Domain</th>
                  <th className="py-3 px-4 font-semibold">Provider</th>
                  <th className="py-3 px-4 font-semibold">Added Date</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mailboxes.map((mailbox) => (
                  <tr
                    key={mailbox.id}
                    className="border-b border-border/60 hover:bg-surface transition-colors duration-150 group"
                  >
                    <td className="py-4 px-4 font-mono font-medium text-ink text-sm">
                      {mailbox.senderEmail}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm">
                      <Link
                        href={`/${workspaceId}/domain-health?domainId=${mailbox.domainId}`}
                        className="hover:underline text-ink-muted hover:text-ink transition"
                      >
                        {mailbox.domainName}
                      </Link>
                    </td>
                    <td className="py-4 px-4 text-sm text-ink-muted">
                      {formatProviderLabel(mailbox.provider)}
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-ink-muted">
                      {formatDate(mailbox.createdAt)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(mailbox.id)}
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
                This will remove the mailbox from active monitoring but preserve its placement test history.
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
