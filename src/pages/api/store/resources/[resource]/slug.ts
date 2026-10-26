import type { APIRoute } from 'astro';
import { StoreError } from '../../../../../lib/store/errors';
import { handleStoreError, json, readJson, requireAdmin } from '../../../../../lib/store/http';
import { assertResourceKey, assertResourceSlug, suggestResourceSlug } from '../../../../../lib/store/resources';

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;

  try {
    const key = assertResourceKey(params.resource || '');
    const body = await readJson(request);
    const excludeId = asString(body.excludeId) || undefined;

    if (body.kind === 'generate') {
      const name = asString(body.name);
      if (!name) throw new StoreError('Escribe el nombre para poder generar el slug');
      const value = await suggestResourceSlug(key, name, excludeId);
      return json({ success: true, data: { value } });
    }

    const slug = asString(body.slug);
    let message: string | null = null;
    try {
      if (slug) await assertResourceSlug(key, slug, excludeId);
    } catch (error) {
      if (!(error instanceof StoreError)) throw error;
      message = error.message;
    }
    return json({ success: true, data: { message } });
  } catch (error) {
    return handleStoreError(error);
  }
};
