import type { APIRoute } from 'astro';
import { getRequestOrigin } from '../../../lib/request-origin';
import { checkRateLimit } from '../../../lib/rate-limit';
import { handleStoreError, json, readJson } from '../../../lib/store/http';
import { commitCheckout } from '../../../lib/store/orders';
import type { CheckoutInput } from '../../../types/store';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!checkRateLimit(`store-checkout:${clientAddress || 'unknown'}`, 15)) {
    return json({ success: false, error: 'Demasiados intentos. Espera unos minutos.' }, 429);
  }
  try {
    const body = await readJson(request);
    const data = await commitCheckout(body as unknown as CheckoutInput, {
      origin: getRequestOrigin(request),
    });
    return json({
      success: true,
      data: {
        id: data.id,
        number: data.number,
        publicToken: data.publicToken,
        total: data.total,
        paymentStatus: data.paymentStatus,
        paymentUrl: data.paymentUrl,
      },
    });
  } catch (error) {
    return handleStoreError(error);
  }
};
