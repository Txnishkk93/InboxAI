'use client';

import { useState } from 'react';

export function WorkspaceSettingsForm({
  workspaceId,
  initialAlertEmail,
  initialSlackWebhookUrl,
}: {
  workspaceId: string;
  initialAlertEmail: string;
  initialSlackWebhookUrl: string;
}) {
  const [alertEmail, setAlertEmail] = useState(initialAlertEmail);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(initialSlackWebhookUrl);
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

  return (
    <form onSubmit={handleSave} className="space-y-6 font-sans">
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
  );
}
