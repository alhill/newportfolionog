import type { APIRoute } from 'astro';
import { StoreError } from '../../../../lib/store/errors';
import { handleStoreError, json, readJson, requireAdmin } from '../../../../lib/store/http';
import { getOrder, updateOrder } from '../../../../lib/store/orders';
import { shipmentBlocksRefund } from '../../../../lib/store/packlink/model';
import { refundSumUpCheckout } from '../../../../lib/store/payments';

export const GET: APIRoute = async ({ params, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const order = await getOrder(params.id || '');
    if (!order) return json({ success: false, error: 'Pedido no encontrado' }, 404);
    return json({ success: true, data: order });
  } catch (error) {
    return handleStoreError(error);
  }
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const body = await readJson(request);
    const current = await getOrder(params.id || '');
    if (!current) return json({ success: false, error: 'Pedido no encontrado' }, 404);
    const wantsRefund = body.paymentStatus === 'refunded' || body.returnStatus === 'refunded';
    if (wantsRefund && current.paymentStatus === 'paid') {
      if (shipmentBlocksRefund(current.packlink)) {
        throw new StoreError('Este pedido ya tiene etiqueta en Packlink. Cancélalo allí antes de reembolsar.');
      }
      await refundSumUpCheckout(current.paymentCheckoutId || '');
    }
    const data = await updateOrder(current.id, body);
    return json({ success: true, data });
  } catch (error) {
    return handleStoreError(error);
  }
};
