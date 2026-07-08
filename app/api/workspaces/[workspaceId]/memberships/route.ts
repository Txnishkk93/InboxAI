import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId, email, role = 'member' } = await request.json();
  let targetUserId = userId;

  if (!targetUserId && email?.trim()) {
    const targetEmail = email.trim().toLowerCase();
    let targetUser = await prisma.user.findFirst({ where: { email: targetEmail } });
    if (!targetUser) {
      targetUser = await prisma.user.create({
        data: {
          email: targetEmail,
          clerkUserId: `invited_${targetEmail}_${Date.now()}`,
          name: targetEmail.split('@')[0],
        },
      });
    }
    targetUserId = targetUser.id;
  }

  if (!targetUserId) {
    return NextResponse.json({ error: 'User ID or Email is required' }, { status: 400 });
  }

  const created = await prisma.workspaceMembership.upsert({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId: params.workspaceId } },
    update: { role },
    create: { userId: targetUserId, workspaceId: params.workspaceId, role },
  });

  return NextResponse.json(created);
}
