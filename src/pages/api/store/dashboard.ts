import type { APIRoute } from 'astro';
import { handleStoreError, json, requireAdmin } from '../../../lib/store/http';
import { getStoreDashboard } from '../../../lib/store/dashboard';

export const GET: APIRoute = async ({ locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    return json({ success: true, data: await getStoreDashboard() });
  } catch (error) {
    return handleStoreError(error);
  }
};
