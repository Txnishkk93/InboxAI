import { redirect } from 'next/navigation';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MailboxesDashboard } from '@/components/mailboxes-dashboard';

export default async function MailboxesPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) redirect('/sign-in');

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) redirect('/sign-in');

  const [mailboxes, domains] = await Promise.all([
    prisma.mailbox.findMany({
      where: { workspaceId: params.workspaceId, deletedAt: null },
      include: { domain: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.domain.findMany({
      where: { workspaceId: params.workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const formattedMailboxes = mailboxes.map((m) => ({
    id: m.id,
    senderEmail: m.senderEmail,
    provider: m.provider,
    createdAt: m.createdAt.toISOString(),
    domainName: m.domain.domainName,
    domainId: m.domainId,
  }));

  const formattedDomains = domains.map((d) => ({
    id: d.id,
    domainName: d.domainName,
  }));

  return (
    <MailboxesDashboard
      workspaceId={params.workspaceId}
      initialMailboxes={formattedMailboxes}
      domains={formattedDomains}
    />
  );
}
