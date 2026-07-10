'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { emitReticleSignal } from '@/app/reticle-dev';

type Domain = { id: string; domainName: string };
type Mailbox = { id: string; senderEmail: string; provider: string };

export function WorkspaceOnboarding({ workspaceId, initialDomains, initialMailboxes }: { workspaceId: string; initialDomains: Domain[]; initialMailboxes: Mailbox[] }) {
  const [domains, setDomains] = useState(initialDomains);
  const [mailboxes, setMailboxes] = useState(initialMailboxes);
  const [domainName, setDomainName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [provider, setProvider] = useState('google');
  const [domainId, setDomainId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setDomains(initialDomains);
    setMailboxes(initialMailboxes);
  }, [initialDomains, initialMailboxes]);

  async function addDomain(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const response = await fetch(`/api/workspaces/${workspaceId}/domains`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domainName }) });
    const data = await response.json();
    setLoading(false);
    if (response.ok) {
      setDomains((current) => [data, ...current]);
      setDomainId(data.id);
      setDomainName('');
      setMessage('Domain added successfully.');
      // Emit domain added signal
      await emitReticleSignal('domain:added', { domainId: data.id, domainName: data.domainName });
    }
  }

  async function deleteDomain(domainId: string) {
    await fetch(`/api/workspaces/${workspaceId}/domains/${domainId}`, { method: 'DELETE' });
    setDomains((current) => current.filter((domain) => domain.id !== domainId));
    setMailboxes((current) => current.filter((mailbox) => mailbox.id !== mailboxes.find((m) => m.id === mailbox.id)?.id));
    // Emit domain deleted signal
    await emitReticleSignal('domain:deleted', { domainId });
  }

  async function addMailbox(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const response = await fetch(`/api/workspaces/${workspaceId}/mailboxes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domainId, senderEmail, provider }) });
    const data = await response.json();
    setLoading(false);
    if (response.ok) {
      setMailboxes((current) => [data, ...current]);
      setSenderEmail('');
      setProvider('google');
      setMessage('Mailbox added successfully.');
      // Emit mailbox added signal
      await emitReticleSignal('mailbox:added', { mailboxId: data.id, senderEmail: data.senderEmail });
    }
  }

  async function deleteMailbox(mailboxId: string) {
    await fetch(`/api/workspaces/${workspaceId}/mailboxes/${mailboxId}`, { method: 'DELETE' });
    setMailboxes((current) => current.filter((mailbox) => mailbox.id !== mailboxId));
  }

  return (
    <div className="space-y-8 font-sans select-none">
      {message ? (
        <div className="rounded-md border border-border bg-surface-alt px-4 py-3 text-sm text-ink font-mono tracking-tight flex items-center justify-between">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage(null)} className="text-ink-muted hover:text-ink font-semibold">&times;</button>
        </div>
      ) : null}

      {/* Add Domain */}
      <form onSubmit={addDomain} className="rounded-xl border border-border bg-surface-alt p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-ink">Add a Domain</h3>
          <p className="text-xs text-ink-muted font-mono uppercase mt-0.5 tracking-wider">Register domain identity for diagnostic queries</p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={domainName}
            onChange={(event) => setDomainName(event.target.value)}
            placeholder="example.com"
            className="flex-1 rounded-md border border-border bg-surface px-4 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px]"
          />
          <button
            type="submit"
            disabled={loading || !domainName.trim()}
            data-testid="add-domain-btn"
            className="rounded-md bg-ink text-surface px-6 py-2.5 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95"
          >
            Add Domain
          </button>
        </div>
      </form>

      {/* Domain List */}
      <div className="rounded-xl border border-border bg-surface-alt p-6 space-y-4">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-muted">Monitored Domains ({domains.length})</h3>
        {domains.length === 0 ? (
          <p className="text-sm text-ink-muted leading-relaxed font-mono">0 ACTIVE DOMAINS CONFIGURED</p>
        ) : (
          <ul className="space-y-2 font-mono text-sm">
            {domains.map((domain) => (
              <li key={domain.id} className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
                <span className="font-semibold text-ink">{domain.domainName}</span>
                <button
                  type="button"
                  onClick={() => deleteDomain(domain.id)}
                  className="text-accent-critical font-bold uppercase tracking-wider text-xs hover:underline min-h-[44px]"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Mailbox */}
      <form onSubmit={addMailbox} className="rounded-xl border border-border bg-surface-alt p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-ink">Add a Sender Mailbox</h3>
          <p className="text-xs text-ink-muted font-mono uppercase mt-0.5 tracking-wider">Configure associated mailbox outbound addresses</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_160px]">
          <input
            value={senderEmail}
            onChange={(event) => setSenderEmail(event.target.value)}
            placeholder="sender@example.com"
            className="rounded-md border border-border bg-surface px-4 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px]"
          />
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px] cursor-pointer"
          >
            <option value="google">Google</option>
            <option value="outlook">Outlook</option>
            <option value="other">Other</option>
          </select>
          <select
            value={domainId}
            onChange={(event) => setDomainId(event.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px] cursor-pointer"
          >
            <option value="">Select domain</option>
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.domainName}
              </option>
            ))}
          </select>
        </div>
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !senderEmail.trim() || !domainId}
            data-testid="add-sender-btn"
            className="rounded-md bg-ink text-surface px-6 py-2.5 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95"
          >
            Add Sender
          </button>
        </div>
      </form>

      {/* Mailbox List */}
      <div className="rounded-xl border border-border bg-surface-alt p-6 space-y-4">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-muted">Active Sender Mailboxes ({mailboxes.length})</h3>
        {mailboxes.length === 0 ? (
          <p className="text-sm text-ink-muted leading-relaxed font-mono">0 ACTIVE SENDER MAILBOXES CONFIGURED</p>
        ) : (
          <ul className="space-y-2 font-mono text-sm">
            {mailboxes.map((mailbox) => (
              <li key={mailbox.id} className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
                <span>
                  <strong className="text-ink">{mailbox.senderEmail}</strong>
                  <span className="text-ink-muted ml-2">({mailbox.provider})</span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteMailbox(mailbox.id)}
                  className="text-accent-critical font-bold uppercase tracking-wider text-xs hover:underline min-h-[44px]"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
