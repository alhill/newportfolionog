import type { APIRoute } from 'astro';
import { handleStoreError, json, readJson, requireAdmin } from '../../../lib/store/http';
import { listInventory, updateInventoryStock } from '../../../lib/store/inventory';

export const GET: APIRoute = async ({ url, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const source = url.searchParams.get('source');
    const active = url.searchParams.get('active');
    const data = await listInventory({
      limit: Number(url.searchParams.get('limit') || 40),
      source: source === 'product' || source === 'variant' ? source : 'all',
      isActive: active === 'true' ? true : active === 'false' ? false : undefined,
      lowStock: url.searchParams.get('lowStock') === 'true',
      productCursor: url.searchParams.get('productCursor'),
      variantCursor: url.searchParams.get('variantCursor'),
    });
    return json({ success: true, ...data });
  } catch (error) {
    return handleStoreError(error);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    await updateInventoryStock(await readJson(request));
    return json({ success: true });
  } catch (error) {
    return handleStoreError(error);
  }
};
