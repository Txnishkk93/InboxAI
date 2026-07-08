import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAlertRules, saveAlertRules } from '@/lib/custom-store';

export async function GET(request: Request, { params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rules = await getAlertRules(params.workspaceId);
  return NextResponse.json(rules);
}

export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const rules = await saveAlertRules(params.workspaceId, {
    blacklistAlert: body.blacklistAlert,
    dnsAlert: body.dnsAlert,
    placementDropAlert: body.placementDropAlert,
    placementThreshold: Number(body.placementThreshold ?? 80),
    dmarcAlert: body.dmarcAlert,
  });

  return NextResponse.json(rules);
}
