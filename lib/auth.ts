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

  const email = clerkUser.email_addresses?.[0]?.email_address ?? null;
  if (email) {
    const existingByEmail = await prisma.user.findFirst({
      where: {
        email,
        clerkUserId: { startsWith: 'invited_' },
      },
    });
    if (existingByEmail) {
      return prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          clerkUserId: userId,
          name: `${clerkUser.first_name ?? ''} ${clerkUser.last_name ?? ''}`.trim() || null,
        },
      });
    }
  }

  return prisma.user.upsert({
    where: { clerkUserId: userId },
    update: {},
    create: {
      clerkUserId: userId,
      email,
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
