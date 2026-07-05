import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getExplanationForRecommendation } from '@/lib/dns';

export async function POST(request: Request, { params }: { params: { workspaceId: string; domainId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const explanation = await getExplanationForRecommendation({
    title: body.title,
    description: body.description,
    severity: body.severity,
    relatedChecks: body.relatedChecks ?? [],
  });

  return NextResponse.json({ explanation });
}
