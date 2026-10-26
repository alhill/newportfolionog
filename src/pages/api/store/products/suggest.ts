import type { APIRoute } from 'astro';
import { StoreError } from '../../../../lib/store/errors';
import { handleStoreError, json, readJson, requireAdmin } from '../../../../lib/store/http';
import { suggestUniqueSku, suggestUniqueSlug } from '../../../../lib/store/products';

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export const POST: APIRoute = async ({ request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;

  try {
    const body = await readJson(request);
    const excludeProductId = asString(body.excludeProductId) || undefined;

    if (body.kind === 'slug') {
      const name = asString(body.name);
      if (!name) throw new StoreError('Escribe el nombre para poder generar el slug');
      const value = await suggestUniqueSlug(name, excludeProductId);
      return json({ success: true, data: { value } });
    }

    if (body.kind === 'sku') {
      const reserved = Array.isArray(body.reserved)
        ? body.reserved.filter((item): item is string => typeof item === 'string').slice(0, 100)
        : [];
      const excludeVariantId = asString(body.excludeVariantId);
      const except = excludeProductId
        ? { productId: excludeProductId, variantId: excludeVariantId || null }
        : undefined;
      const value = await suggestUniqueSku(reserved, except);
      return json({ success: true, data: { value } });
    }

    throw new StoreError('No se ha indicado qué generar');
  } catch (error) {
    return handleStoreError(error);
  }
};
