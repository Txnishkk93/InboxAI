import { notFound } from 'next/navigation';
import { UserButton, SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import { getUserWorkspaces, getWorkspaceForUser } from '@/lib/auth';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { DashboardNav } from '@/components/dashboard-nav';

const navItems = [
  { href: 'overview', label: 'Overview' },
  { href: 'domain-health', label: 'Domain Health' },
  { href: 'inbox-placement', label: 'Inbox Placement' },
  { href: 'recommendations', label: 'Recommendations' },
  { href: 'history', label: 'History' },
  { href: 'alerts', label: 'Alerts' },
  { href: 'domains', label: 'Domains' },
  { href: 'mailboxes', label: 'Mailboxes' },
  { href: 'team', label: 'Team' },
  { href: 'settings', label: 'Settings' },
];

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceId: string };
}) {
  if (params.workspaceId === 'favicon.ico' || params.workspaceId.includes('.')) {
    notFound();
  }

  const membership = await getWorkspaceForUser(params.workspaceId);
  if (!membership) notFound();

  const workspaces = await getUserWorkspaces();

  return (
    <div className="min-h-screen bg-surface text-ink font-sans antialiased selection:bg-ink/5 select-none">
      <div className="flex">
        {/* Fixed sidebar */}
        <aside className="fixed inset-y-0 left-0 w-72 border-r border-border bg-surface-alt p-6 z-20 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">InboxAI</p>
              <h1 className="font-serif text-2xl font-normal text-ink mt-1 tracking-tight">
                {membership.workspace.name}
              </h1>
            </div>

            <div className="space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">Workspace Selector</p>
              <WorkspaceSwitcher
                currentWorkspaceId={params.workspaceId}
                workspaces={workspaces}
                currentWorkspaceName={membership.workspace.name}
              />
            </div>

            <div className="border-t border-border/80 pt-6">
              <DashboardNav workspaceId={params.workspaceId} items={navItems} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
            <p className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-muted">OPS STATUS</p>
            <p className="text-sm text-ink-muted leading-relaxed font-sans">
              Onboarding active. Verify DNS records to compile deliverability scores.
            </p>
          </div>
        </aside>

        {/* Scrollable Main Area */}
        <div className="flex-1 pl-72 min-h-screen flex flex-col bg-surface">
          {/* Sticky minimal header */}
          <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur-sm px-8 py-4 flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <p className="text-sm font-mono text-ink-muted">Workspace</p>
              <span className="text-xs text-ink-faint">/</span>
              <h2 className="text-sm font-semibold font-sans text-ink">{membership.workspace.name}</h2>
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

          {/* Main page content */}
          <main className="flex-grow p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
