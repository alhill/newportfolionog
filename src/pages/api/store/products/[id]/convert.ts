import type { APIRoute } from 'astro';
import { handleStoreError, json, readJson, requireAdmin } from '../../../../../lib/store/http';
import { presentProduct } from '../../../../../lib/store/present';
import { convertProductToVariants } from '../../../../../lib/store/products';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const body = await readJson(request);
    const converted = await convertProductToVariants(params.id || '', body);
    return json({ success: true, data: converted ? presentProduct(converted.product, converted.variants) : null });
  } catch (error) {
    return handleStoreError(error);
  }
};
