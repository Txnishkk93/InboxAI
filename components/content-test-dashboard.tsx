'use client';

import { useState } from 'react';

type WarningItem = {
  category: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
};

const SPAM_TRIGGER_WORDS = [
  'free', 'guarantee', 'risk-free', 'winner', 'urgent', 'make money',
  'cash', 'credit', 'cheap', 'save money', 'earn extra', 'investment',
  'click here', 'act now', 'limited time', 'special promotion', 'best price',
  'million', 'mortgage', 'debt', 'consolidate', 'income', 'refinance'
];

export function ContentTestDashboard({ workspaceId }: { workspaceId: string }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<{
    score: number;
    warnings: WarningItem[];
    triggerWordsFound: string[];
    wordCount: number;
    imageCount: number;
    analyzed: boolean;
  } | null>(null);

  function analyzeContent() {
    setAnalyzing(true);
    setResults(null);

    // Simulate small latency for rich loading micro-animation
    setTimeout(() => {
      const triggerWordsFound: string[] = [];
      const warnings: WarningItem[] = [];
      let score = 100;

      const combinedText = (subject + ' ' + body).toLowerCase();

      // 1. Spam trigger words check
      SPAM_TRIGGER_WORDS.forEach((word) => {
        if (combinedText.includes(word)) {
          triggerWordsFound.push(word);
        }
      });

      if (triggerWordsFound.length > 0) {
        const deduct = Math.min(triggerWordsFound.length * 8, 40);
        score -= deduct;
        warnings.push({
          category: 'Trigger Words',
          severity: triggerWordsFound.length > 3 ? 'high' : 'medium',
          title: `Spam-Trigger Words Detected (${triggerWordsFound.length})`,
          description: `Avoid using high-risk promotional phrasing: "${triggerWordsFound.slice(0, 5).join(', ')}"${
            triggerWordsFound.length > 5 ? ' and others.' : '.'
          }`,
        });
      }

      // Strip HTML tags to calculate plain text word count
      const plainText = body.replace(/<[^>]*>/g, ' ');
      const words = plainText.trim().split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      // 2. Unsubscribe Link Check
      const hasUnsubscribe = body.toLowerCase().includes('unsubscribe') || 
                             /href=['"].*?(unsubscribe|optout).*?['"]/i.test(body);
      if (!hasUnsubscribe) {
        score -= 25;
        warnings.push({
          category: 'Compliance',
          severity: 'high',
          title: 'Missing Unsubscribe Action',
          description: 'Spam filters and compliance standards (CAN-SPAM/CASL) require an explicit opt-out mechanism or unsubscribe hyperlink.',
        });
      }

      // 3. Image-to-Text Ratio Check
      const imgCount = (body.match(/<img[^>]*>/gi) || []).length;
      if (imgCount > 0) {
        const charCount = plainText.replace(/\s+/g, '').length;
        if (charCount < 400) {
          score -= 15;
          warnings.push({
            category: 'Content Balance',
            severity: 'medium',
            title: 'High Image-to-Text Ratio',
            description: `Found ${imgCount} image(s) with only ${charCount} text characters. Mail filters suspicious images used to bypass text filters without sufficient context text.`,
          });
        }
      }

      // 4. Shortened URLs Check
      const shortenerDomains = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly'];
      const foundShortener = shortenerDomains.some((domain) => body.toLowerCase().includes(domain));
      if (foundShortener) {
        score -= 15;
        warnings.push({
          category: 'Links Health',
          severity: 'medium',
          title: 'Link Shorteners Detected',
          description: 'Spam filters flag shortened URLs because redirect services are frequently utilized to mask malicious destinations. Use full direct links.',
        });
      }

      // 5. Suspicious/Raw IP Links Check
      const hasIpLink = /\bhttps?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/i.test(body);
      if (hasIpLink) {
        score -= 20;
        warnings.push({
          category: 'Links Health',
          severity: 'high',
          title: 'Raw IP URL Destination Found',
          description: 'Avoid links pointing directly to IP addresses (e.g. http://192.168.0.1). Authenticated domains must resolve via standard DNS namespaces.',
        });
      }

      score = Math.max(0, score);

      setResults({
        score,
        warnings,
        triggerWordsFound,
        wordCount,
        imageCount: imgCount,
        analyzed: true,
      });
      setAnalyzing(false);
    }, 800);
  }

  return (
    <div className="space-y-6 font-sans select-none">
      {/* Page Header */}
      <div className="rounded-xl border border-border bg-surface-alt p-6">
        <h3 className="text-lg font-serif font-normal text-ink tracking-tight">Content & Spam-Trigger Test</h3>
        <p className="text-sm text-ink-muted mt-1 font-mono uppercase tracking-wider text-[11px]">
          Score email layout and phrasing parameters before sending
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor Inputs */}
        <div className="rounded-xl border border-border bg-surface-alt p-6 space-y-4">
          <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-2 border-b border-border pb-3">
            COMPOSITION CHECKER
          </h4>

          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-ink-muted">Subject Line</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject line..."
              className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-ink-muted">Body Content (HTML or Plain Text)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Paste email body HTML or plain text here..."
              rows={12}
              className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-base text-ink font-mono focus:outline-none focus:ring-2 focus:ring-ink transition"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={analyzeContent}
              disabled={analyzing || (!subject.trim() && !body.trim())}
              className="w-full rounded-md bg-ink text-surface px-6 py-2.5 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95 border border-transparent"
            >
              {analyzing ? 'Analyzing Composition Phrasing...' : 'Analyze Content'}
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          {analyzing ? (
            <div className="h-full min-h-[350px] flex flex-col items-center justify-center border border-border rounded-xl bg-surface-alt">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink border-t-transparent mb-2" />
              <p className="text-xs font-mono text-ink-muted">RUNNING SPAM CHECK ALGORITHMS...</p>
            </div>
          ) : results?.analyzed ? (
            <div className="space-y-6">
              {/* Score breakdown card */}
              <div className="rounded-xl border border-border bg-surface-alt p-6 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <span className="text-xs font-mono uppercase tracking-[0.25em] text-ink-muted">Content Quality Score</span>
                    <span className="text-xs font-mono text-ink-muted uppercase">Audit Completed</span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-4">
                    <span className="font-serif text-7xl font-normal text-ink tracking-tight">
                      {results.score}
                    </span>
                    <span className="font-mono text-lg text-ink-muted">/ 100</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 border-t border-border pt-4 text-xs font-mono text-ink-muted">
                  <div>
                    WORD COUNT: <span className="text-ink font-semibold">{results.wordCount}</span>
                  </div>
                  <div>
                    IMAGE COUNT: <span className="text-ink font-semibold">{results.imageCount}</span>
                  </div>
                </div>
              </div>

              {/* Warnings matrix */}
              <div className="rounded-xl border border-border bg-surface-alt p-6">
                <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-4 border-b border-border pb-3">
                  DIAGNOSTIC CRITIQUE ({results.warnings.length})
                </h4>

                {results.warnings.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm font-serif text-ink tracking-tight">Excellent Copy Alignment</p>
                    <p className="text-xs font-mono text-ink-muted mt-1 uppercase">0 WARNINGS TRIGGERED</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {results.warnings.map((warning, index) => {
                      const isHigh = warning.severity === 'high';
                      return (
                        <div
                          key={index}
                          className={`p-4 rounded border bg-surface transition-colors ${
                            isHigh
                              ? 'border-l-4 border-l-accent-critical border-border'
                              : 'border-l-2 border-l-border-strong border-border'
                          }`}
                        >
                          <div className="flex justify-between items-center text-[10px] font-mono mb-1.5">
                            <span className="text-ink-muted uppercase tracking-wider">{warning.category}</span>
                            <span className={`font-semibold uppercase tracking-wider ${isHigh ? 'text-accent-critical' : 'text-ink-muted'}`}>
                              {warning.severity} priority
                            </span>
                          </div>
                          <h5 className="text-sm font-semibold text-ink leading-snug">{warning.title}</h5>
                          <p className="text-xs text-ink-muted mt-1 leading-normal">{warning.description}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[350px] flex flex-col items-center justify-center border border-border rounded-xl bg-surface-alt p-8 text-center">
              <div className="h-10 w-10 rounded-full border-2 border-border-strong flex items-center justify-center font-mono text-ink-muted mx-auto">?</div>
              <h4 className="mt-4 text-base font-serif text-ink tracking-tight">Awaiting Composition Input</h4>
              <p className="mt-2 text-sm text-ink-muted leading-relaxed max-w-sm">
                Enter your subject line and compose or paste the body template on the left, then click analyze to check for inbox deliverability risks.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
