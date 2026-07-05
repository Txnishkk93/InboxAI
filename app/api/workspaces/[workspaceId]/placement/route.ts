import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { queuePlacementTest, bootstrapSeedInboxes } from '@/lib/placement';

export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { domainId, mailboxId } = await request.json();
  await bootstrapSeedInboxes();
  const result = await queuePlacementTest({ workspaceId: params.workspaceId, domainId, mailboxId });
  return NextResponse.json(result);
}
