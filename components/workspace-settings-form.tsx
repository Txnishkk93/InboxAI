'use client';

import { useState } from 'react';

type ApiKeyItem = {
  id: string;
  workspaceId: string;
  description: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function WorkspaceSettingsForm({
  workspaceId,
  initialAlertEmail,
  initialSlackWebhookUrl,
  initialApiKeys,
}: {
  workspaceId: string;
  initialAlertEmail: string;
  initialSlackWebhookUrl: string;
  initialApiKeys: ApiKeyItem[];
}) {
  const [alertEmail, setAlertEmail] = useState(initialAlertEmail);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(initialSlackWebhookUrl);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>(initialApiKeys);

  // Key creation state
  const [keyDescription, setKeyDescription] = useState('');
  const [newSecretKey, setNewSecretKey] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const formData = new FormData();
    formData.append('alertEmail', alertEmail);
    formData.append('slackWebhookUrl', slackWebhookUrl);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/settings`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      setMessage('Workspace settings saved successfully.');
    } catch (err: any) {
      setError(err.message ?? 'Failed to update settings.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTest() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/settings/test`);
      if (response.status === 400) {
        const data = await response.json();
        throw new Error(data.error ?? 'Test alert failure.');
      }
      if (!response.ok) {
        throw new Error('Failed to send test alert.');
      }
      setMessage('Test alert queued successfully.');
    } catch (err: any) {
      setError(err.message ?? 'Failed to send test alert.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyDescription.trim()) return;

    setLoading(true);
    setMessage(null);
    setError(null);
    setNewSecretKey(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/settings/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: keyDescription.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate API key.');
      }

      setApiKeys((current) => [...current, data.keyRecord]);
      setNewSecretKey(data.secret);
      setKeyDescription('');
      setMessage('API key generated successfully.');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRevokeKey(keyId: string) {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/settings/keys?id=${keyId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to revoke API key.');
      }

      setApiKeys((current) => current.filter((k) => k.id !== keyId));
      setMessage('API key revoked successfully.');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(isoString: string | null) {
    if (!isoString) return 'NEVER USED';
    const d = new Date(isoString);
    return (
      d.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' }) +
      ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  }

  return (
    <div className="space-y-8 font-sans">
      {message ? (
        <div className="rounded-md border border-border bg-surface-alt px-4 py-3 text-sm text-ink font-mono tracking-tight flex items-center justify-between">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage(null)} className="text-ink-muted hover:text-ink font-semibold">&times;</button>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-accent-critical/20 bg-surface px-4 py-3 text-sm text-accent-critical font-mono tracking-tight flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-accent-critical hover:text-accent-critical/80 font-semibold">&times;</button>
        </div>
      ) : null}

      {/* Workspace configurations form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-ink-muted">Alert Email</label>
          <input
            type="email"
            value={alertEmail}
            onChange={(e) => setAlertEmail(e.target.value)}
            placeholder="alerts@example.com"
            className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px] transition duration-150"
          />
          <p className="text-xs text-ink-muted font-mono uppercase tracking-wide">DESTINATION FOR SCORE_DROP & DNS FAILURE REPORTS</p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-ink-muted">Slack Webhook URL</label>
          <input
            type="url"
            value={slackWebhookUrl}
            onChange={(e) => setSlackWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px] transition duration-150"
          />
          <p className="text-xs text-ink-muted font-mono uppercase tracking-wide">INCOMING WEBHOOK INTEGRATION ENDPOINT</p>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-ink text-surface px-6 py-2.5 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95 border border-transparent"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            type="button"
            onClick={handleSendTest}
            disabled={loading}
            className="rounded-md border border-border bg-surface-alt px-6 py-2.5 text-sm font-semibold text-ink-muted hover:text-ink hover:border-border-strong disabled:opacity-60 transition min-h-[44px] active:scale-95"
          >
            Send Test Alert
          </button>
        </div>
      </form>

      {/* API Keys configuration */}
      <div className="border-t border-border pt-8 space-y-6">
        <div>
          <h3 className="text-base font-semibold text-ink">API Keys Management</h3>
          <p className="text-xs text-ink-muted font-mono uppercase mt-0.5 tracking-wider">
            Generate and manage API keys for query authentication
          </p>
        </div>

        {/* Generate key form */}
        <form onSubmit={handleGenerateKey} className="rounded-xl border border-border bg-surface-alt p-6 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-ink">Generate New API Key</h4>
            <p className="text-[11px] text-ink-muted font-mono uppercase mt-0.5 tracking-wider">
              Create a unique key to perform external deliverability queries
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={keyDescription}
              onChange={(e) => setKeyDescription(e.target.value)}
              placeholder="Description (e.g. production servers)"
              required
              className="flex-1 rounded-md border border-border bg-surface px-4 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px]"
            />
            <button
              type="submit"
              disabled={loading || !keyDescription.trim()}
              className="rounded-md bg-ink text-surface px-6 py-2.5 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95 border border-transparent"
            >
              Generate Key
            </button>
          </div>
        </form>

        {/* New secret key display */}
        {newSecretKey && (
          <div className="rounded-md border border-border bg-surface-alt p-5 space-y-3 font-sans">
            <p className="text-xs text-accent-critical font-mono font-semibold uppercase tracking-wider">
              * Make sure to copy your API key now. You won't be able to see it again.
            </p>
            <div className="flex items-center gap-3">
              <input
                readOnly
                value={newSecretKey}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm font-mono text-ink selection:bg-ink/10"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newSecretKey);
                  alert('Copied to clipboard');
                }}
                className="rounded border border-border bg-surface px-4 py-2 text-xs font-mono font-semibold uppercase text-ink-muted hover:text-ink hover:border-border-strong transition min-h-[44px]"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* API keys table list */}
        {apiKeys.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-alt p-8 text-center">
            <p className="text-xs font-mono text-ink-muted uppercase">0 ACTIVE API KEYS GENERATED</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface-alt p-6">
            <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-4 border-b border-border pb-3">
              ACTIVE API KEYS MATRIX
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse select-text">
                <thead>
                  <tr className="border-b border-border/80 font-mono text-xs uppercase text-ink-muted">
                    <th className="py-3 px-4 font-semibold">Description</th>
                    <th className="py-3 px-4 font-semibold">Prefix</th>
                    <th className="py-3 px-4 font-semibold">Created Date</th>
                    <th className="py-3 px-4 font-semibold">Last Used Date</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((key) => (
                    <tr
                      key={key.id}
                      className="border-b border-border/60 hover:bg-surface transition-colors duration-150 group font-sans text-sm"
                    >
                      <td className="py-4 px-4 font-medium text-ink">
                        {key.description}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-ink-muted">
                        {key.keyPrefix}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-ink-muted">
                        {formatDate(key.createdAt)}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-ink-muted">
                        {formatDate(key.lastUsedAt)}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleRevokeKey(key.id)}
                          className="text-accent-critical font-bold uppercase tracking-wider text-xs hover:underline min-h-[44px] px-2"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
