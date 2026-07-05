'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
    const response = await fetch(`/api/workspaces/${workspaceId}/domains`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domainName }) });
    const data = await response.json();
    setLoading(false);
    if (response.ok) {
      setDomains((current) => [data, ...current]);
      setDomainId(data.id);
      setDomainName('');
      setMessage('Domain added');
    }
  }

  async function deleteDomain(domainId: string) {
    await fetch(`/api/workspaces/${workspaceId}/domains/${domainId}`, { method: 'DELETE' });
    setDomains((current) => current.filter((domain) => domain.id !== domainId));
    setMailboxes((current) => current.filter((mailbox) => mailbox.id !== mailboxes.find((m) => m.id === mailbox.id)?.id));
  }

  async function addMailbox(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch(`/api/workspaces/${workspaceId}/mailboxes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domainId, senderEmail, provider }) });
    const data = await response.json();
    setLoading(false);
    if (response.ok) {
      setMailboxes((current) => [data, ...current]);
      setSenderEmail('');
      setProvider('google');
      setMessage('Mailbox added');
    }
  }

  async function deleteMailbox(mailboxId: string) {
    await fetch(`/api/workspaces/${workspaceId}/mailboxes/${mailboxId}`, { method: 'DELETE' });
    setMailboxes((current) => current.filter((mailbox) => mailbox.id !== mailboxId));
  }

  return (
    <div className="space-y-6">
      {message ? <div className="rounded-md bg-emerald-600/20 p-3 text-sm text-emerald-300">{message}</div> : null}
      <form onSubmit={addDomain} className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="text-lg font-semibold">Add a domain</h3>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input value={domainName} onChange={(event) => setDomainName(event.target.value)} placeholder="example.com" className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          <button type="submit" disabled={loading} className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Add domain</button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="text-lg font-semibold">Domains</h3>
        <ul className="mt-4 space-y-2">
          {domains.map((domain) => (
            <li key={domain.id} className="flex items-center justify-between rounded-md border border-slate-800 px-3 py-2 text-sm">
              <span>{domain.domainName}</span>
              <button onClick={() => deleteDomain(domain.id)} className="text-rose-400">Delete</button>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={addMailbox} className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="text-lg font-semibold">Add a sender mailbox</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_140px]">
          <input value={senderEmail} onChange={(event) => setSenderEmail(event.target.value)} placeholder="sender@example.com" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          <select value={provider} onChange={(event) => setProvider(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            <option value="google">Google</option>
            <option value="outlook">Outlook</option>
            <option value="other">Other</option>
          </select>
          <select value={domainId} onChange={(event) => setDomainId(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            <option value="">Select domain</option>
            {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.domainName}</option>)}
          </select>
        </div>
        <div className="mt-4">
          <button type="submit" disabled={loading} className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Add sender</button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="text-lg font-semibold">Sender mailboxes</h3>
        <ul className="mt-4 space-y-2">
          {mailboxes.map((mailbox) => (
            <li key={mailbox.id} className="flex items-center justify-between rounded-md border border-slate-800 px-3 py-2 text-sm">
              <span>{mailbox.senderEmail} • {mailbox.provider}</span>
              <button onClick={() => deleteMailbox(mailbox.id)} className="text-rose-400">Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
