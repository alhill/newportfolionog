import type { APIRoute } from 'astro';
import { centsToEuros } from '../../../../lib/store/money';
import { handleStoreError, json, readJson, requireAdmin } from '../../../../lib/store/http';
import { presentProduct } from '../../../../lib/store/present';
import { createProduct, listProducts } from '../../../../lib/store/products';

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const admin = Boolean(locals.user);
    const data = await listProducts({
      admin,
      limit: Number(url.searchParams.get('limit') || 60),
      categoryId: url.searchParams.get('categoryId'),
      search: url.searchParams.get('q') || '',
    });
    return json({
      success: true,
      data: data.map((item) => ({ ...item, priceEuros: centsToEuros(item.price) })),
    });
  } catch (error) {
    return handleStoreError(error);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const body = await readJson(request);
    const created = await createProduct(body, locals.user?.uid || '');
    return json({ success: true, data: created ? presentProduct(created.product, created.variants) : null }, 201);
  } catch (error) {
    return handleStoreError(error);
  }
};
