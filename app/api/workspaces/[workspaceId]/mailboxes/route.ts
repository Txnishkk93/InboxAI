import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const mailboxes = await prisma.mailbox.findMany({
    where: { workspaceId: params.workspaceId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(mailboxes);
}

export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { domainId, senderEmail, provider } = await request.json();
  if (!domainId || !senderEmail?.trim() || !provider) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const mailbox = await prisma.mailbox.create({
    data: {
      workspaceId: params.workspaceId,
      domainId,
      senderEmail: senderEmail.trim(),
      provider,
    },
  });

  return NextResponse.json(mailbox);
}
