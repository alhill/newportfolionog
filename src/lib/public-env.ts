import { getServerEnvTrimmed, normalizeEnvValue } from './server-env';

export const PUBLIC_ENV_KEYS = [
  'PUBLIC_FIREBASE_API_KEY',
  'PUBLIC_FIREBASE_AUTH_DOMAIN',
  'PUBLIC_FIREBASE_PROJECT_ID',
  'PUBLIC_FIREBASE_STORAGE_BUCKET',
  'PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'PUBLIC_FIREBASE_APP_ID',
  'PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY',
] as const;

export type PublicEnvKey = (typeof PUBLIC_ENV_KEYS)[number];
export type PublicEnv = Partial<Record<PublicEnvKey, string>>;

declare global {
  interface Window {
    __PUBLIC_ENV__?: PublicEnv;
  }
}

const PUBLIC_ENV_ALIASES: Partial<Record<PublicEnvKey, readonly string[]>> = {
  PUBLIC_FIREBASE_API_KEY: ['FIREBASE_API_KEY'],
  PUBLIC_FIREBASE_AUTH_DOMAIN: ['FIREBASE_AUTH_DOMAIN'],
  PUBLIC_FIREBASE_PROJECT_ID: ['FIREBASE_PROJECT_ID'],
  PUBLIC_FIREBASE_STORAGE_BUCKET: ['FIREBASE_STORAGE_BUCKET'],
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ['FIREBASE_MESSAGING_SENDER_ID'],
  PUBLIC_FIREBASE_APP_ID: ['FIREBASE_APP_ID'],
};

/**
 * Static access so Vite can inline values at build time.
 * Dynamic import.meta.env[key] is NOT replaced during production builds.
 */
const BUILD_TIME_PUBLIC_ENV: PublicEnv = {
  PUBLIC_FIREBASE_API_KEY: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  PUBLIC_FIREBASE_AUTH_DOMAIN: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  PUBLIC_FIREBASE_PROJECT_ID: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  PUBLIC_FIREBASE_STORAGE_BUCKET: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  PUBLIC_FIREBASE_APP_ID: import.meta.env.PUBLIC_FIREBASE_APP_ID,
  PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY: import.meta.env.PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY,
};

function readBuildTimeValue(key: PublicEnvKey): string | undefined {
  const value = BUILD_TIME_PUBLIC_ENV[key];
  return typeof value === 'string' && value.trim() !== '' ? normalizeEnvValue(value) : undefined;
}

function readServerValue(key: PublicEnvKey): string | undefined {
  const direct = getServerEnvTrimmed(key);
  if (direct) {
    return direct;
  }

  const aliases = PUBLIC_ENV_ALIASES[key] ?? [];
  for (const alias of aliases) {
    const aliasValue = getServerEnvTrimmed(alias);
    if (aliasValue) {
      return aliasValue;
    }
  }

  return undefined;
}

let cachedClientEnv: PublicEnv | null = null;

function readPublicEnvFromDom(): PublicEnv {
  if (typeof document === 'undefined') {
    return {};
  }

  const element = document.getElementById('public-env-data');
  if (!element?.textContent?.trim()) {
    return {};
  }

  try {
    return JSON.parse(element.textContent) as PublicEnv;
  } catch {
    return {};
  }
}

/** Browser: values injected by PublicEnvScript on each HTML response. */
export function getClientPublicEnv(): PublicEnv {
  if (typeof window === 'undefined') {
    return {};
  }

  if (window.__PUBLIC_ENV__ && Object.keys(window.__PUBLIC_ENV__).length > 0) {
    return window.__PUBLIC_ENV__;
  }

  if (!cachedClientEnv) {
    cachedClientEnv = readPublicEnvFromDom();
    if (Object.keys(cachedClientEnv).length > 0) {
      window.__PUBLIC_ENV__ = cachedClientEnv;
    }
  }

  return cachedClientEnv;
}

/** Server-side: Cloud Run env vars override build-time values. */
export function getPublicEnv(): PublicEnv {
  const env: PublicEnv = {};

  for (const key of PUBLIC_ENV_KEYS) {
    const value = readServerValue(key) ?? readBuildTimeValue(key);
    if (value) {
      env[key] = value;
    }
  }

  return env;
}

export function getPublicEnvValue(key: PublicEnvKey): string | undefined {
  return getPublicEnv()[key];
}

export function resolvePublicEnvValue(key: PublicEnvKey): string | undefined {
  if (typeof window !== 'undefined') {
    const runtimeValue = getClientPublicEnv()[key];
    if (runtimeValue) {
      return normalizeEnvValue(runtimeValue);
    }
  } else {
    const serverValue = readServerValue(key);
    if (serverValue) {
      return serverValue;
    }
  }

  return readBuildTimeValue(key);
}
