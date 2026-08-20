/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_FIREBASE_API_KEY: string;
  readonly PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  readonly PUBLIC_FIREBASE_PROJECT_ID: string;
  readonly PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  readonly PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly PUBLIC_FIREBASE_APP_ID: string;
  readonly PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY?: string;
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
