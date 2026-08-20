import { normalizeEnvValue } from './env-normalize';

/**
 * Server-only environment variables.
 *
 * Resolution order (both local and Cloud Run must work):
 * 1. process.env — Cloud Run / Docker runtime secrets and PUBLIC_* overrides
 * 2. import.meta.env — Astro/Vite loads `.env` here during `astro dev` and build
 *
 * process.env always wins so a Cloud Run revision can override values that were
 * present (or missing) at image build time.
 */

/**
 * Static access so Vite/Astro can inline `.env` values in SSR.
 * Dynamic `import.meta.env[name]` is NOT replaced and stays empty.
 */
const META_ENV: Record<string, string | undefined> = {
  FIREBASE_PROJECT_ID: import.meta.env.FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET: import.meta.env.FIREBASE_STORAGE_BUCKET,
  FIREBASE_SERVICE_ACCOUNT: import.meta.env.FIREBASE_SERVICE_ACCOUNT,
  FIREBASE_ADMIN_SDK_KEY: import.meta.env.FIREBASE_ADMIN_SDK_KEY,
  GCLOUD_PROJECT: import.meta.env.GCLOUD_PROJECT,
  GOOGLE_CLOUD_PROJECT: import.meta.env.GOOGLE_CLOUD_PROJECT,

  RESEND_API_KEY: import.meta.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: import.meta.env.RESEND_FROM_EMAIL,
  RESEND_TO_EMAIL: import.meta.env.RESEND_TO_EMAIL,

  CLOUDFLARE_TURNSTILE_SECRET_KEY: import.meta.env.CLOUDFLARE_TURNSTILE_SECRET_KEY,
  CLOUDFLARE_ACCOUNT_ID: import.meta.env.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN: import.meta.env.CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_KV_NAMESPACE_ID: import.meta.env.CLOUDFLARE_KV_NAMESPACE_ID,
  CLOUDFLARE_KV_KEY_PREFIX: import.meta.env.CLOUDFLARE_KV_KEY_PREFIX,

  R2_ACCESS_KEY_ID: import.meta.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: import.meta.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: import.meta.env.R2_BUCKET_NAME,
  R2_OBJECT_KEY_PREFIX: import.meta.env.R2_OBJECT_KEY_PREFIX,
  R2_PUBLIC_BASE_URL: import.meta.env.R2_PUBLIC_BASE_URL,

  PUBLIC_FIREBASE_PROJECT_ID: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  PUBLIC_FIREBASE_STORAGE_BUCKET: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
};

function readProcessEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return undefined;
  }
  return value;
}

function readMetaEnv(name: string): string | undefined {
  const value = META_ENV[name];
  if (typeof value !== 'string' || value === '') {
    return undefined;
  }
  return value;
}

export function getServerEnv(name: string): string | undefined {
  return readProcessEnv(name) ?? readMetaEnv(name);
}

export { normalizeEnvValue };

export function getServerEnvTrimmed(name: string): string | undefined {
  const value = getServerEnv(name);
  return value ? normalizeEnvValue(value) : undefined;
}

export function requireServerEnv(name: string): string {
  const value = getServerEnvTrimmed(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getFirebaseProjectId(): string | undefined {
  return (
    getServerEnvTrimmed('FIREBASE_PROJECT_ID') ??
    getServerEnvTrimmed('GCLOUD_PROJECT') ??
    getServerEnvTrimmed('GOOGLE_CLOUD_PROJECT') ??
    getServerEnvTrimmed('PUBLIC_FIREBASE_PROJECT_ID')
  );
}

export function parseServiceAccountJson():
  | Record<string, unknown>
  | undefined {
  const raw =
    getServerEnvTrimmed('FIREBASE_SERVICE_ACCOUNT') ??
    getServerEnvTrimmed('FIREBASE_ADMIN_SDK_KEY');

  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT/FIREBASE_ADMIN_SDK_KEY:', error);
    return undefined;
  }
}
