'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

type Domain = { id: string; domainName: string };
type Mailbox = { id: string; senderEmail: string };
type PlacementTest = { id: string; testBatchId: string; provider: string; result: string; folderRaw?: string | null; sentAt: string };

export function PlacementDashboard({ workspaceId, domains, mailboxes }: { workspaceId: string; domains: Domain[]; mailboxes: Mailbox[] }) {
  const [selectedDomainId, setSelectedDomainId] = useState(domains[0]?.id ?? '');
  const [selectedMailboxId, setSelectedMailboxId] = useState(mailboxes[0]?.id ?? '');
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: results = [], refetch, isLoading, isError } = useQuery({
    queryKey: ['placement-results', workspaceId, selectedDomainId],
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/placement/results?domainId=${selectedDomainId}`);
      if (!response.ok) throw new Error('Failed to fetch results');
      return response.json();
    },
    refetchInterval: 5000,
    enabled: Boolean(selectedDomainId),
  });

  useEffect(() => {
    if (domains[0]?.id && !selectedDomainId) setSelectedDomainId(domains[0].id);
    if (mailboxes[0]?.id && !selectedMailboxId) setSelectedMailboxId(mailboxes[0].id);
  }, [domains, mailboxes]);

  // Group tests by batch ID and then by provider
  const batches = useMemo(() => {
    const batchesMap = new Map<string, { sentAt: string; providers: Record<string, PlacementTest[]> }>();
    for (const test of results as PlacementTest[]) {
      const batch = batchesMap.get(test.testBatchId) ?? { sentAt: test.sentAt, providers: {} };
      const list = batch.providers[test.provider] ?? [];
      list.push(test);
      batch.providers[test.provider] = list;
      batchesMap.set(test.testBatchId, batch);
    }
    return Array.from(batchesMap.entries()).sort((a, b) => new Date(b[1].sentAt).getTime() - new Date(a[1].sentAt).getTime());
  }, [results]);

  // Calculate sparkline trend data per provider (inbox rate over last 10 batches)
  const trends = useMemo(() => {
    const list = [...batches].reverse(); // chronological
    const trendMap: Record<string, Array<{ value: number }>> = {
      gmail: [],
      outlook: [],
      yahoo: [],
      custom: [],
    };

    for (const [, batch] of list) {
      for (const provider of ['gmail', 'outlook', 'yahoo', 'custom']) {
        const tests = batch.providers[provider] ?? [];
        if (tests.length > 0) {
          const inboxCount = tests.filter((t) => t.result === 'inbox' || t.result === 'promotions').length;
          const rate = Math.round((inboxCount / tests.length) * 100);
          trendMap[provider].push({ value: rate });
        } else if (trendMap[provider].length > 0) {
          // Carry forward previous value
          trendMap[provider].push({ value: trendMap[provider][trendMap[provider].length - 1].value });
        } else {
          trendMap[provider].push({ value: 100 }); // Default base
        }
      }
    }
    return trendMap;
  }, [batches]);

  async function runPlacementTest() {
    if (!selectedDomainId || !selectedMailboxId) return;
    setRunning(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/placement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainId: selectedDomainId, mailboxId: selectedMailboxId }),
      });
      const data = await response.json();
      if (data.blocked) {
        setMessage('A placement test is already running for this domain.');
      } else {
        setMessage('Placement test batch triggered.');
        await refetch();
      }
    } catch {
      setMessage('Failed to initiate placement test.');
    } finally {
      setRunning(false);
    }
  }

  if (domains.length === 0 || mailboxes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-alt p-8 text-center font-sans">
        <p className="text-sm text-ink-muted">Onboard at least one domain and one sender mailbox in Settings to run placement monitoring.</p>
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

      {/* Primary Control header */}
      <div className="rounded-xl border border-border bg-surface-alt p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-serif font-normal text-ink tracking-tight">Inbox Placement</h3>
            <p className="text-sm text-ink-muted mt-1 font-mono uppercase tracking-wider text-[11px]">Audit inbox placement landing folders</p>
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
            <select
              value={selectedMailboxId}
              onChange={(event) => setSelectedMailboxId(event.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px] cursor-pointer"
            >
              {mailboxes.map((mailbox) => (
                <option key={mailbox.id} value={mailbox.id}>
                  {mailbox.senderEmail}
                </option>
              ))}
            </select>
            <button
              onClick={runPlacementTest}
              disabled={running || !selectedDomainId || !selectedMailboxId || isLoading}
              className="rounded-md bg-ink text-surface px-5 py-2 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95 border border-transparent"
            >
              {running ? 'Test in progress' : 'Run Placement Test'}
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center border border-border rounded-xl bg-surface-alt">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink border-t-transparent mb-2" />
          <p className="text-xs font-mono text-ink-muted">RESOLVING SEED PLACEMENT DATA...</p>
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-accent-critical/20 bg-surface p-6 text-center">
          <p className="text-sm font-mono text-accent-critical font-bold">ERROR RETRIEVING DIAGNOSTICS</p>
          <button onClick={() => void refetch()} className="mt-4 rounded border border-border px-4 py-2 text-xs font-mono font-semibold uppercase text-ink hover:bg-surface-alt">
            Retry Query
          </button>
        </div>
      ) : batches.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-alt p-8 text-center max-w-lg mx-auto">
          <p className="text-sm text-ink-muted leading-relaxed">
            No seed placement records found for this domain. Launch a placement test to audit landing folders.
          </p>
          <button
            onClick={runPlacementTest}
            disabled={running}
            className="mt-6 rounded-md bg-ink text-surface px-5 py-2.5 text-xs font-mono font-semibold uppercase tracking-wider transition hover:bg-ink-muted"
          >
            Run First Test
          </button>
        </div>
      ) : (
        <>
          {/* Sparkline Trend Section */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {['gmail', 'outlook', 'yahoo', 'custom'].map((provider) => {
              const trendData = trends[provider] ?? [];
              const latestValue = trendData[trendData.length - 1]?.value ?? 100;
              return (
                <div key={provider} className="rounded-xl border border-border bg-surface-alt p-5 flex flex-col justify-between h-36">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">{provider}</span>
                    <span className="text-base font-mono font-bold text-ink">{latestValue}%</span>
                  </div>
                  <div className="h-10 mt-3 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-ink-muted uppercase">Trend</span>
                    <div className="h-full w-28">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="var(--ink-muted)"
                            strokeWidth={1.2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Diagnostics Placement Matrix Table */}
          <div className="rounded-xl border border-border bg-surface-alt p-6">
            <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-4 border-b border-border pb-3">LANDING MATRIX</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse select-text">
                <thead>
                  <tr className="border-b border-border/80 font-mono text-xs uppercase text-ink-muted">
                    <th className="py-3 px-4 font-semibold">Test Batch</th>
                    <th className="py-3 px-4 font-semibold">Gmail</th>
                    <th className="py-3 px-4 font-semibold">Outlook</th>
                    <th className="py-3 px-4 font-semibold">Yahoo</th>
                    <th className="py-3 px-4 font-semibold">Custom</th>
                    <th className="py-3 px-4 font-semibold text-right">Tested At</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map(([batchId, batch]) => {
                    const timeString = new Date(batch.sentAt).toLocaleDateString([], { month: 'short', day: '2-digit' }) + ' ' + new Date(batch.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <tr key={batchId} className="border-b border-border/60 hover:bg-surface transition-colors duration-150 font-mono text-xs">
                        <td className="py-4 px-4 font-medium text-ink font-mono uppercase">{batchId}</td>
                        
                        {['gmail', 'outlook', 'yahoo', 'custom'].map((provider) => {
                          const tests = batch.providers[provider] ?? [];
                          if (tests.length === 0) {
                            return <td key={provider} className="py-4 px-4 text-ink-muted">—</td>;
                          }

                          // Check if any results landed in spam or are missing
                          const hasSpam = tests.some((t) => t.result === 'spam');
                          const hasMissing = tests.some((t) => t.result === 'missing');
                          const allInbox = tests.every((t) => t.result === 'inbox' || t.result === 'promotions');

                          return (
                            <td key={provider} className={`py-4 px-4 relative overflow-hidden ${hasSpam || hasMissing ? 'bg-accent-critical/5' : ''}`}>
                              {/* Faint dot pattern overlay for critical/spam cells */}
                              {(hasSpam || hasMissing) && (
                                <div className="absolute inset-0 dot-pattern text-accent-critical/10 opacity-30 pointer-events-none" />
                              )}
                              <div className="relative z-10 flex items-center gap-2">
                                <div className="flex gap-1">
                                  {tests.map((t) => (
                                    <span
                                      key={t.id}
                                      title={`${t.result}`}
                                      className={`inline-block h-2 w-2 flex-shrink-0 ${
                                        t.result === 'inbox'
                                          ? 'bg-ink rounded-full'
                                          : t.result === 'promotions'
                                          ? 'bg-ink-muted'
                                          : t.result === 'spam'
                                          ? 'bg-accent-critical'
                                          : 'border border-border-strong bg-surface'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className={`text-[10px] uppercase font-semibold ${
                                  allInbox
                                    ? 'text-ink-muted font-normal'
                                    : hasSpam
                                    ? 'text-accent-critical font-bold'
                                    : 'text-ink-muted font-bold'
                                }`}>
                                  {allInbox ? 'inbox' : hasSpam ? 'spam' : 'regressed'}
                                </span>
                              </div>
                            </td>
                          );
                        })}

                        <td className="py-4 px-4 text-right text-ink-muted font-mono">{timeString}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
