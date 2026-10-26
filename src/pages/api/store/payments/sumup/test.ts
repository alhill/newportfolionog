import type { APIRoute } from 'astro';
import { handleStoreError, json, requireAdmin } from '../../../../../lib/store/http';
import { testSumUpConnection } from '../../../../../lib/store/payments';

export const POST: APIRoute = async ({ locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const result = await testSumUpConnection();
    return json({ success: result.ok, data: result, error: result.ok ? undefined : result.message });
  } catch (error) {
    return handleStoreError(error);
  }
};
