import type { APIRoute } from 'astro';
import { handleStoreError, json, readJson, requireAdmin } from '../../../../lib/store/http';
import {
  getPacklinkSettings,
  presentPacklinkSettings,
  updatePacklinkSettings,
} from '../../../../lib/store/packlink/settings';

export const GET: APIRoute = async ({ locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    return json({ success: true, data: presentPacklinkSettings(await getPacklinkSettings()) });
  } catch (error) {
    return handleStoreError(error);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    return json({ success: true, data: await updatePacklinkSettings(await readJson(request)) });
  } catch (error) {
    return handleStoreError(error);
  }
};
