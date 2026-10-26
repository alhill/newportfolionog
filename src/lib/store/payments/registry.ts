import { StoreError } from '../errors';
import { getPaymentSettings, getSumUpCredentials } from './settings';
import { sumupProvider } from './sumup';
import type { PaymentProvider, PaymentProviderId } from './types';

const providers: Record<PaymentProviderId, PaymentProvider> = {
  sumup: sumupProvider,
};

export function getProvider(id: PaymentProviderId): PaymentProvider {
  const provider = providers[id];
  if (!provider) throw new StoreError(`Proveedor de pago desconocido: ${id}`);
  return provider;
}

export async function getActiveProvider(): Promise<PaymentProvider> {
  const settings = await getPaymentSettings();
  const provider = getProvider(settings.activeProviderId);
  const configured = await provider.isConfigured();
  if (!configured) {
    throw new StoreError('Forma de pago no configurada. Activa SumUp en Formas de pago.');
  }
  return provider;
}

export async function isPaymentsReady() {
  return (await getSumUpCredentials()) != null;
}

export function listRegisteredProviders() {
  return Object.values(providers).map((provider) => provider.id);
}
