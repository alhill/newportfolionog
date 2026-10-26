import type { APIRoute } from 'astro';
import { handleStoreError, json, readJson } from '../../../../../lib/store/http';
import { applySumUpCheckout } from '../../../../../lib/store/payments';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await readJson(request);
    const checkoutId = typeof body.id === 'string'
      ? body.id
      : typeof body.checkout_id === 'string'
        ? body.checkout_id
        : '';
    if (!checkoutId) {
      return json({ success: false, error: 'Falta id de checkout' }, 400);
    }
    const result = await applySumUpCheckout(checkoutId);
    return json({ success: true, data: { applied: result.applied, remote: result.remote, orderId: result.order?.id || null } });
  } catch (error) {
    return handleStoreError(error);
  }
};
