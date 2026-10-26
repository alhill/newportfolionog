import type { APIRoute } from 'astro';
import { handleStoreError, json, readJson, requireAdmin } from '../../../../lib/store/http';
import { assertResourceKey, createResource, listResources } from '../../../../lib/store/resources';

export const GET: APIRoute = async ({ params, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const key = assertResourceKey(params.resource || '');
    return json({ success: true, data: await listResources(key) });
  } catch (error) {
    return handleStoreError(error);
  }
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const key = assertResourceKey(params.resource || '');
    return json({ success: true, data: await createResource(key, await readJson(request)) }, 201);
  } catch (error) {
    return handleStoreError(error);
  }
};
