import type { APIRoute } from 'astro';
import { centsToEuros } from '../../../lib/store/money';
import { handleStoreError, json, readJson, requireAdmin } from '../../../lib/store/http';
import { getStoreSettings, updateStoreSettings } from '../../../lib/store/settings';

function present(settings: Awaited<ReturnType<typeof getStoreSettings>>) {
  return { ...settings, shippingEuros: centsToEuros(settings.shippingFlatRate) };
}

export const GET: APIRoute = async ({ locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    return json({ success: true, data: present(await getStoreSettings()) });
  } catch (error) {
    return handleStoreError(error);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    return json({ success: true, data: present(await updateStoreSettings(await readJson(request))) });
  } catch (error) {
    return handleStoreError(error);
  }
};
