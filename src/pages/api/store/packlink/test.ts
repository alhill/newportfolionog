import type { APIRoute } from 'astro';
import { handleStoreError, json, requireAdmin } from '../../../../lib/store/http';
import { testPacklinkConnection } from '../../../../lib/store/packlink/settings';

export const POST: APIRoute = async ({ locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const result = await testPacklinkConnection();
    if (!result.ok) return json({ success: false, error: result.message }, 400);
    return json({ success: true, data: result });
  } catch (error) {
    return handleStoreError(error);
  }
};
