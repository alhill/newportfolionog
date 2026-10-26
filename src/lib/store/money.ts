import { StoreError } from './errors';

export function eurosToCents(value: unknown): number {
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) throw new StoreError('Indica un precio');
    return eurosToCents(Number(normalized));
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new StoreError('El precio no es válido');
  }

  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) > 0.001) {
    throw new StoreError('El precio admite como máximo dos decimales');
  }

  return cents;
}

export function centsToEuros(cents: number): number {
  return Math.round(cents) / 100;
}

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
}
