import type { APIRoute } from 'astro';
import { handleStoreError, json, readJson, requireAdmin } from '../../../../lib/store/http';
import { presentProduct } from '../../../../lib/store/present';
import { deleteProduct, getProduct, setFeatured, updateProduct } from '../../../../lib/store/products';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const found = await getProduct(params.id || '', { includeVariants: true });
    if (!found || (!locals.user && !found.product.isActive)) {
      return json({ success: false, error: 'Producto no encontrado' }, 404);
    }
    const variants = locals.user ? found.variants : found.variants.filter((variant) => variant.isActive);
    const data = presentProduct(found.product, variants);
    if (!locals.user) {
      return json({
        success: true,
        data: {
          ...data,
          createdBy: undefined,
        },
      });
    }
    return json({ success: true, data });
  } catch (error) {
    return handleStoreError(error);
  }
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const body = await readJson(request);
    const id = params.id || '';
    if (Object.keys(body).every((key) => key === 'featured')) {
      await setFeatured(id, body.featured === true);
      const found = await getProduct(id, { includeVariants: true });
      return json({ success: true, data: found ? presentProduct(found.product, found.variants) : null });
    }
    const updated = await updateProduct(id, body);
    return json({ success: true, data: updated ? presentProduct(updated.product, updated.variants) : null });
  } catch (error) {
    return handleStoreError(error);
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    await deleteProduct(params.id || '');
    return json({ success: true });
  } catch (error) {
    return handleStoreError(error);
  }
};
