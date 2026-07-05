import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { workspaceId: string; domainId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const scans = await prisma.dnsScan.findMany({
    where: { domainId: params.domainId, workspaceId: params.workspaceId },
    orderBy: { startedAt: 'desc' },
    take: 1,
    include: { checks: true },
  });

  return NextResponse.json(scans[0]?.checks ?? []);
}
