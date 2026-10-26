import type { APIRoute } from 'astro';
import { checkRateLimit } from '../../../lib/rate-limit';
import { handleStoreError, json, readJson } from '../../../lib/store/http';
import { requestReturn } from '../../../lib/store/orders';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!checkRateLimit(`store-return:${clientAddress || 'unknown'}`, 8)) {
    return json({ success: false, error: 'Demasiados intentos. Espera unos minutos.' }, 429);
  }
  try {
    const body = await readJson(request);
    const token = typeof body.publicToken === 'string' ? body.publicToken : '';
    const message = typeof body.message === 'string' ? body.message : '';
    const order = await requestReturn(token, message);
    return json({ success: true, data: { returnStatus: order?.returnStatus || 'requested' } });
  } catch (error) {
    return handleStoreError(error);
  }
};
