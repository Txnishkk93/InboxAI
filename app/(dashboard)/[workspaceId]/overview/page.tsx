import { redirect } from 'next/navigation';
import { getCurrentUserRecord, getUserWorkspaces } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CreateWorkspaceCard } from '@/components/create-workspace-card';
import { WorkspaceOnboarding } from '@/components/workspace-onboarding';

export default async function OverviewPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) redirect('/sign-in');

  const membership = await prisma.workspaceMembership.findFirst({
    where: { userId: user.id, workspaceId: params.workspaceId },
  });
  if (!membership) redirect('/sign-in');

  const [workspaces, domains, mailboxes] = await Promise.all([
    getUserWorkspaces(),
    prisma.domain.findMany({ where: { workspaceId: params.workspaceId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.mailbox.findMany({ where: { workspaceId: params.workspaceId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
  ]);

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="text-lg font-semibold">Workspace overview</h3>
        <p className="mt-2 text-sm text-slate-400">This workspace currently has {domains.length} active domains and {mailboxes.length} mailboxes.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <h4 className="font-medium">Domains</h4>
          <ul className="mt-4 space-y-2">
            {domains.length === 0 ? <li className="text-sm text-slate-400">No domains yet.</li> : domains.map((domain) => <li key={domain.id} className="text-sm text-slate-300">{domain.domainName}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <h4 className="font-medium">Mailboxes</h4>
          <ul className="mt-4 space-y-2">
            {mailboxes.length === 0 ? <li className="text-sm text-slate-400">No sender identities yet.</li> : mailboxes.map((mailbox) => <li key={mailbox.id} className="text-sm text-slate-300">{mailbox.senderEmail} • {mailbox.provider}</li>)}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h4 className="font-medium">Workspace switcher</h4>
        <p className="mt-2 text-sm text-slate-400">You belong to {workspaces.length} workspace{workspaces.length === 1 ? '' : 's'}.</p>
      </div>

      <WorkspaceOnboarding workspaceId={params.workspaceId} initialDomains={domains} initialMailboxes={mailboxes} />

      {workspaces.length === 0 ? <CreateWorkspaceCard /> : null}
    </div>
  );
}
