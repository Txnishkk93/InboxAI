import { prisma } from '@/lib/prisma';
import { promisify } from 'node:util';
import dns from 'node:dns';
import { ENV } from '@/lib/env';
import { DnsCheckType, DnsCheckStatus } from '@prisma/client';

const resolve4 = promisify(dns.resolve4);
const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);

function normalize(value?: string | string[]) {
  if (Array.isArray(value)) return value.join(' ');
  return value ?? '';
}

async function lookupSpf(domain: string) {
  try {
    const records = await resolveTxt(domain);
    const spf = records.flat().find((value) => value.toLowerCase().startsWith('v=spf1'));
    if (!spf) return null;
    const lookupDepth = (spf.match(/\binclude:/g) || []).length + (spf.match(/\bredirect=/g) || []).length;
    return { value: spf, lookupDepth };
  } catch {
    return null;
  }
}

async function lookupDkim(domain: string) {
  const selectors = ['default', 'google', 'selector1', 'selector2'];
  for (const selector of selectors) {
    try {
      const records = await resolveTxt(`${selector}._domainkey.${domain}`);
      if (records.length) return { value: normalize(records.flat()), selector };
    } catch {
      // continue
    }
  }
  return null;
}

async function lookupDmarc(domain: string) {
  try {
    const records = await resolveTxt(`_dmarc.${domain}`);
    return { value: normalize(records.flat()) };
  } catch {
    return null;
  }
}

async function lookupMx(domain: string) {
  try {
    const records = await resolveMx(domain);
    const sorted = records.slice().sort((a, b) => a.priority - b.priority);
    return { value: sorted.map((record) => `${record.priority} ${record.exchange}`).join(', ') };
  } catch {
    return null;
  }
}

async function lookupBimi(domain: string) {
  try {
    const records = await resolveTxt(`default._bimi.${domain}`);
    return { value: normalize(records.flat()) };
  } catch {
    return null;
  }
}

export async function runDnsScan({ workspaceId, domainId }: { workspaceId: string; domainId: string }) {
  const domain = await prisma.domain.findFirst({ where: { id: domainId, workspaceId, deletedAt: null } });
  if (!domain) throw new Error('Domain not found');

  const existingScan = await prisma.dnsScan.findFirst({
    where: { domainId, status: 'running' },
  });
  if (existingScan) return { existingScan, duplicate: true };

  const scan = await prisma.dnsScan.create({
    data: {
      workspaceId,
      domainId,
      triggeredBy: 'manual',
      status: 'running',
      startedAt: new Date(),
    },
  });

  const domainName = domain.domainName;
  const [spf, dkim, dmarc, mx, bimi] = await Promise.all([
    lookupSpf(domainName),
    lookupDkim(domainName),
    lookupDmarc(domainName),
    lookupMx(domainName),
    lookupBimi(domainName),
  ]);

  const checks: {
    dnsScanId: string;
    checkType: DnsCheckType;
    status: DnsCheckStatus;
    rawValue: string | null;
    parsedDetail: any;
  }[] = [
    {
      dnsScanId: scan.id,
      checkType: 'spf',
      status: (!spf ? 'fail' : spf.lookupDepth > 10 ? 'warn' : 'pass') as DnsCheckStatus,
      rawValue: spf?.value ?? null,
      parsedDetail: spf ? { lookupDepth: spf.lookupDepth } : null,
    },
    {
      dnsScanId: scan.id,
      checkType: 'dkim',
      status: (!dkim ? 'fail' : 'pass') as DnsCheckStatus,
      rawValue: dkim?.value ?? null,
      parsedDetail: dkim ? { selector: dkim.selector } : null,
    },
    {
      dnsScanId: scan.id,
      checkType: 'dmarc',
      status: (!dmarc ? 'fail' : /p=none/i.test(dmarc.value) ? 'warn' : 'pass') as DnsCheckStatus,
      rawValue: dmarc?.value ?? null,
      parsedDetail: dmarc ? { policy: /p=none/i.test(dmarc.value) ? 'none' : 'quarantine/reject' } : null,
    },
    {
      dnsScanId: scan.id,
      checkType: 'mx',
      status: (!mx ? 'fail' : 'pass') as DnsCheckStatus,
      rawValue: mx?.value ?? null,
      parsedDetail: mx ? { records: mx.value } : null,
    },
    {
      dnsScanId: scan.id,
      checkType: 'bimi',
      status: (!bimi ? 'fail' : 'pass') as DnsCheckStatus,
      rawValue: bimi?.value ?? null,
      parsedDetail: bimi ? { present: true } : null,
    },
  ];

  const domainFrom = domainName;
  const alignmentStatus = !spf || !dkim ? 'fail' : (domainFrom && dkim.value?.includes(domainFrom) ? 'pass' : 'fail');
  checks.push({
    dnsScanId: scan.id,
    checkType: 'alignment',
    status: alignmentStatus as DnsCheckStatus,
    rawValue: `${spf?.value ?? 'missing'} | ${dkim?.value ?? 'missing'}`,
    parsedDetail: { spfPresent: Boolean(spf), dkimPresent: Boolean(dkim), fromDomain: domainFrom },
  });

  await prisma.$transaction([
    prisma.dnsScanCheck.createMany({ data: checks }),
    prisma.dnsScan.update({ where: { id: scan.id }, data: { status: 'complete', completedAt: new Date() } }),
  ]);

  const latestChecks = await prisma.dnsScanCheck.findMany({ where: { dnsScanId: scan.id } });
  const previousScan = await prisma.dnsScan.findFirst({ where: { domainId, workspaceId, id: { not: scan.id } }, orderBy: { startedAt: 'desc' } });
  const previousChecks = previousScan ? await prisma.dnsScanCheck.findMany({ where: { dnsScanId: previousScan.id } }) : [];
  const previousScoreRecord = previousScan ? await prisma.scoreHistory.findFirst({ where: { workspaceId, domainId }, orderBy: { calculatedAt: 'desc' } }) : null;
  const previousScore = previousScoreRecord?.totalScore ?? null;
  const score = calculateScore(latestChecks, []);
  await prisma.scoreHistory.create({
    data: {
      workspaceId,
      domainId,
      scoreVersion: 'v1',
      totalScore: score.totalScore,
      scoreBreakdown: score.scoreBreakdown,
      rawSignals: score.rawSignals,
    },
  });
  await createRecommendations({ workspaceId, domainId, checks: latestChecks });
  await import('@/lib/alerts').then(({ evaluateScoreDrop, evaluateDnsCheckFailures }) => Promise.all([
    evaluateScoreDrop({ workspaceId, domainId, currentScore: score.totalScore, previousScore }),
    evaluateDnsCheckFailures({ workspaceId, domainId, currentChecks: latestChecks, previousChecks }),
  ]));

  return { scan, duplicate: false };
}

