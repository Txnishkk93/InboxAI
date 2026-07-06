import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ENV } from '@/lib/env';

export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.workspaceMembership.findFirst({ where: { userId: user.id, workspaceId: params.workspaceId } });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const formData = await request.formData();
  const alertEmail = String(formData.get('alertEmail') ?? '').trim();
  const slackWebhookUrl = String(formData.get('slackWebhookUrl') ?? '').trim();

  await prisma.workspace.update({
    where: { id: params.workspaceId },
    data: { alertEmail: alertEmail || null, slackWebhookUrl: slackWebhookUrl || null },
  });

  return NextResponse.redirect(new URL(`/${params.workspaceId}/settings`, ENV.appUrl));
}
