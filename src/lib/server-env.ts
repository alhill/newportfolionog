/**
 * Server-only environment variables read at runtime from process.env.
 * Secrets and backend config should use this module so Cloud Run env vars
 * apply without rebuilding. PUBLIC_* vars stay on import.meta.env (build-time).
 */
export function getServerEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return undefined;
  }
  return value;
}

export function normalizeEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

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
