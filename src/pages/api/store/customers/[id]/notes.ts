import type { APIRoute } from 'astro';
import { handleStoreError, json, readJson, requireAdmin } from '../../../../../lib/store/http';
import { addCustomerNote } from '../../../../../lib/store/customers';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const body = await readJson(request);
    const data = await addCustomerNote(params.id || '', String(body.message || ''), locals.user?.uid || '');
    return json({ success: true, data });
  } catch (error) {
    return handleStoreError(error);
  }
};
