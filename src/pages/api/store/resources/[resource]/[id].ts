import type { APIRoute } from 'astro';
import { handleStoreError, json, readJson, requireAdmin } from '../../../../../lib/store/http';
import { assertResourceKey, deleteResource, updateResource } from '../../../../../lib/store/resources';

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const key = assertResourceKey(params.resource || '');
    const data = await updateResource(key, params.id || '', await readJson(request));
    return json({ success: true, data });
  } catch (error) {
    return handleStoreError(error);
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const key = assertResourceKey(params.resource || '');
    await deleteResource(key, params.id || '');
    return json({ success: true });
  } catch (error) {
    return handleStoreError(error);
  }
};
