'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

type Domain = { id: string; domainName: string };
type Mailbox = { id: string; senderEmail: string };
type PlacementTest = { id: string; testBatchId: string; provider: string; result: string; folderRaw?: string | null; sentAt: string };

export function PlacementDashboard({ workspaceId, domains, mailboxes }: { workspaceId: string; domains: Domain[]; mailboxes: Mailbox[] }) {
  const [selectedDomainId, setSelectedDomainId] = useState(domains[0]?.id ?? '');
  const [selectedMailboxId, setSelectedMailboxId] = useState(mailboxes[0]?.id ?? '');
  const [running, setRunning] = useState(false);

  const { data: results = [], refetch } = useQuery({
    queryKey: ['placement-results', workspaceId, selectedDomainId],
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/placement/results?domainId=${selectedDomainId}`);
      return response.json();
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (domains[0]?.id) setSelectedDomainId(domains[0].id);
    if (mailboxes[0]?.id) setSelectedMailboxId(mailboxes[0].id);
  }, [domains, mailboxes]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlacementTest[]>();
    for (const result of results as PlacementTest[]) {
      const list = map.get(result.provider) ?? [];
      list.push(result);
      map.set(result.provider, list);
    }
    return Array.from(map.entries());
  }, [results]);

  async function runPlacementTest() {
    setRunning(true);
    const response = await fetch(`/api/workspaces/${workspaceId}/placement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domainId: selectedDomainId, mailboxId: selectedMailboxId }),
    });
    const data = await response.json();
    setRunning(false);
    if (response.ok) {
      await refetch();
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Inbox Placement</h3>
            <p className="text-sm text-slate-400">Run on-demand placement tests and watch provider results update live.</p>
          </div>
          <div className="flex gap-3">
            <select value={selectedDomainId} onChange={(event) => setSelectedDomainId(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.domainName}</option>)}
            </select>
            <select value={selectedMailboxId} onChange={(event) => setSelectedMailboxId(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              {mailboxes.map((mailbox) => <option key={mailbox.id} value={mailbox.id}>{mailbox.senderEmail}</option>)}
            </select>
            <button onClick={runPlacementTest} disabled={running || !selectedDomainId || !selectedMailboxId} className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{running ? 'Test in progress' : 'Run test'}</button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {grouped.map(([provider, items]) => (
          <div key={provider} className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
            <h4 className="font-semibold capitalize">{provider}</h4>
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm">
                  <span>{item.testBatchId}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.result === 'inbox' ? 'bg-emerald-600/20 text-emerald-300' : item.result === 'promotions' ? 'bg-amber-600/20 text-amber-300' : item.result === 'spam' ? 'bg-rose-600/20 text-rose-300' : 'bg-slate-700 text-slate-300'}`}>{item.result}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
