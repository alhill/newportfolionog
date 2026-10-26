import type { APIRoute } from 'astro';
import { handleStoreError, json, requireAdmin } from '../../../../lib/store/http';
import { listOrders } from '../../../../lib/store/orders';

export const GET: APIRoute = async ({ locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    return json({ success: true, data: await listOrders() });
  } catch (error) {
    return handleStoreError(error);
  }
};
