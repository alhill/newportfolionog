/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_FIREBASE_API_KEY: string;
  readonly PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  readonly PUBLIC_FIREBASE_PROJECT_ID: string;
  readonly PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  readonly PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly PUBLIC_FIREBASE_APP_ID: string;
  readonly PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY?: string;

  // Server-only (Astro/Vite `.env` in SSR). Prefer process.env at Cloud Run runtime.
  readonly FIREBASE_PROJECT_ID?: string;
  readonly FIREBASE_STORAGE_BUCKET?: string;
  readonly FIREBASE_SERVICE_ACCOUNT?: string;
  readonly FIREBASE_ADMIN_SDK_KEY?: string;
  readonly GCLOUD_PROJECT?: string;
  readonly GOOGLE_CLOUD_PROJECT?: string;
  readonly RESEND_API_KEY?: string;
  readonly RESEND_FROM_EMAIL?: string;
  readonly RESEND_TO_EMAIL?: string;
  readonly CLOUDFLARE_TURNSTILE_SECRET_KEY?: string;
  readonly CLOUDFLARE_ACCOUNT_ID?: string;
  readonly CLOUDFLARE_API_TOKEN?: string;
  readonly CLOUDFLARE_KV_NAMESPACE_ID?: string;
  readonly CLOUDFLARE_KV_KEY_PREFIX?: string;
  readonly R2_ACCESS_KEY_ID?: string;
  readonly R2_SECRET_ACCESS_KEY?: string;
  readonly R2_BUCKET_NAME?: string;
  readonly R2_OBJECT_KEY_PREFIX?: string;
  readonly R2_PUBLIC_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    user?: {
      uid: string;
      email?: string | null;
    };
  }
}
