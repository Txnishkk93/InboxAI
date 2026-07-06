import { prisma } from '@/lib/prisma';
import { ENV } from '@/lib/env';

const SCORE_DROP_THRESHOLD = 10;
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

type AlertType = 'score_drop' | 'placement_drop' | 'dns_check_failed';
type AlertChannel = 'email' | 'slack';

type AlertOptions = {
  workspaceId: string;
  domainId: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  channel?: AlertChannel;
  dedupeKey?: string;
};

function normalizeSeverity(value: number | null | undefined) {
  if (value === null || value === undefined) return 'medium';
  if (value >= 90) return 'critical';
  if (value >= 70) return 'high';
  if (value >= 40) return 'medium';
  return 'low';
}

async function getWorkspaceOwnerEmail(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace?.ownerId) return null;
  const owner = await prisma.user.findUnique({ where: { id: workspace.ownerId } });
  return owner?.email ?? null;
}

async function sendAlertDelivery({ workspace, alert, ownerEmail }: { workspace: { alertEmail?: string | null; slackWebhookUrl?: string | null }; alert: AlertOptions; ownerEmail: string | null }) {
  const targets: Array<{ channel: AlertChannel; status: 'sent' | 'failed' }> = [];

  if (workspace.alertEmail || ownerEmail) {
    try {
      const resendApiKey = ENV.resendApiKey;
      if (resendApiKey) {
        const { Resend } = await import('resend');
        const resend = new Resend(resendApiKey);
        await resend.emails.send({
          from: 'InboxAI <alerts@inboxai.app>',
          to: [workspace.alertEmail ?? ownerEmail ?? 'alerts@example.com'],
          subject: `[InboxAI] ${alert.type.replace(/_/g, ' ')}`,
          html: `<p>${alert.message}</p>`,
        });
        targets.push({ channel: 'email', status: 'sent' });
      } else {
        targets.push({ channel: 'email', status: 'failed' });
      }
    } catch {
      targets.push({ channel: 'email', status: 'failed' });
    }
  }

  if (workspace.slackWebhookUrl) {
    try {
      const response = await fetch(workspace.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: alert.message }),
      });
      if (response.ok) {
        targets.push({ channel: 'slack', status: 'sent' });
      } else {
        targets.push({ channel: 'slack', status: 'failed' });
      }
    } catch {
      targets.push({ channel: 'slack', status: 'failed' });
    }
  }

  return targets;
}

export async function createAlert(options: AlertOptions) {
  const dedupeKey = options.dedupeKey ?? `${options.domainId}:${options.type}`;
  const recentAlert = await prisma.alert.findFirst({
    where: {
      dedupeKey,
      triggeredAt: {
        gte: new Date(Date.now() - ALERT_COOLDOWN_MS),
      },
    },
    orderBy: { triggeredAt: 'desc' },
  });

  if (recentAlert) {
    console.info(`Alert suppressed for ${dedupeKey} within cooldown window.`);
    return null;
  }

  const workspace = await prisma.workspace.findUnique({ where: { id: options.workspaceId } });
  const ownerEmail = await getWorkspaceOwnerEmail(options.workspaceId);
  const alertRecord = await prisma.alert.create({
    data: {
      workspaceId: options.workspaceId,
      domainId: options.domainId,
      type: options.type,
      severity: options.severity,
      message: options.message,
      triggeredAt: new Date(),
      channel: 'email',
      status: 'pending',
      dedupeKey,
    },
  });

  const deliveries = await sendAlertDelivery({ workspace: workspace ?? {}, alert: options, ownerEmail });
  const delivered = deliveries.some((delivery) => delivery.status === 'sent');

  await prisma.alert.update({
    where: { id: alertRecord.id },
    data: {
      status: delivered ? 'sent' : 'failed',
      deliveredAt: delivered ? new Date() : null,
      channel: deliveries[0]?.channel ?? 'email',
    },
  });

  return alertRecord;
}

export async function evaluateScoreDrop({ workspaceId, domainId, currentScore, previousScore }: { workspaceId: string; domainId: string; currentScore: number; previousScore: number | null }) {
  if (previousScore === null) return null;
  const drop = previousScore - currentScore;
  if (drop <= SCORE_DROP_THRESHOLD) return null;

  return createAlert({
    workspaceId,
    domainId,
    type: 'score_drop',
    severity: normalizeSeverity(currentScore),
    message: `Score dropped from ${previousScore} to ${currentScore} for domain ${domainId}.`,
  });
}

export async function evaluateDnsCheckFailures({ workspaceId, domainId, currentChecks, previousChecks }: { workspaceId: string; domainId: string; currentChecks: Array<{ checkType: string; status: string }>; previousChecks: Array<{ checkType: string; status: string }> }) {
  const previousByType = new Map(previousChecks.map((check) => [check.checkType, check.status]));
  const failures = currentChecks.filter((check) => check.status === 'fail' && previousByType.get(check.checkType) === 'pass');

  if (failures.length === 0) return [];

  return Promise.all(failures.map((failure) => createAlert({
    workspaceId,
    domainId,
    type: 'dns_check_failed',
    severity: 'high',
    message: `DNS check ${failure.checkType} regressed to ${failure.status} for the domain.`,
  })));
}

export async function evaluatePlacementDrop({ workspaceId, domainId, currentBatchTests, previousBatchTests }: { workspaceId: string; domainId: string; currentBatchTests: Array<{ provider: string; result: string }>; previousBatchTests: Array<{ provider: string; result: string }> }) {
  const previousByProvider = new Map(previousBatchTests.map((test) => [test.provider, test.result]));
  const regressions = currentBatchTests.filter((test) => ['spam', 'missing'].includes(test.result) && previousByProvider.get(test.provider) === 'inbox');

  if (regressions.length === 0) return [];

  return Promise.all(regressions.map((regression) => createAlert({
    workspaceId,
    domainId,
    type: 'placement_drop',
    severity: 'high',
    message: `Placement for ${regression.provider} moved to ${regression.result}.`,
  })));
}

export async function createTestAlert({ workspaceId, domainId }: { workspaceId: string; domainId: string }) {
  return createAlert({
    workspaceId,
    domainId,
    type: 'dns_check_failed',
    severity: 'medium',
    message: 'This is a test alert from InboxAI.',
  });
}
