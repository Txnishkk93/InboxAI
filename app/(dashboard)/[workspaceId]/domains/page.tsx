import { redirect } from 'next/navigation';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DomainsDashboard } from '@/components/domains-dashboard';

export default async function DomainsPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) redirect('/sign-in');

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) redirect('/sign-in');

  const domains = await prisma.domain.findMany({
    where: { workspaceId: params.workspaceId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  const latestScans = await prisma.dnsScan.findMany({
    where: { workspaceId: params.workspaceId, status: 'complete' },
    orderBy: { startedAt: 'desc' },
  });

  const openRecommendations = await prisma.recommendation.findMany({
    where: { workspaceId: params.workspaceId, status: 'open' },
  });

  const domainsWithMetrics = domains.map((domain) => {
    const latestScan = latestScans.find((s) => s.domainId === domain.id);
    const lastScanDate = latestScan ? (latestScan.completedAt || latestScan.startedAt).toISOString() : null;
    const recCount = openRecommendations.filter((r) => r.domainId === domain.id).length;
    return {
      id: domain.id,
      domainName: domain.domainName,
      status: domain.status,
      createdAt: domain.createdAt.toISOString(),
      lastScanDate,
      recCount,
    };
  });

  return <DomainsDashboard workspaceId={params.workspaceId} initialDomains={domainsWithMetrics} />;
}
