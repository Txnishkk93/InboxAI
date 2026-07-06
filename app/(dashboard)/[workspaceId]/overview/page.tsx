import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function OverviewPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) redirect('/sign-in');

  const membership = await prisma.workspaceMembership.findFirst({
    where: { userId: user.id, workspaceId: params.workspaceId },
  });
  if (!membership) redirect('/sign-in');

  const [domains, mailboxes, latestScore, openRecommendations, recentAlerts] = await Promise.all([
    prisma.domain.findMany({ where: { workspaceId: params.workspaceId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.mailbox.findMany({ where: { workspaceId: params.workspaceId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.scoreHistory.findFirst({ where: { workspaceId: params.workspaceId }, orderBy: { calculatedAt: 'desc' } }),
    prisma.recommendation.findMany({ where: { workspaceId: params.workspaceId, status: 'open' }, orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }], take: 3 }),
    prisma.alert.findMany({ where: { workspaceId: params.workspaceId }, orderBy: { triggeredAt: 'desc' }, take: 5 }),
  ]);

  // Empty State: No domains added yet
  if (domains.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto font-sans">
        <div className="h-10 w-10 rounded-full border-2 border-border-strong flex items-center justify-center font-mono text-ink-muted">!</div>
        <h3 className="mt-4 text-xl font-serif text-ink tracking-tight">No domains monitored yet</h3>
        <p className="mt-2 text-base text-ink-muted leading-relaxed">
          InboxAI diagnostic engine requires at least one domain to run DNS scans and monitor mailbox placement performance.
        </p>
        <div className="mt-8 flex gap-4">
          <Link href={`/${params.workspaceId}/settings`} className="rounded-md bg-ink text-surface px-5 py-2.5 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted active:scale-95">
            Onboard Domain & Mailbox
          </Link>
        </div>
      </div>
    );
  }

  const breakdown = latestScore?.scoreBreakdown as any;
  const scoreDate = latestScore
    ? new Date(latestScore.calculatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h3 className="font-serif text-3xl font-normal tracking-tight text-ink">System Status</h3>
        <p className="text-sm text-ink-muted mt-1 font-mono">WORKSPACE DIAGNOSTICS & TENANT METRICS</p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Large Cell: Deliverability Score */}
        <div className="md:col-span-2 rounded-xl border border-border bg-surface-alt p-6 flex flex-col justify-between min-h-[300px] animate-bento [animation-delay:100ms] shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-xs font-mono uppercase tracking-[0.25em] text-ink-muted">Deliverability Score</span>
              {scoreDate && (
                <span className="text-xs font-mono text-ink-muted">CALCULATED {scoreDate}</span>
              )}
            </div>
            <div className="mt-4 flex items-baseline gap-4">
              <span className="font-serif text-7xl font-normal text-ink tracking-tight">
                {latestScore?.totalScore ?? '—'}
              </span>
              <span className="font-mono text-lg text-ink-muted">/ 100</span>
            </div>
          </div>

          <div className="space-y-4 mt-6">
            <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted">Diagnostic Breakdown</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="flex justify-between items-center text-xs font-mono mb-1">
                  <span className="text-ink-muted">Auth Health</span>
                  <span className="text-ink font-semibold">{breakdown?.authenticationHealth ?? 100}%</span>
                </div>
                <div className="w-full bg-border h-1 rounded-full overflow-hidden">
                  <div className="bg-ink h-full" style={{ width: `${breakdown?.authenticationHealth ?? 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-mono mb-1">
                  <span className="text-ink-muted">Infrastructure</span>
                  <span className="text-ink font-semibold">{breakdown?.infrastructureHealth ?? 100}%</span>
                </div>
                <div className="w-full bg-border h-1 rounded-full overflow-hidden">
                  <div className="bg-ink h-full" style={{ width: `${breakdown?.infrastructureHealth ?? 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-mono mb-1">
                  <span className="text-ink-muted">Placement</span>
                  <span className="text-ink font-semibold">{breakdown?.placementPerformance ?? 100}%</span>
                </div>
                <div className="w-full bg-border h-1 rounded-full overflow-hidden">
                  <div className="bg-ink h-full" style={{ width: `${breakdown?.placementPerformance ?? 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Medium Cell: Open Recommendations */}
        <div className="rounded-xl border border-border bg-surface-alt p-6 flex flex-col justify-between min-h-[300px] animate-bento [animation-delay:200ms] shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-xs font-mono uppercase tracking-[0.25em] text-ink-muted">Top Action Items</span>
              <span className="text-xs font-mono text-ink-muted">({openRecommendations.length})</span>
            </div>
            <div className="mt-4 space-y-3">
              {openRecommendations.length === 0 ? (
                <p className="text-sm text-ink-muted leading-relaxed font-sans pt-4">
                  All critical diagnostics passing. Keep monitoring active.
                </p>
              ) : (
                openRecommendations.map((rec) => {
                  const isCritical = rec.severity === 'critical' || rec.severity === 'high';
                  return (
                    <div
                      key={rec.id}
                      className={`p-3 rounded border bg-surface transition-colors duration-150 ${
                        isCritical
                          ? 'border-l-4 border-l-accent-critical border-border'
                          : 'border-l-2 border-l-border-strong border-border'
                      }`}
                    >
                      <h5 className="text-sm font-semibold text-ink leading-snug">{rec.title}</h5>
                      <p className="text-xs text-ink-muted mt-1 leading-normal line-clamp-1">{rec.description}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <Link href={`/${params.workspaceId}/recommendations`} className="mt-4 inline-flex items-center text-xs font-mono text-ink-muted hover:text-ink transition hover:underline">
            View All Recommendations &rarr;
          </Link>
        </div>

        {/* Small Cell: Domains count */}
        <div className="rounded-xl border border-border bg-surface-alt p-6 flex flex-col justify-between animate-bento [animation-delay:300ms] shadow-sm">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.25em] text-ink-muted">Domains</span>
            <div className="mt-4 font-mono text-4xl text-ink tracking-tight font-normal">
              {String(domains.length).padStart(2, '0')}
            </div>
          </div>
          <div className="mt-4 text-xs font-mono text-ink-muted border-t border-border/60 pt-3">
            PRIMARY: {domains[0]?.domainName ?? 'None'}
          </div>
        </div>

        {/* Small Cell: Mailboxes count */}
        <div className="rounded-xl border border-border bg-surface-alt p-6 flex flex-col justify-between animate-bento [animation-delay:400ms] shadow-sm">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.25em] text-ink-muted">Mailboxes</span>
            <div className="mt-4 font-mono text-4xl text-ink tracking-tight font-normal">
              {String(mailboxes.length).padStart(2, '0')}
            </div>
          </div>
          <div className="mt-4 text-xs font-mono text-ink-muted border-t border-border/60 pt-3">
            mix: {mailboxes.map(m => m.provider).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'none'}
          </div>
        </div>

        {/* Small Cell: Active Alerts */}
        <div className="rounded-xl border border-border bg-surface-alt p-6 flex flex-col justify-between animate-bento [animation-delay:500ms] shadow-sm">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.25em] text-ink-muted font-semibold">Active Alerts</span>
            <div className="mt-4 font-mono text-4xl text-ink tracking-tight font-normal">
              {String(recentAlerts.length).padStart(2, '0')}
            </div>
          </div>
          <div className="mt-4 text-xs font-mono text-ink-muted border-t border-border/60 pt-3">
            LATEST: {recentAlerts[0]?.type.replace(/_/g, ' ') || 'No alerts triggered'}
          </div>
        </div>
      </div>
    </div>
  );
}
