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
  const tests = await prisma.placementTest.findMany({
    where: domainId ? { workspaceId: params.workspaceId, domainId } : { workspaceId: params.workspaceId },
    orderBy: { sentAt: 'desc' },
    take: 20,
  });

  return NextResponse.json(tests);
}
