import type { APIRoute } from 'astro';
import { getRequestOrigin } from '../../../../../lib/request-origin';
import { handleStoreError, json, requireAdmin } from '../../../../../lib/store/http';
import { ensureOrderPaymentLink } from '../../../../../lib/store/payments';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const id = params.id;
    if (!id) return json({ success: false, error: 'Pedido no encontrado' }, 404);

    let forceNew = false;
    const raw = await request.text();
    if (raw.trim()) {
      try {
        const body = JSON.parse(raw);
        forceNew = body?.forceNew === true;
      } catch {
        forceNew = false;
      }
    }

    const order = await ensureOrderPaymentLink(id, getRequestOrigin(request), forceNew);
    return json({
      success: true,
      data: {
        id: order.id,
        paymentUrl: order.paymentUrl,
        paymentCheckoutId: order.paymentCheckoutId,
        paymentStatus: order.paymentStatus,
      },
    });
  } catch (error) {
    return handleStoreError(error);
  }
};
