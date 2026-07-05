import Link from 'next/link';
import { notFound } from 'next/navigation';
import { UserButton, SignInButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { getUserWorkspaces, getWorkspaceForUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const navItems = [
  { href: 'overview', label: 'Overview' },
  { href: 'domain-health', label: 'Domain Health' },
  { href: 'inbox-placement', label: 'Inbox Placement' },
  { href: 'recommendations', label: 'Recommendations' },
  { href: 'history', label: 'History' },
  { href: 'settings', label: 'Settings' },
];

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceId: string };
}) {
  const membership = await getWorkspaceForUser(params.workspaceId);
  if (!membership) notFound();

  const workspaces = await getUserWorkspaces();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-800 bg-slate-900/80 p-6">
          <div className="mb-8">
            <p className="text-sm text-slate-400">InboxAI</p>
            <h1 className="text-xl font-semibold">{membership.workspace.name}</h1>
          </div>

          <div className="mb-6">
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Workspace</p>
            {workspaces.length > 1 ? (
              <select defaultValue={params.workspaceId} className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm">
                {workspaces.map((item) => (
                  <option key={item.workspace.id} value={item.workspace.id}>
                    {item.workspace.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm">{membership.workspace.name}</div>
            )}
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={`/${params.workspaceId}/${item.href}`}
                className="block rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-10 rounded-lg border border-slate-800 bg-slate-950/80 p-4">
            <p className="text-sm font-medium">Quick start</p>
            <p className="mt-2 text-sm text-slate-400">Add a domain and a sender mailbox to begin onboarding.</p>
          </div>
        </aside>

        <main className="flex-1 p-8">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Workspace</p>
              <h2 className="text-2xl font-semibold">{membership.workspace.name}</h2>
            </div>
            <div className="flex items-center gap-3">
              <SignedIn>
                <UserButton afterSignOutUrl="/sign-in" />
              </SignedIn>
              <SignedOut>
                <SignInButton />
              </SignedOut>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
