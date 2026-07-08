import { redirect } from 'next/navigation';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ContentTestDashboard } from '@/components/content-test-dashboard';

export default async function ContentTestPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) redirect('/sign-in');

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) redirect('/sign-in');

  return <ContentTestDashboard workspaceId={params.workspaceId} />;
}
