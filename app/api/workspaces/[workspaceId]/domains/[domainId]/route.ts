import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: Request, { params }: { params: { workspaceId: string; domainId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const domain = await prisma.domain.findFirst({ where: { id: params.domainId, workspaceId: params.workspaceId } });
  if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 });

  await prisma.domain.update({
    where: { id: params.domainId },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
