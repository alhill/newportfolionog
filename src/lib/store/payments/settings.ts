import { adminDb } from '../../firebase-admin';
import { StoreError } from '../errors';
import type {
  PaymentProviderId,
  PaymentSettings,
  PaymentSettingsPublic,
  SumUpProviderConfig,
} from './types';

const ref = () => adminDb.collection('storeSettings').doc('payments');

const defaultSumUp: SumUpProviderConfig = {
  enabled: false,
  merchantCode: '',
  apiKey: '',
  updatedAt: '',
};

export const defaultPaymentSettings: PaymentSettings = {
  activeProviderId: 'sumup',
  providers: { sumup: { ...defaultSumUp } },
  updatedAt: '',
};

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function mapSumUp(raw: unknown): SumUpProviderConfig {
  const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return {
    enabled: data.enabled === true,
    merchantCode: asString(data.merchantCode).toUpperCase(),
    apiKey: asString(data.apiKey),
    updatedAt: asString(data.updatedAt),
  };
}

export function mapPaymentSettings(data: FirebaseFirestore.DocumentData | undefined): PaymentSettings {
  const providers = data?.providers && typeof data.providers === 'object' ? data.providers as Record<string, unknown> : {};
  const active = asString(data?.activeProviderId, 'sumup') as PaymentProviderId;
  return {
    activeProviderId: active === 'sumup' ? 'sumup' : 'sumup',
    providers: {
      sumup: mapSumUp(providers.sumup),
    },
    updatedAt: asString(data?.updatedAt),
  };
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const doc = await ref().get();
  return mapPaymentSettings(doc.exists ? doc.data() : undefined);
}

function maskApiKey(apiKey: string) {
  if (!apiKey) return { apiKeyConfigured: false, apiKeyHint: '' };
  const hint = apiKey.length <= 4 ? '****' : `••••${apiKey.slice(-4)}`;
  return { apiKeyConfigured: true, apiKeyHint: hint };
}

export function presentPaymentSettings(settings: PaymentSettings): PaymentSettingsPublic {
  const sumup = settings.providers.sumup;
  const masked = maskApiKey(sumup.apiKey);
  return {
    activeProviderId: settings.activeProviderId,
    providers: {
      sumup: {
        enabled: sumup.enabled,
        merchantCode: sumup.merchantCode,
        apiKeyConfigured: masked.apiKeyConfigured,
        apiKeyHint: masked.apiKeyHint,
        updatedAt: sumup.updatedAt,
      },
    },
    updatedAt: settings.updatedAt,
  };
}

export async function updatePaymentSettings(input: Record<string, unknown>): Promise<PaymentSettingsPublic> {
  const current = await getPaymentSettings();
  const providersInput = input.providers && typeof input.providers === 'object' && !Array.isArray(input.providers)
    ? input.providers as Record<string, unknown>
    : {};
  const sumupInput = providersInput.sumup && typeof providersInput.sumup === 'object' && !Array.isArray(providersInput.sumup)
    ? providersInput.sumup as Record<string, unknown>
    : {};

  const merchantCode = typeof sumupInput.merchantCode === 'string'
    ? sumupInput.merchantCode.trim().toUpperCase()
    : current.providers.sumup.merchantCode;

  if (merchantCode && !/^[A-Z0-9]{4,16}$/.test(merchantCode)) {
    throw new StoreError('El código de comercio de SumUp no es válido');
  }

  let apiKey = current.providers.sumup.apiKey;
  if (typeof sumupInput.apiKey === 'string' && sumupInput.apiKey.trim()) {
    apiKey = sumupInput.apiKey.trim();
    if (!apiKey.startsWith('sup_sk_') || apiKey.length < 20) {
      throw new StoreError('La API key de SumUp no parece válida (debe empezar por sup_sk_)');
    }
  }

  const enabled = typeof sumupInput.enabled === 'boolean'
    ? sumupInput.enabled
    : current.providers.sumup.enabled;

  if (enabled && (!merchantCode || !apiKey)) {
    throw new StoreError('Para activar SumUp hace falta merchant code y API key');
  }

  const timestamp = new Date().toISOString();
  const next: PaymentSettings = {
    activeProviderId: 'sumup',
    providers: {
      sumup: {
        enabled,
        merchantCode,
        apiKey,
        updatedAt: timestamp,
      },
    },
    updatedAt: timestamp,
  };

  await ref().set(next);
  return presentPaymentSettings(next);
}

export async function getSumUpCredentials() {
  const settings = await getPaymentSettings();
  const sumup = settings.providers.sumup;
  if (!sumup.enabled || !sumup.apiKey || !sumup.merchantCode) {
    return null;
  }
  return sumup;
}
