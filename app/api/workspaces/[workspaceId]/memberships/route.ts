import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId, role = 'member' } = await request.json();
  if (!userId) return NextResponse.json({ error: 'User is required' }, { status: 400 });

  const created = await prisma.workspaceMembership.upsert({
    where: { userId_workspaceId: { userId, workspaceId: params.workspaceId } },
    update: { role },
    create: { userId, workspaceId: params.workspaceId, role },
  });

  return NextResponse.json(created);
}
