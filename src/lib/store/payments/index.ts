import { adminDb } from '../../firebase-admin';
import type { Order } from '../../../types/store';
import { StoreError } from '../errors';
import { mapOrder } from '../orders';
import { getActiveProvider } from './registry';
import { notifyOrderPaid } from '../notify';

const orders = () => adminDb.collection('orders');

function nowIso() {
  return new Date().toISOString();
}

export { getPaymentSettings, presentPaymentSettings, updatePaymentSettings } from './settings';
export { getActiveProvider, isPaymentsReady, listRegisteredProviders } from './registry';
export { testSumUpConnection, sumupProvider, refundSumUpCheckout } from './sumup';
export type {
  PaymentSettings,
  PaymentSettingsPublic,
  PaymentSession,
  PaymentProviderId,
} from './types';

export async function attachPaymentSession(order: Order, origin: string, forceNew = false): Promise<Order> {
  const provider = await getActiveProvider();
  const session = await provider.createPaymentSession({ order, origin, forceNew });
  const timestamp = nowIso();
  await orders().doc(order.id).update({
    paymentProvider: session.providerId,
    paymentCheckoutId: session.checkoutId,
    paymentUrl: session.paymentUrl,
    updatedAt: timestamp,
  });
  return {
    ...order,
    paymentProvider: session.providerId,
    paymentCheckoutId: session.checkoutId,
    paymentUrl: session.paymentUrl,
    updatedAt: timestamp,
  };
}

export async function ensureOrderPaymentLink(orderId: string, origin: string, forceNew = false) {
  const snap = await orders().doc(orderId).get();
  if (!snap.exists) throw new StoreError('Pedido no encontrado', 404);
  const order = mapOrder(snap.id, snap.data() || {});
  if (order.paymentStatus === 'paid') throw new StoreError('Este pedido ya está pagado');
  if (order.paymentStatus === 'cancelled' || order.paymentStatus === 'refunded') {
    throw new StoreError('Este pedido no admite un enlace de pago');
  }
  return attachPaymentSession(order, origin, forceNew);
}

export async function applySumUpCheckout(checkoutId: string) {
  if (!checkoutId) throw new StoreError('Falta el identificador del checkout');
  const provider = await getActiveProvider();
  const remote = await provider.getRemoteStatus(checkoutId);

  const snapshot = await orders().where('paymentCheckoutId', '==', checkoutId).limit(1).get();
  if (snapshot.empty) {
    return { applied: false as const, remote, order: null as Order | null };
  }

  const doc = snapshot.docs[0];
  const order = mapOrder(doc.id, doc.data());

  if (remote === 'paid' && order.paymentStatus !== 'paid') {
    const timestamp = nowIso();
    await doc.ref.update({
      paymentStatus: 'paid',
      paidAt: timestamp,
      updatedAt: timestamp,
    });
    const paid = { ...order, paymentStatus: 'paid' as const, paidAt: timestamp, updatedAt: timestamp };
    try {
      await notifyOrderPaid(paid);
    } catch (error) {
      console.error('No se pudo avisar del pedido pagado', error);
    }
    return {
      applied: true as const,
      remote,
      order: paid,
    };
  }

  return { applied: false as const, remote, order };
}

export async function refreshOrderPaymentByToken(publicToken: string) {
  const snapshot = await orders().where('publicToken', '==', publicToken).limit(1).get();
  if (snapshot.empty) throw new StoreError('Pedido no encontrado', 404);
  const doc = snapshot.docs[0];
  const order = mapOrder(doc.id, doc.data());

  if (order.paymentStatus === 'paid' || !order.paymentCheckoutId) {
    return order;
  }

  try {
    const result = await applySumUpCheckout(order.paymentCheckoutId);
    return result.order || order;
  } catch {
    return order;
  }
}
