import type { APIRoute } from 'astro';
import { handleStoreError, json } from '../../../../../../lib/store/http';
import { refreshOrderPaymentByToken } from '../../../../../../lib/store/payments';

export const GET: APIRoute = async ({ params }) => {
  try {
    const token = params.token;
    if (!token) return json({ success: false, error: 'Pedido no encontrado' }, 404);
    const order = await refreshOrderPaymentByToken(token);
    return json({
      success: true,
      data: {
        id: order.id,
        number: order.number,
        paymentStatus: order.paymentStatus,
        paymentUrl: order.paymentUrl,
        paidAt: order.paidAt,
        total: order.total,
      },
    });
  } catch (error) {
    return handleStoreError(error);
  }
};
