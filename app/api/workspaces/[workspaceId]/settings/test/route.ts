import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createTestAlert } from '@/lib/alerts';
import { ENV } from '@/lib/env';

export async function GET(request: Request, { params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const workspace = await prisma.workspace.findUnique({ where: { id: params.workspaceId } });
  const domain = await prisma.domain.findFirst({ where: { workspaceId: params.workspaceId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!domain) return NextResponse.json({ error: 'No domain available' }, { status: 400 });

  await createTestAlert({ workspaceId: params.workspaceId, domainId: domain.id });
  return NextResponse.redirect(new URL(`/${params.workspaceId}/settings`, ENV.appUrl));
}