export function calculateScore(checks: { checkType: string; status: string }[], placementTests: Array<{ provider: string; result: string }> = []) {
  const lookup = new Map(checks.map((check) => [check.checkType, check]));
  const scoreBreakdown = {
    authenticationHealth: 100,
    infrastructureHealth: 100,
    placementPerformance: 100,
    sendingPatternRisk: 100,
    reputationRisk: 100,
  };

  let total = 100;
  let placementPenalty = 0;

  if (lookup.get('dmarc')?.status === 'fail') total -= 15;
  if (lookup.get('spf')?.status === 'warn') total -= 8;
  if (lookup.get('alignment')?.status === 'fail') total -= 12;
  if (lookup.get('spf')?.status === 'fail') total -= 15;
  if (lookup.get('mx')?.status === 'fail') total -= 20;
  if (lookup.get('dkim')?.status === 'fail') total -= 12;

  const gmailResults = placementTests.filter((test) => test.provider === 'gmail' && test.result !== 'pending');
  if (gmailResults.length >= 3 && (gmailResults.filter((test) => test.result === 'spam').length / gmailResults.length) > 0.5) {
    total -= 20;
    placementPenalty += 20;
  }

  const outlookResults = placementTests.filter((test) => test.provider === 'outlook' && test.result !== 'pending');
  if (outlookResults.length >= 2 && (outlookResults.filter((test) => test.result === 'inbox').length / outlookResults.length) < 0.5) {
    total -= 10;
    placementPenalty += 10;
  }

  scoreBreakdown.authenticationHealth = Math.max(0, 100 - (lookup.get('dmarc')?.status === 'fail' ? 15 : 0) - (lookup.get('alignment')?.status === 'fail' ? 12 : 0) - (lookup.get('dkim')?.status === 'fail' ? 12 : 0));
  scoreBreakdown.infrastructureHealth = Math.max(0, 100 - (lookup.get('spf')?.status === 'fail' ? 15 : 0) - (lookup.get('spf')?.status === 'warn' ? 8 : 0) - (lookup.get('mx')?.status === 'fail' ? 20 : 0));
  scoreBreakdown.placementPerformance = Math.max(0, 100 - placementPenalty);

  return {
    totalScore: Math.max(0, Math.min(100, total)),
    scoreBreakdown,
    rawSignals: {
      ...Object.fromEntries(checks.map((check) => [check.checkType, check.status])),
      placement: placementTests.slice(0, 6).map((test) => `${test.provider}:${test.result}`),
    },
  };
}

