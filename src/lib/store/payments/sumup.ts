import { StoreError } from '../errors';
import { centsToEuros } from '../money';
import { getSumUpCredentials } from './settings';
import type {
  CreatePaymentSessionInput,
  PaymentProvider,
  PaymentSession,
  RemotePaymentStatus,
} from './types';

const SUMUP_API = 'https://api.sumup.com/v0.1';

interface SumUpCheckoutResponse {
  id?: string;
  status?: string;
  hosted_checkout_url?: string;
  checkout_reference?: string;
  message?: string;
  error_code?: string;
}

async function sumupFetch(path: string, apiKey: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUMUP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
  });
}

function mapStatus(status: string | undefined): RemotePaymentStatus {
  switch ((status || '').toUpperCase()) {
    case 'PAID':
      return 'paid';
    case 'FAILED':
      return 'failed';
    case 'EXPIRED':
      return 'expired';
    default:
      return 'pending';
  }
}

function checkoutReference(orderId: string, forceNew: boolean) {
  if (!forceNew) return orderId.slice(0, 64);
  const suffix = Date.now().toString(36);
  return `${orderId.slice(0, 64 - suffix.length - 1)}-${suffix}`;
}

export const sumupProvider: PaymentProvider = {
  id: 'sumup',

  async isConfigured() {
    return (await getSumUpCredentials()) != null;
  },

  async testConnection() {
    return testSumUpConnection();
  },

  async createPaymentSession(input: CreatePaymentSessionInput): Promise<PaymentSession> {
    const credentials = await getSumUpCredentials();
    if (!credentials) throw new StoreError('Forma de pago no configurada. Activa SumUp en Formas de pago.');

    const origin = input.origin.replace(/\/$/, '');
    if (!/^https?:\/\//i.test(origin)) {
      throw new StoreError('No se pudo determinar la URL pública de la tienda', 500);
    }

    if (!input.forceNew && input.order.paymentCheckoutId && input.order.paymentUrl) {
      try {
        const remote = await this.getRemoteStatus(input.order.paymentCheckoutId);
        if (remote === 'pending') {
          return {
            providerId: 'sumup',
            checkoutId: input.order.paymentCheckoutId,
            paymentUrl: input.order.paymentUrl,
          };
        }
      } catch {
        // Checkout expired or unreachable — create a new session below.
      }
    }

    const reference = checkoutReference(
      input.order.id,
      Boolean(input.forceNew) || Boolean(input.order.paymentCheckoutId),
    );
    const response = await sumupFetch('/checkouts', credentials.apiKey, {
      method: 'POST',
      body: JSON.stringify({
        checkout_reference: reference,
        amount: centsToEuros(input.order.total),
        currency: 'EUR',
        merchant_code: credentials.merchantCode,
        description: `Pedido ${input.order.number}`,
        redirect_url: `${origin}/tienda/pedido/${input.order.publicToken}`,
        return_url: `${origin}/api/store/payments/webhook/sumup`,
        hosted_checkout: { enabled: true },
      }),
    });

    const body = await response.json().catch(() => ({})) as SumUpCheckoutResponse;
    if (!response.ok || !body.id || !body.hosted_checkout_url) {
      const message = body.message || body.error_code || `SumUp no creó el checkout (${response.status})`;
      throw new StoreError(message, response.status >= 400 && response.status < 500 ? 400 : 502);
    }

    return {
      providerId: 'sumup',
      checkoutId: body.id,
      paymentUrl: body.hosted_checkout_url,
    };
  },

  async getRemoteStatus(checkoutId: string): Promise<RemotePaymentStatus> {
    const credentials = await getSumUpCredentials();
    if (!credentials) throw new StoreError('Forma de pago no configurada');
    if (!checkoutId) throw new StoreError('Falta el identificador del checkout');

    const response = await sumupFetch(`/checkouts/${encodeURIComponent(checkoutId)}`, credentials.apiKey);
    const body = await response.json().catch(() => ({})) as SumUpCheckoutResponse;
    if (!response.ok) {
      throw new StoreError(body.message || `No se pudo consultar el checkout (${response.status})`, 502);
    }
    return mapStatus(body.status);
  },
};

/** Test connection even when SumUp is not yet enabled (uses stored key). */
export async function testSumUpConnection() {
  const { getPaymentSettings } = await import('./settings');
  const settings = await getPaymentSettings();
  const apiKey = settings.providers.sumup.apiKey;
  if (!apiKey) {
    return { ok: false as const, message: 'Guarda una API key antes de probar la conexión' };
  }
  try {
    const response = await sumupFetch('/me', apiKey);
    const body = await response.json().catch(() => ({})) as { merchant_code?: string; message?: string };
    if (!response.ok) {
      return { ok: false as const, message: body.message || `SumUp respondió ${response.status}` };
    }
    return {
      ok: true as const,
      merchantCode: body.merchant_code || settings.providers.sumup.merchantCode,
      message: 'Conexión correcta con SumUp',
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : 'No se pudo contactar con SumUp',
    };
  }
}

export async function refundSumUpCheckout(checkoutId: string) {
  const { getPaymentSettings } = await import('./settings');
  const settings = await getPaymentSettings();
  const credentials = settings.providers.sumup;
  if (!credentials.apiKey || !credentials.merchantCode) {
    throw new StoreError('Faltan las credenciales de SumUp para devolver el cobro');
  }
  if (!checkoutId) throw new StoreError('Este pedido no tiene un cobro de SumUp');

  const response = await sumupFetch(`/checkouts/${encodeURIComponent(checkoutId)}`, credentials.apiKey);
  const checkout = await response.json().catch(() => ({})) as {
    status?: string;
    transaction_id?: string;
    transactions?: { id?: string; transaction_id?: string }[];
    message?: string;
  };
  if (!response.ok) {
    throw new StoreError(checkout.message || `No se pudo consultar el cobro (${response.status})`, 502);
  }
  if ((checkout.status || '').toUpperCase() === 'REFUNDED') return;

  const transactionId = checkout.transaction_id
    || checkout.transactions?.find((item) => item.transaction_id || item.id)?.transaction_id
    || checkout.transactions?.find((item) => item.id)?.id
    || '';
  if (!transactionId) throw new StoreError('SumUp no ha devuelto la transacción de este cobro');

  const refund = await fetch(
    `https://api.sumup.com/v1.0/merchants/${encodeURIComponent(credentials.merchantCode)}/payments/${encodeURIComponent(transactionId)}/refunds`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        Accept: 'application/json',
      },
    },
  );
  if (refund.ok || refund.status === 409) return;
  const body = await refund.json().catch(() => ({})) as { message?: string; error_message?: string };
  const message = body.message || body.error_message || '';
  if (/already refunded|refunded/i.test(message)) return;
  throw new StoreError(message || `SumUp no ha devuelto el cobro (${refund.status})`, 502);
}
