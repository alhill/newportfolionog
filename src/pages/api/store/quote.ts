import type { APIRoute } from 'astro';
import { checkRateLimit } from '../../../lib/rate-limit';
import { handleStoreError, json, readJson } from '../../../lib/store/http';
import { quoteCheckout } from '../../../lib/store/orders';
import type { CheckoutInput } from '../../../types/store';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!checkRateLimit(`store-quote:${clientAddress || 'unknown'}`, 30)) {
    return json({ success: false, error: 'Demasiados intentos. Espera unos minutos.' }, 429);
  }
  try {
    const body = await readJson(request);
    const data = await quoteCheckout(body as unknown as CheckoutInput);
    return json({ success: true, data });
  } catch (error) {
    return handleStoreError(error);
  }
};
