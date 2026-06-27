/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly FIREBASE_PROJECT_ID: string;
  readonly FIREBASE_SERVICE_ACCOUNT: string;
  readonly FIREBASE_STORAGE_BUCKET: string;
  readonly PUBLIC_FIREBASE_API_KEY: string;
  readonly PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  readonly PUBLIC_FIREBASE_PROJECT_ID: string;
  readonly PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  readonly PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly PUBLIC_FIREBASE_APP_ID: string;
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
