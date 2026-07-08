import { redirect } from 'next/navigation';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AlertsDashboard } from '@/components/alerts-dashboard';
import { getAlertRules } from '@/lib/custom-store';

export default async function AlertsPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) redirect('/sign-in');

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) redirect('/sign-in');

  const [alerts, domains, rules] = await Promise.all([
    prisma.alert.findMany({
      where: { workspaceId: params.workspaceId },
      include: { domain: true },
      orderBy: { triggeredAt: 'desc' },
    }),
    prisma.domain.findMany({
      where: { workspaceId: params.workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    getAlertRules(params.workspaceId),
  ]);

  const formattedAlerts = alerts.map((alert) => ({
    id: alert.id,
    domainId: alert.domainId,
    domainName: alert.domain.domainName,
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    triggeredAt: alert.triggeredAt.toISOString(),
    channel: alert.channel,
    status: alert.status,
    deliveredAt: alert.deliveredAt?.toISOString() || null,
    dedupeKey: alert.dedupeKey,
  }));

  const formattedDomains = domains.map((domain) => ({
    id: domain.id,
    domainName: domain.domainName,
  }));

  return (
    <AlertsDashboard
      workspaceId={params.workspaceId}
      initialAlerts={formattedAlerts}
      domains={formattedDomains}
      initialRules={rules}
    />
  );
}
