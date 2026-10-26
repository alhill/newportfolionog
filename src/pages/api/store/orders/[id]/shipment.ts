import type { APIRoute } from 'astro';
import { handleStoreError, json, readJson, requireAdmin } from '../../../../../lib/store/http';
import { createOrderShipment, quoteOrderShipment, refreshPacklinkShipment } from '../../../../../lib/store/packlink/shipments';

export const GET: APIRoute = async ({ params, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const order = await refreshPacklinkShipment(params.id || '');
    return json({ success: true, data: order });
  } catch (error) {
    return handleStoreError(error);
  }
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const unauthorized = requireAdmin(locals);
  if (unauthorized) return unauthorized;
  try {
    const body = await readJson(request);
    const data = body.action === 'quote'
      ? await quoteOrderShipment(params.id || '', body)
      : await createOrderShipment(params.id || '', body);
    return json({ success: true, data });
  } catch (error) {
    return handleStoreError(error);
  }
};
