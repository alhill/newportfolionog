import type { APIRoute } from 'astro';
import { handleStoreError, json, readJson, requireAdmin } from '../../../../lib/store/http';
import { getCustomer, updateCustomer } from '../../../../lib/store/customers';

export const GET: APIRoute = async ({ params, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const data = await getCustomer(params.id || '');
    if (!data) return json({ success: false, error: 'Cliente no encontrado' }, 404);
    return json({ success: true, data });
  } catch (error) {
    return handleStoreError(error);
  }
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const data = await updateCustomer(params.id || '', await readJson(request));
    return json({ success: true, data });
  } catch (error) {
    return handleStoreError(error);
  }
};
