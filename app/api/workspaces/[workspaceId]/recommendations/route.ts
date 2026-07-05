import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const domainId = searchParams.get('domainId');
  const where = domainId ? { workspaceId: params.workspaceId, domainId, status: { not: 'dismissed' } } : { workspaceId: params.workspaceId, status: { not: 'dismissed' } };

  const recommendations = await prisma.recommendation.findMany({
    where,
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json(recommendations);
}
