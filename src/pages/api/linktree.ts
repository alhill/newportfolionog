import type { APIRoute } from 'astro';
import { getKvValue, isKvConfigured, putKvValue } from '../../lib/cloudflare-kv';
import {
  EMPTY_LINKTREE_DATA,
  formatLinktreeValue,
  LINKTREE_KEYS,
  type LinktreeData,
  validateLinktreeData,
} from '../../lib/linktree-keys';

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requireAuth(locals: App.Locals) {
  if (!locals.user) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  return null;
}

function requireKv() {
  if (!isKvConfigured()) {
    return jsonResponse(
      {
        success: false,
        error:
          'Cloudflare KV no está configurado. Define CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN y CLOUDFLARE_KV_NAMESPACE_ID.',
      },
      503,
    );
  }

  return null;
}

async function loadLinktreeData(): Promise<LinktreeData> {
  const entries = await Promise.all(
    LINKTREE_KEYS.map(async (key) => {
      const value = await getKvValue(key);
      return [key, formatLinktreeValue(key, value ?? '')] as const;
    }),
  );

  return {
    ...EMPTY_LINKTREE_DATA,
    ...Object.fromEntries(entries),
  };
}

/**
 * GET /api/linktree
 * Carga todos los valores del linktree desde KV.
 */
export const GET: APIRoute = async ({ locals }) => {
  const authError = requireAuth(locals);
  if (authError) return authError;

  const kvError = requireKv();
  if (kvError) return kvError;

  try {
    const data = await loadLinktreeData();
    return jsonResponse({ success: true, data });
  } catch (error) {
    console.error('Error loading linktree from KV:', error);
    const message = error instanceof Error ? error.message : 'Error loading linktree';
    return jsonResponse({ success: false, error: message }, 500);
  }
};

/**
 * PUT /api/linktree
 * Guarda todos los valores del linktree en KV.
 */
export const PUT: APIRoute = async ({ request, locals }) => {
  const authError = requireAuth(locals);
  if (authError) return authError;

  const kvError = requireKv();
  if (kvError) return kvError;

  try {
    const body = await request.json();
    const payload = {} as LinktreeData;

    for (const key of LINKTREE_KEYS) {
      payload[key] = typeof body[key] === 'string' ? body[key] : String(body[key] ?? '');
    }

    const validationError = validateLinktreeData(payload);
    if (validationError) {
      return jsonResponse({ success: false, error: validationError }, 400);
    }

    await Promise.all(
      LINKTREE_KEYS.map((key) => putKvValue(key, payload[key])),
    );

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Error saving linktree to KV:', error);
    const message = error instanceof Error ? error.message : 'Error saving linktree';
    return jsonResponse({ success: false, error: message }, 500);
  }
};
