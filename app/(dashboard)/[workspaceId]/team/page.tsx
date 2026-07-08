import { redirect } from 'next/navigation';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TeamDashboard } from '@/components/team-dashboard';

export default async function TeamPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) redirect('/sign-in');

  const memberships = await prisma.workspaceMembership.findMany({
    where: { workspaceId: params.workspaceId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });

  const currentMembership = memberships.find((m) => m.userId === user.id);
  if (!currentMembership) redirect('/sign-in');

  const formattedMembers = memberships.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    createdAt: m.createdAt.toISOString(),
    email: m.user.email,
    name: m.user.name,
  }));

  return (
    <TeamDashboard
      workspaceId={params.workspaceId}
      initialMembers={formattedMembers}
      currentUser={{ id: user.id, email: user.email, name: user.name }}
      currentUserRole={currentMembership.role}
    />
  );
}
