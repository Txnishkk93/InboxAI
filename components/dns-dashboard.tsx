'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Check = { id: string; checkType: string; status: string; rawValue?: string | null; parsedDetail?: any; createdAt: string };
type Domain = { id: string; domainName: string };
type Recommendation = { id: string; title: string; description: string; severity: string; confidence: number; category: string; status: string; relatedCheckIds?: any };
type ScorePoint = { id: string; totalScore: number; calculatedAt: string };

export function DnsDashboard({ workspaceId, domains }: { workspaceId: string; domains: Domain[] }) {
  const [selectedDomainId, setSelectedDomainId] = useState(domains[0]?.id ?? '');
  const [checks, setChecks] = useState<Check[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [history, setHistory] = useState<ScorePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (selectedDomainId) void loadData(selectedDomainId);
  }, [selectedDomainId]);

  async function loadData(domainId: string) {
    setLoading(true);
    const [checksRes, recRes, historyRes] = await Promise.all([
      fetch(`/api/workspaces/${workspaceId}/domains/${domainId}/checks`),
      fetch(`/api/workspaces/${workspaceId}/recommendations?domainId=${domainId}`),
      fetch(`/api/workspaces/${workspaceId}/domains/${domainId}/history`),
    ]);
    const checksData = await checksRes.json();
    const recData = await recRes.json();
    const historyData = await historyRes.json();
    setChecks(checksData);
    setRecommendations(recData);
    setHistory(historyData);
    setLoading(false);
  }

  async function scanNow() {
    if (!selectedDomainId) return;
    setLoading(true);
    const response = await fetch(`/api/workspaces/${workspaceId}/domains/${selectedDomainId}/scan`, { method: 'POST' });
    const data = await response.json();
    setLoading(false);
    setMessage(data.duplicate ? 'Scan already in progress.' : 'Scan complete.');
    if (response.ok) await loadData(selectedDomainId);
  }

  async function updateRecommendation(recommendationId: string, status: string) {
    await fetch(`/api/workspaces/${workspaceId}/recommendations/${recommendationId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    await loadData(selectedDomainId);
  }

  return (
    <div className="space-y-6">
      {message ? <div className="rounded-md bg-emerald-600/20 p-3 text-sm text-emerald-300">{message}</div> : null}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">DNS diagnostics</h3>
            <p className="text-sm text-slate-400">Run a scan, inspect results, and review recommendations.</p>
          </div>
          <div className="flex gap-3">
            <select value={selectedDomainId} onChange={(event) => setSelectedDomainId(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.domainName}</option>)}
            </select>
            <button onClick={scanNow} className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white">Scan now</button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.8fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <h4 className="font-semibold">Check results</h4>
          <div className="mt-4 space-y-3">
            {checks.map((check) => (
              <div key={check.id} className="rounded-lg border border-slate-800 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{check.checkType}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${check.status === 'pass' ? 'bg-emerald-600/20 text-emerald-300' : check.status === 'warn' ? 'bg-amber-600/20 text-amber-300' : 'bg-rose-600/20 text-rose-300'}`}>{check.status}</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{check.rawValue ?? 'No value recorded'}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <h4 className="font-semibold">Recent score history</h4>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <Line type="monotone" dataKey="totalScore" stroke="#22d3ee" strokeWidth={2} />
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="calculatedAt" hide />
                <YAxis domain={[0, 100]} />
                <Tooltip />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h4 className="font-semibold">Recommendations</h4>
        <div className="mt-4 space-y-3">
          {recommendations.map((recommendation) => (
            <div key={recommendation.id} className="rounded-lg border border-slate-800 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{recommendation.title}</p>
                  <p className="text-sm text-slate-400">{recommendation.description}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateRecommendation(recommendation.id, 'resolved')} className="rounded-md border border-slate-700 px-3 py-1 text-sm">Resolve</button>
                  <button onClick={() => updateRecommendation(recommendation.id, 'dismissed')} className="rounded-md border border-slate-700 px-3 py-1 text-sm">Dismiss</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
