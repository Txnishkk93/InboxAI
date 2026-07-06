import { redirect } from 'next/navigation';
import { SignedIn, UserButton } from '@clerk/nextjs';
import { getUserWorkspaces } from '@/lib/auth';
import { CreateWorkspaceCard } from '@/components/create-workspace-card';

export default async function HomePage() {
  const workspaces = await getUserWorkspaces();

  if (workspaces.length > 0) {
    redirect(`/${workspaces[0].workspaceId}/overview`);
  }

  return (
    <div className="min-h-screen bg-surface text-ink flex flex-col font-sans select-none">
      <header className="border-b border-border bg-surface-alt px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-md bg-ink" />
          <h1 className="text-xl font-bold tracking-tight text-ink font-serif font-normal">InboxAI</h1>
        </div>
        <div className="flex items-center gap-3">
          <SignedIn>
            <UserButton afterSignOutUrl="/sign-in" />
          </SignedIn>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-6 bg-surface">
        <div className="w-full max-w-xl">
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl bg-border-strong opacity-5 blur-xl" />
            <div className="relative">
              <CreateWorkspaceCard />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
