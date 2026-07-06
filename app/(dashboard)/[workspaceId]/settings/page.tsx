import { redirect } from 'next/navigation';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WorkspaceSettingsForm } from '@/components/workspace-settings-form';

export default async function SettingsPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) redirect('/sign-in');

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) redirect('/sign-in');

  const workspace = await prisma.workspace.findUnique({ where: { id: params.workspaceId } });

  return (
    <div className="space-y-6 font-sans">
      <div className="rounded-xl border border-border bg-surface-alt p-6">
        <h3 className="text-lg font-serif font-normal text-ink tracking-tight">Workspace Settings</h3>
        <p className="text-sm text-ink-muted mt-1 font-mono uppercase tracking-wider text-[11px]">Configure alert notifications and integrations</p>
      </div>
      <div className="rounded-xl border border-border bg-surface-alt p-6 space-y-4">
        <p className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-muted">Membership Role: {membership.role}</p>
        <div className="border-t border-border pt-4">
          <WorkspaceSettingsForm
            workspaceId={params.workspaceId}
            initialAlertEmail={workspace?.alertEmail ?? ''}
            initialSlackWebhookUrl={workspace?.slackWebhookUrl ?? ''}
          />
        </div>
      </div>
    </div>
  );
}
