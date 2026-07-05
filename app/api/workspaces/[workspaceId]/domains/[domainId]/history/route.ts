import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { workspaceId: string; domainId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const history = await prisma.scoreHistory.findMany({
    where: { domainId: params.domainId, workspaceId: params.workspaceId },
    orderBy: { calculatedAt: 'asc' },
  });

  return NextResponse.json(history.map((item) => ({ id: item.id, totalScore: item.totalScore, calculatedAt: item.calculatedAt.toISOString() })));
}
