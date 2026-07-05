import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: Request, { params }: { params: { workspaceId: string; mailboxId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const mailbox = await prisma.mailbox.findFirst({ where: { id: params.mailboxId, workspaceId: params.workspaceId } });
  if (!mailbox) return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });

  await prisma.mailbox.update({
    where: { id: params.mailboxId },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
