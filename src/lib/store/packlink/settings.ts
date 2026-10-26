import { adminDb } from '../../firebase-admin';
import { StoreError } from '../errors';
import { isSpanishPostalCode, normalizeCountryCode } from '../contact';
import { packlinkFetch } from './client';

export interface PacklinkOrigin {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  region: string;
  country: 'ES';
}

export interface PacklinkSettings {
  enabled: boolean;
  apiKey: string;
  origin: PacklinkOrigin;
  updatedAt: string;
}

export interface PacklinkSettingsPublic {
  enabled: boolean;
  apiKeyConfigured: boolean;
  apiKeyHint: string;
  origin: PacklinkOrigin;
  updatedAt: string;
}

const ref = () => adminDb.collection('storeSettings').doc('packlink');

const emptyOrigin = (): PacklinkOrigin => ({
  firstName: '',
  lastName: '',
  company: '',
  email: '',
  phone: '',
  line1: '',
  line2: '',
  postalCode: '',
  city: '',
  region: '',
  country: 'ES',
});

function asString(value: unknown, max = 180) {
  return (typeof value === 'string' ? value.trim() : '').slice(0, max);
}

function mapOrigin(raw: unknown): PacklinkOrigin {
  const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return {
    firstName: asString(data.firstName, 80),
    lastName: asString(data.lastName, 80),
    company: asString(data.company, 120),
    email: asString(data.email, 180).toLowerCase(),
    phone: asString(data.phone, 40),
    line1: asString(data.line1, 180),
    line2: asString(data.line2, 180),
    postalCode: asString(data.postalCode, 20),
    city: asString(data.city, 80),
    region: asString(data.region, 80),
    country: 'ES',
  };
}

export function mapPacklinkSettings(data: FirebaseFirestore.DocumentData | undefined): PacklinkSettings {
  return {
    enabled: data?.enabled === true,
    apiKey: asString(data?.apiKey, 400),
    origin: mapOrigin(data?.origin),
    updatedAt: asString(data?.updatedAt, 40),
  };
}

export async function getPacklinkSettings() {
  const doc = await ref().get();
  return mapPacklinkSettings(doc.exists ? doc.data() : undefined);
}

function maskApiKey(apiKey: string) {
  if (!apiKey) return { apiKeyConfigured: false, apiKeyHint: '' };
  const hint = apiKey.length <= 4 ? '••••' : `••••${apiKey.slice(-4)}`;
  return { apiKeyConfigured: true, apiKeyHint: hint };
}

export function presentPacklinkSettings(settings: PacklinkSettings): PacklinkSettingsPublic {
  return {
    enabled: settings.enabled,
    ...maskApiKey(settings.apiKey),
    origin: settings.origin,
    updatedAt: settings.updatedAt,
  };
}

function originReady(origin: PacklinkOrigin) {
  return Boolean(
    origin.firstName
    && origin.lastName
    && origin.email
    && origin.phone
    && origin.line1
    && origin.postalCode
    && origin.city,
  );
}

export async function updatePacklinkSettings(input: Record<string, unknown>) {
  const current = await getPacklinkSettings();
  const originInput = input.origin && typeof input.origin === 'object' && !Array.isArray(input.origin)
    ? input.origin as Record<string, unknown>
    : {};
  const origin = mapOrigin({ ...current.origin, ...originInput, country: 'ES' });
  if (normalizeCountryCode(originInput.country || 'ES') !== 'ES') {
    throw new StoreError('El origen del envío tiene que estar en España');
  }
  if (origin.postalCode && !isSpanishPostalCode(origin.postalCode)) {
    throw new StoreError('El código postal de origen tiene que ser de España');
  }
  if (origin.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(origin.email)) {
    throw new StoreError('El email de origen no es válido');
  }

  let apiKey = current.apiKey;
  if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
    apiKey = input.apiKey.trim();
    if (apiKey.length < 16) throw new StoreError('La API key de Packlink no parece válida');
  }

  const enabled = typeof input.enabled === 'boolean' ? input.enabled : current.enabled;
  if (enabled && (!apiKey || !originReady(origin))) {
    throw new StoreError('Para activar Packlink hace falta la API key y la dirección de origen completa');
  }

  const next: PacklinkSettings = {
    enabled,
    apiKey,
    origin,
    updatedAt: new Date().toISOString(),
  };
  await ref().set(next);
  return presentPacklinkSettings(next);
}

export async function getPacklinkCredentials() {
  const settings = await getPacklinkSettings();
  if (!settings.enabled || !settings.apiKey || !originReady(settings.origin)) return null;
  return { apiKey: settings.apiKey, origin: settings.origin };
}

export async function testPacklinkConnection() {
  const settings = await getPacklinkSettings();
  if (!settings.apiKey) {
    return { ok: false as const, message: 'Guarda una API key antes de probar la conexión' };
  }
  try {
    const body = await packlinkFetch(settings.apiKey, 'clients');
    const email = body && typeof body === 'object' && typeof (body as { email?: unknown }).email === 'string'
      ? (body as { email: string }).email
      : '';
    return {
      ok: true as const,
      message: email ? `Conexión correcta con Packlink (${email})` : 'Conexión correcta con Packlink',
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof StoreError ? error.message : 'No se pudo contactar con Packlink',
    };
  }
}
