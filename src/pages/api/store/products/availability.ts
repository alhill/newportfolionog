import type { APIRoute } from 'astro';
import { StoreError } from '../../../../lib/store/errors';
import { handleStoreError, json, readJson, requireAdmin } from '../../../../lib/store/http';
import { assertSkuAvailable, assertSlugAvailable } from '../../../../lib/store/products';

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function quiet(task: Promise<unknown>) {
  try {
    await task;
    return null;
  } catch (error) {
    if (error instanceof StoreError) return error.message;
    throw error;
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;

  try {
    const body = await readJson(request);
    const slug = asString(body.slug);
    const excludeProductId = asString(body.excludeProductId);
    const rawSkus = Array.isArray(body.skus) ? body.skus.slice(0, 100) : [];

    const slugMessage = slug
      ? await quiet(assertSlugAvailable(slug, excludeProductId || undefined))
      : null;

    const skus = [];
    for (const item of rawSkus) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        skus.push({ message: null });
        continue;
      }
      const sku = asString((item as { sku?: unknown }).sku);
      const variantId = asString((item as { variantId?: unknown }).variantId);
      if (!sku) {
        skus.push({ message: null });
        continue;
      }
      const except = excludeProductId
        ? { productId: excludeProductId, variantId: variantId || null }
        : undefined;
      skus.push({ message: await quiet(assertSkuAvailable(sku, except)) });
    }

    return json({ success: true, data: { slug: slugMessage, skus } });
  } catch (error) {
    return handleStoreError(error);
  }
};
