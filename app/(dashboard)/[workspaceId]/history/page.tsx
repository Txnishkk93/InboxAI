import { redirect } from 'next/navigation';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DnsDashboard } from '@/components/dns-dashboard';

export default async function HistoryPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) redirect('/sign-in');

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) redirect('/sign-in');

  const domains = await prisma.domain.findMany({ where: { workspaceId: params.workspaceId, deletedAt: null }, orderBy: { createdAt: 'desc' } });

  return (
    <div className="space-y-6">
      <DnsDashboard workspaceId={params.workspaceId} domains={domains} />
    </div>
  );
}
