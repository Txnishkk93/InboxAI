import { redirect } from 'next/navigation';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RecommendationsList } from '@/components/recommendations-list';

export default async function RecommendationsPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) redirect('/sign-in');

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) redirect('/sign-in');

  const [recommendations, domains] = await Promise.all([
    prisma.recommendation.findMany({
      where: { workspaceId: params.workspaceId },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.domain.findMany({
      where: { workspaceId: params.workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const latestScans = await prisma.dnsScan.findMany({
    where: { workspaceId: params.workspaceId, status: 'complete' },
    orderBy: { startedAt: 'desc' },
  });

  const seenDomains = new Set<string>();
  const latestScanIds: string[] = [];
  for (const scan of latestScans) {
    if (!seenDomains.has(scan.domainId)) {
      seenDomains.add(scan.domainId);
      latestScanIds.push(scan.id);
    }
  }

  const checks = await prisma.dnsScanCheck.findMany({
    where: { dnsScanId: { in: latestScanIds } },
  });

  const groupedRecs: Record<string, typeof recommendations> = {};
  for (const rec of recommendations) {
    if (!groupedRecs[rec.domainId]) {
      groupedRecs[rec.domainId] = [];
    }
    groupedRecs[rec.domainId].push(rec);
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="rounded-xl border border-border bg-surface-alt p-6">
        <h3 className="text-lg font-serif font-normal text-ink tracking-tight">Workspace Recommendations</h3>
        <p className="text-sm text-ink-muted mt-1 font-mono uppercase tracking-wider text-[11px]">Open action items grouped by monitored domain</p>
      </div>

      <div className="space-y-6">
        {domains.map((domain) => {
          const recs = groupedRecs[domain.id] ?? [];
          const domainChecks = checks.filter((c) => {
            const scan = latestScans.find((s) => s.domainId === domain.id && latestScanIds.includes(s.id));
            return scan ? c.dnsScanId === scan.id : false;
          });

          const activeRecs = recs.filter((r) => r.status !== 'dismissed');
          if (activeRecs.length === 0) return null;

          return (
            <div key={domain.id} className="rounded-xl border border-border bg-surface-alt p-6 space-y-4">
              <h4 className="text-sm font-mono font-semibold uppercase tracking-wider text-ink-muted">Domain: {domain.domainName}</h4>
              <RecommendationsList
                workspaceId={params.workspaceId}
                domainId={domain.id}
                initialRecommendations={recs}
                checks={domainChecks}
                showActions={true}
              />
            </div>
          );
        })}

        {recommendations.filter((r) => r.status !== 'dismissed').length === 0 && (
          <div className="rounded-xl border border-border bg-surface-alt p-6 text-center">
            <p className="text-sm font-mono text-ink-muted">ALL DIAGNOSTIC RECOMMANDATIONS CAUGHT UP</p>
          </div>
        )}
      </div>
    </div>
  );
}
