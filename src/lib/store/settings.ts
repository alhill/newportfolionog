import { adminDb } from '../firebase-admin';
import type { StoreSettings } from '../../types/store';
import { StoreError } from './errors';
import { eurosToCents } from './money';

const ref = () => adminDb.collection('storeSettings').doc('config');

export const defaultStoreSettings: StoreSettings = {
  name: 'Tienda',
  currency: 'EUR',
  domain: '',
  shippingFlatRate: 0,
  taxRate: 21,
  lowStockThreshold: 5,
  notificationEmail: '',
  seoTitle: '',
  seoDescription: '',
  updatedAt: '',
};

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

export function mapSettings(data: FirebaseFirestore.DocumentData | undefined): StoreSettings {
  const taxRate = typeof data?.taxRate === 'number' ? data.taxRate : defaultStoreSettings.taxRate;
  const threshold = typeof data?.lowStockThreshold === 'number' ? data.lowStockThreshold : defaultStoreSettings.lowStockThreshold;
  return {
    name: asString(data?.name, defaultStoreSettings.name),
    currency: 'EUR',
    domain: asString(data?.domain),
    shippingFlatRate: typeof data?.shippingFlatRate === 'number' ? data.shippingFlatRate : 0,
    taxRate: Math.min(100, Math.max(0, taxRate)),
    lowStockThreshold: Math.min(100000, Math.max(0, Math.round(threshold))),
    notificationEmail: asString(data?.notificationEmail),
    seoTitle: asString(data?.seoTitle),
    seoDescription: asString(data?.seoDescription),
    updatedAt: asString(data?.updatedAt),
  };
}

export async function getStoreSettings() {
  const doc = await ref().get();
  return mapSettings(doc.exists ? doc.data() : undefined);
}

export async function updateStoreSettings(input: Record<string, unknown>) {
  const current = await getStoreSettings();
  const taxRate = input.taxRate == null || input.taxRate === '' ? current.taxRate : Number(input.taxRate);
  const threshold = input.lowStockThreshold == null || input.lowStockThreshold === ''
    ? current.lowStockThreshold
    : Number(input.lowStockThreshold);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new StoreError('El impuesto no es válido');
  if (!Number.isInteger(threshold) || threshold < 0) throw new StoreError('El umbral de stock no es válido');

  const shipping = input.shippingEuros == null || input.shippingEuros === ''
    ? current.shippingFlatRate
    : eurosToCents(input.shippingEuros);

  const next: StoreSettings = {
    ...current,
    name: typeof input.name === 'string' ? input.name.trim() || current.name : current.name,
    domain: typeof input.domain === 'string' ? input.domain.trim() : current.domain,
    shippingFlatRate: shipping,
    taxRate,
    lowStockThreshold: threshold,
    notificationEmail: typeof input.notificationEmail === 'string' ? input.notificationEmail.trim() : current.notificationEmail,
    seoTitle: typeof input.seoTitle === 'string' ? input.seoTitle.trim() : current.seoTitle,
    seoDescription: typeof input.seoDescription === 'string' ? input.seoDescription.trim() : current.seoDescription,
    currency: 'EUR',
    updatedAt: new Date().toISOString(),
  };

  await ref().set(next);
  return next;
}
