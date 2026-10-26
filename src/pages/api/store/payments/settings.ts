import type { APIRoute } from 'astro';
import { handleStoreError, json, readJson, requireAdmin } from '../../../../lib/store/http';
import {
  getPaymentSettings,
  presentPaymentSettings,
  updatePaymentSettings,
} from '../../../../lib/store/payments';

export const GET: APIRoute = async ({ locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    return json({ success: true, data: presentPaymentSettings(await getPaymentSettings()) });
  } catch (error) {
    return handleStoreError(error);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    return json({ success: true, data: await updatePaymentSettings(await readJson(request)) });
  } catch (error) {
    return handleStoreError(error);
  }
};
