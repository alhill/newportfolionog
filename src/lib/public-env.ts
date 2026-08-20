import { normalizeEnvValue } from './env-normalize';

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

/**
 * Static access so Vite can inline values at build time / in `astro dev`.
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

/** Cloud Run runtime overrides for PUBLIC_* (normal env vars, not Secret Manager). */
function readRuntimePublicValue(key: PublicEnvKey): string | undefined {
  if (typeof process === 'undefined' || !process.env) {
    return undefined;
  }
  const value = process.env[key];
  if (value === undefined || value === '') {
    return undefined;
  }
  return normalizeEnvValue(value);
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

/**
 * Server-side public config: Cloud Run process.env overrides, then Vite/Astro `.env`.
 * Do not import server-env here — this module is also used from the browser bundle.
 */
export function getPublicEnv(): PublicEnv {
  const env: PublicEnv = {};

  for (const key of PUBLIC_ENV_KEYS) {
    const value = readRuntimePublicValue(key) ?? readBuildTimeValue(key);
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
    const serverValue = readRuntimePublicValue(key);
    if (serverValue) {
      return serverValue;
    }
  }

  return readBuildTimeValue(key);
}
