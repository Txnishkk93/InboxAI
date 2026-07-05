import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const domains = await prisma.domain.findMany({
    where: { workspaceId: params.workspaceId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(domains);
}

export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { domainName } = await request.json();
  if (!domainName?.trim()) return NextResponse.json({ error: 'Domain name is required' }, { status: 400 });

  const domain = await prisma.domain.create({
    data: {
      workspaceId: params.workspaceId,
      domainName: domainName.trim(),
    },
  });

  return NextResponse.json(domain);
}
