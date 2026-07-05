import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: { workspaceId: string; recommendationId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { status } = await request.json();
  const recommendation = await prisma.recommendation.update({
    where: { id: params.recommendationId },
    data: { status, resolvedAt: status === 'resolved' ? new Date() : null },
  });

  return NextResponse.json(recommendation);
}
