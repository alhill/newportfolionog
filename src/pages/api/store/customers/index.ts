import type { APIRoute } from 'astro';
import { handleStoreError, json, requireAdmin } from '../../../../lib/store/http';
import { listCustomers } from '../../../../lib/store/customers';

export const GET: APIRoute = async ({ locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    return json({ success: true, data: await listCustomers() });
  } catch (error) {
    return handleStoreError(error);
  }
};
