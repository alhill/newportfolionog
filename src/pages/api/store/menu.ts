import type { APIRoute } from 'astro';
import { handleStoreError, json, readJson, requireAdmin } from '../../../lib/store/http';
import { getMenuForAdmin, saveStoreMenu } from '../../../lib/store/menu-data';

export const GET: APIRoute = async ({ locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    return json({ success: true, data: await getMenuForAdmin() });
  } catch (error) {
    return handleStoreError(error);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    return json({ success: true, data: await saveStoreMenu(await readJson(request)) });
  } catch (error) {
    return handleStoreError(error);
  }
};
