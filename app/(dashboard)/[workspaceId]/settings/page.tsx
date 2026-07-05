import { redirect } from 'next/navigation';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function SettingsPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) redirect('/sign-in');

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) redirect('/sign-in');

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="text-lg font-semibold">Workspace settings</h3>
        <p className="mt-2 text-sm text-slate-400">Invite members with a stub membership row for now.</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-slate-400">Role: {membership.role}</p>
      </div>
    </div>
  );
}
