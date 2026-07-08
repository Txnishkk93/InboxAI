import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: { workspaceId: string; membershipId: string } }
) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check if sender is admin or owner
  const userMembership = await prisma.workspaceMembership.findFirst({
    where: { userId: user.id, workspaceId: params.workspaceId },
  });
  if (!userMembership || (userMembership.role !== 'owner' && userMembership.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const targetMembership = await prisma.workspaceMembership.findFirst({
    where: { id: params.membershipId, workspaceId: params.workspaceId },
  });
  if (!targetMembership) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
  }

  // Prevent removing yourself if you are the sole owner
  if (targetMembership.role === 'owner') {
    const ownersCount = await prisma.workspaceMembership.count({
      where: { workspaceId: params.workspaceId, role: 'owner' },
    });
    if (ownersCount <= 1) {
      return NextResponse.json({ error: 'Cannot remove the sole owner' }, { status: 400 });
    }
  }

  await prisma.workspaceMembership.delete({
    where: { id: params.membershipId },
  });

  return NextResponse.json({ success: true });
}
