import { NextResponse } from 'next/server';
import { getCurrentUserRecord } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const workspace = await prisma.workspace.create({
    data: {
      name: name.trim(),
      ownerId: user.id,
      memberships: {
        create: [{ userId: user.id, role: 'owner' }],
      },
    },
  });

  return NextResponse.json(workspace);
}