export async function createRecommendations({ workspaceId, domainId, checks, placementTests = [] }: { workspaceId: string; domainId: string; checks: { id: string; checkType: string; status: string }[]; placementTests?: Array<{ provider: string; result: string }> }) {
  await prisma.recommendation.deleteMany({ where: { workspaceId, domainId } });

  const entries: Array<{ workspaceId: string; domainId: string; title: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical'; confidence: number; category: string; relatedCheckIds: string[] }> = [];

  const dmarc = checks.find((check) => check.checkType === 'dmarc');
  if (dmarc?.status === 'fail') {
    entries.push({ workspaceId, domainId, title: 'Add a DMARC record', description: 'A DMARC record is missing, which leaves your domain without a policy for message handling.', severity: 'critical', confidence: 95, category: 'authentication', relatedCheckIds: [dmarc.id] });
  }

  const spf = checks.find((check) => check.checkType === 'spf');
  const dkim = checks.find((check) => check.checkType === 'dkim');
  const alignment = checks.find((check) => check.checkType === 'alignment');
  if (spf?.status === 'pass' && alignment?.status === 'fail') {
    entries.push({ workspaceId, domainId, title: 'Fix DKIM alignment', description: 'The domain alignment check failed even though SPF is present.', severity: 'high', confidence: 90, category: 'authentication', relatedCheckIds: [spf.id, dkim?.id ?? '', alignment.id].filter(Boolean) });
  }

  if (spf?.status === 'warn') {
    entries.push({ workspaceId, domainId, title: 'Consolidate SPF includes', description: 'The SPF record uses too much indirection for safe DNS evaluation.', severity: 'medium', confidence: 88, category: 'infrastructure', relatedCheckIds: [spf.id] });
  }

  const gmailResults = placementTests.filter((test) => test.provider === 'gmail' && test.result !== 'pending');
  const allDnsPassing = spf?.status === 'pass' && dkim?.status === 'pass' && dmarc?.status === 'pass';
  if (allDnsPassing && gmailResults.length >= 2 && gmailResults.filter((test) => test.result === 'spam').length >= 2) {
    entries.push({ workspaceId, domainId, title: 'Likely sending pattern or content reputation issue', description: 'DNS authentication is healthy, but Gmail placement is still landing in spam.', severity: 'high', confidence: 92, category: 'placement', relatedCheckIds: [spf?.id ?? '', dkim?.id ?? '', dmarc?.id ?? ''].filter(Boolean) });
  }

  if (dmarc?.status === 'fail' && gmailResults.filter((test) => test.result === 'spam').length >= 1) {
    entries.push({ workspaceId, domainId, title: 'Fix DMARC first — likely root cause of placement failure', description: 'DMARC is failing and Gmail is already classifying messages as spam.', severity: 'critical', confidence: 96, category: 'placement', relatedCheckIds: [dmarc.id] });
  }

  if (entries.length) {
    await prisma.recommendation.createMany({
      data: entries.map((entry) => ({ ...entry, relatedCheckIds: entry.relatedCheckIds })),
    });
  }
}

export async function getExplanationForRecommendation({ title, description, severity, relatedChecks }: { title: string; description: string; severity: string; relatedChecks: Array<{ checkType: string; status: string }> }) {
  const apiKey = ENV.openAiApiKey;
  if (!apiKey) {
    return `What\'s wrong: ${title}.\nWhy it matters: ${description}.\nWhat to do next: Raise the ${severity} issue in your DNS configuration and review the related checks (${relatedChecks.map((check) => `${check.checkType}:${check.status}`).join(', ')}).`;
  }

  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: 'gpt-4o-mini',
    input: `Write a short plain-English explanation card for this recommendation. Use exactly three sections labeled 'What's wrong', 'Why it matters', and 'What to do next'. Recommendation: ${title} - ${description} - Severity: ${severity}. Related checks: ${relatedChecks.map((check) => `${check.checkType}:${check.status}`).join(', ')}.`,
  });

  return response.output_text ?? 'No explanation available.';
}
