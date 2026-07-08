import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface AlertRule {
  workspaceId: string;
  blacklistAlert: boolean;
  dnsAlert: boolean;
  placementDropAlert: boolean;
  placementThreshold: number;
  dmarcAlert: boolean;
}

export interface ApiKey {
  id: string;
  workspaceId: string;
  description: string;
  keyPrefix: string;
  hash: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const STORE_PATH = path.join(process.cwd(), 'lib/custom-store.json');

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return { rules: [], apiKeys: [] };
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { rules: [], apiKeys: [] };
  }
}

function writeStore(data: any) {
  try {
    // Ensure parent directories exist
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write local custom store:', err);
  }
}

export async function getAlertRules(workspaceId: string): Promise<AlertRule> {
  const store = readStore();
  const rule = store.rules.find((r: any) => r.workspaceId === workspaceId);
  if (rule) return rule;

  const defaultRule: AlertRule = {
    workspaceId,
    blacklistAlert: true,
    dnsAlert: true,
    placementDropAlert: true,
    placementThreshold: 80,
    dmarcAlert: true,
  };
  return defaultRule;
}

export async function saveAlertRules(workspaceId: string, updates: Partial<AlertRule>): Promise<AlertRule> {
  const store = readStore();
  const index = store.rules.findIndex((r: any) => r.workspaceId === workspaceId);
  const current = index >= 0 ? store.rules[index] : {
    workspaceId,
    blacklistAlert: true,
    dnsAlert: true,
    placementDropAlert: true,
    placementThreshold: 80,
    dmarcAlert: true,
  };

  const updated = { ...current, ...updates };
  if (index >= 0) {
    store.rules[index] = updated;
  } else {
    store.rules.push(updated);
  }
  writeStore(store);
  return updated;
}

export async function getApiKeys(workspaceId: string): Promise<Omit<ApiKey, 'hash'>[]> {
  const store = readStore();
  return store.apiKeys
    .filter((k: any) => k.workspaceId === workspaceId)
    .map(({ hash, ...rest }: any) => rest);
}

export async function createApiKey(workspaceId: string, description: string): Promise<{ keyRecord: Omit<ApiKey, 'hash'>, secret: string }> {
  const store = readStore();
  const id = `key_${Math.random().toString(36).substring(2, 11)}`;
  const rawKey = `ibx_live_${crypto.randomBytes(24).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 13) + '...' + rawKey.substring(rawKey.length - 4);

  const keyRecord: ApiKey = {
    id,
    workspaceId,
    description,
    keyPrefix,
    hash,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };

  store.apiKeys.push(keyRecord);
  writeStore(store);

  const { hash: _, ...publicRecord } = keyRecord;
  return { keyRecord: publicRecord, secret: rawKey };
}

export async function deleteApiKey(workspaceId: string, id: string): Promise<boolean> {
  const store = readStore();
  const initialLen = store.apiKeys.length;
  store.apiKeys = store.apiKeys.filter((k: any) => !(k.id === id && k.workspaceId === workspaceId));
  writeStore(store);
  return store.apiKeys.length < initialLen;
}

export async function validateApiKey(key: string): Promise<string | null> {
  const store = readStore();
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const index = store.apiKeys.findIndex((k: any) => k.hash === hash);
  if (index < 0) return null;

  const keyRecord = store.apiKeys[index];
  keyRecord.lastUsedAt = new Date().toISOString();
  store.apiKeys[index] = keyRecord;
  writeStore(store);

  return keyRecord.workspaceId;
}
