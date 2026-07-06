'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateWorkspaceCard() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'Unable to create workspace');
      return;
    }

    router.push(`/${data.id}/overview`);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface-alt p-6 space-y-4 font-sans shadow-sm select-none">
      <div>
        <h3 className="text-base font-semibold text-ink">Create Workspace</h3>
        <p className="text-xs text-ink-muted font-mono uppercase mt-0.5 tracking-wider">Configure a new diagnostic tenant workspace</p>
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Marketing Team"
          className="flex-1 rounded-md border border-border bg-surface px-4 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px]"
        />
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="rounded-md bg-ink text-surface px-6 py-2.5 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95 border border-transparent"
        >
          {loading ? 'Creating...' : 'Create Workspace'}
        </button>
      </div>
      {error ? (
        <p className="text-xs font-mono text-accent-critical font-bold uppercase tracking-wider">
          {error}
        </p>
      ) : null}
    </form>
  );
}
