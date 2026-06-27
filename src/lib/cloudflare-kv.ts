import Cloudflare, { NotFoundError } from 'cloudflare';
import type { Key } from 'cloudflare/resources/kv/namespaces/keys';

export class KvNotConfiguredError extends Error {
  constructor() {
    super(
      'Cloudflare KV no está configurado. Define CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN y CLOUDFLARE_KV_NAMESPACE_ID.',
    );
    this.name = 'KvNotConfiguredError';
  }
}

interface KvConfig {
  accountId: string;
  apiToken: string;
  namespaceId: string;
  keyPrefix: string;
}

function readConfig(): Partial<KvConfig> {
  return {
    accountId: import.meta.env.CLOUDFLARE_ACCOUNT_ID?.trim(),
    apiToken: import.meta.env.CLOUDFLARE_API_TOKEN?.trim(),
    namespaceId: import.meta.env.CLOUDFLARE_KV_NAMESPACE_ID?.trim(),
    keyPrefix: import.meta.env.CLOUDFLARE_KV_KEY_PREFIX?.trim() ?? '',
  };
}

function requireConfig(): KvConfig {
  const config = readConfig();

  if (!config.accountId || !config.apiToken || !config.namespaceId) {
    throw new KvNotConfiguredError();
  }

  return {
    accountId: config.accountId,
    apiToken: config.apiToken,
    namespaceId: config.namespaceId,
    keyPrefix: config.keyPrefix ?? '',
  };
}

let client: Cloudflare | null = null;

function getClient(): Cloudflare {
  const { apiToken } = requireConfig();

  if (!client) {
    client = new Cloudflare({ apiToken });
  }

  return client;
}

function resolveKey(key: string): string {
  const { keyPrefix } = requireConfig();
  return keyPrefix ? `${keyPrefix}${key}` : key;
}

function resolveListPrefix(prefix?: string): string | undefined {
  const { keyPrefix } = requireConfig();
  const combined = `${keyPrefix}${prefix ?? ''}`;
  return combined || undefined;
}

export function isKvConfigured(): boolean {
  const config = readConfig();
  return Boolean(config.accountId && config.apiToken && config.namespaceId);
}

export interface KvPutOptions {
  expirationTtl?: number;
  expiration?: number;
  metadata?: unknown;
}

export interface KvListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface KvListResult {
  keys: Key[];
  cursor?: string;
  listComplete: boolean;
}

export async function getKvValue(key: string): Promise<string | null> {
  const { accountId, namespaceId } = requireConfig();

  try {
    const response = await getClient().kv.namespaces.values.get(namespaceId, resolveKey(key), {
      account_id: accountId,
    });

    return await response.text();
  } catch (error) {
    if (error instanceof NotFoundError) {
      return null;
    }

    throw error;
  }
}

export async function getKvJson<T>(key: string): Promise<T | null> {
  const value = await getKvValue(key);
  if (value === null) {
    return null;
  }

  return JSON.parse(value) as T;
}

export async function putKvValue(
  key: string,
  value: string,
  options: KvPutOptions = {},
): Promise<void> {
  const { accountId, namespaceId } = requireConfig();

  await getClient().kv.namespaces.values.update(namespaceId, resolveKey(key), {
    account_id: accountId,
    value,
    expiration_ttl: options.expirationTtl,
    expiration: options.expiration,
    metadata: options.metadata,
  });
}

export async function putKvJson(
  key: string,
  value: unknown,
  options: KvPutOptions = {},
): Promise<void> {
  await putKvValue(key, JSON.stringify(value), options);
}

export async function deleteKvValue(key: string): Promise<void> {
  const { accountId, namespaceId } = requireConfig();

  await getClient().kv.namespaces.values.delete(namespaceId, resolveKey(key), {
    account_id: accountId,
  });
}

export async function listKvKeys(options: KvListOptions = {}): Promise<KvListResult> {
  const { accountId, namespaceId } = requireConfig();

  const page = await getClient().kv.namespaces.keys.list(namespaceId, {
    account_id: accountId,
    prefix: resolveListPrefix(options.prefix),
    limit: options.limit,
    cursor: options.cursor,
  });

  return {
    keys: page.result,
    cursor: page.result_info?.cursor,
    listComplete: !page.result_info?.cursor,
  };
}
