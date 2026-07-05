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
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <h3 className="text-lg font-semibold">Create your first workspace</h3>
      <p className="mt-2 text-sm text-slate-400">Give it a name and start onboarding your domains.</p>
      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Marketing Team"
          className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <button type="submit" disabled={loading} className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {loading ? 'Creating…' : 'Create workspace'}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
    </form>
  );
}
