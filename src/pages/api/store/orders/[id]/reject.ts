import type { APIRoute } from 'astro';
import { StoreError } from '../../../../../lib/store/errors';
import { handleStoreError, json, requireAdmin } from '../../../../../lib/store/http';
import { getOrder, updateOrder } from '../../../../../lib/store/orders';
import { shipmentBlocksRefund } from '../../../../../lib/store/packlink/model';
import { refundSumUpCheckout } from '../../../../../lib/store/payments';

export const POST: APIRoute = async ({ params, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const order = await getOrder(params.id || '');
    if (!order) return json({ success: false, error: 'Pedido no encontrado' }, 404);
    if (shipmentBlocksRefund(order.packlink)) {
      throw new StoreError('Este pedido ya tiene etiqueta en Packlink. Cancélalo allí antes de reembolsar.');
    }
    if (order.paymentStatus === 'paid') {
      await refundSumUpCheckout(order.paymentCheckoutId || '');
      const data = await updateOrder(order.id, {
        paymentStatus: 'refunded',
        fulfillmentStatus: 'cancelled',
        returnStatus: 'refunded',
      });
      return json({ success: true, data });
    }
    const data = await updateOrder(order.id, {
      paymentStatus: 'cancelled',
      fulfillmentStatus: 'cancelled',
    });
    return json({ success: true, data });
  } catch (error) {
    return handleStoreError(error);
  }
};
