import { redirect } from 'next/navigation';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function RecommendationsPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) redirect('/sign-in');

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) redirect('/sign-in');

  const recommendations = await prisma.recommendation.findMany({
    where: { workspaceId: params.workspaceId },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="text-lg font-semibold">Recommendations</h3>
        <p className="mt-2 text-sm text-slate-400">Open and resolved recommendations for the workspace.</p>
      </div>
      <div className="space-y-3">
        {recommendations.map((recommendation) => (
          <div key={recommendation.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{recommendation.title}</p>
                <p className="text-sm text-slate-400">{recommendation.description}</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase">{recommendation.severity}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
