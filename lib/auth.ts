import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { ENV } from '@/lib/env';

export async function getCurrentUserRecord() {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (existing) return existing;

  const clerkUser = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${ENV.clerkSecretKey}` },
  }).then((res) => res.json());

  return prisma.user.upsert({
    where: { clerkUserId: userId },
    update: {},
    create: {
      clerkUserId: userId,
      email: clerkUser.email_addresses?.[0]?.email_address ?? null,
      name: `${clerkUser.first_name ?? ''} ${clerkUser.last_name ?? ''}`.trim() || null,
    },
  });
}

export async function getWorkspaceForUser(workspaceId: string) {
  const user = await getCurrentUserRecord();
  if (!user) return null;

  return prisma.workspaceMembership.findFirst({
    where: {
      userId: user.id,
      workspaceId,
    },
    include: { workspace: true },
  });
}

export async function getUserWorkspaces() {
  const user = await getCurrentUserRecord();
  if (!user) return [];

  return prisma.workspaceMembership.findMany({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  });
}
