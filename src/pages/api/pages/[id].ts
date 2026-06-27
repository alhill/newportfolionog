import type { APIRoute } from 'astro';
import { adminDb } from '../../../lib/firebase-admin';
import type { GlobalSeoUpdateInput, PageUpdateInput } from '../../../types/api';
import { GLOBAL_SEO_PAGE_ID, isGlobalSeoPage, PREDEFINED_PAGES } from '../pages';

const PAGE_UPDATE_FIELDS = [
  'title',
  'subtitle',
  'content',
  'ctaText',
  'ctaUrl',
  'published',
  'seo',
] as const satisfies ReadonlyArray<keyof PageUpdateInput>;

const GLOBAL_SEO_UPDATE_FIELDS = ['seo'] as const satisfies ReadonlyArray<keyof GlobalSeoUpdateInput>;

function pickAllowedFields<T extends object>(
  body: Record<string, unknown>,
  allowedFields: readonly (keyof T)[]
): Partial<T> {
  const result = {} as Partial<T>;

  for (const field of allowedFields) {
    if (body[field as string] !== undefined) {
      result[field] = body[field as string] as T[typeof field];
    }
  }

  return result;
}

/**
 * GET /api/pages/[id]
 * Devuelve los datos completos de una página predefinida.
 */
export const GET: APIRoute = async ({ params }) => {
  const { id } = params;

  const predefined = PREDEFINED_PAGES.find((p) => p.id === id);
  if (!predefined) {
    return new Response(JSON.stringify({ success: false, error: 'Página no encontrada' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const doc = await adminDb.collection('pages').doc(id!).get();
    const data = doc.exists ? doc.data() : {};

    if (isGlobalSeoPage(id!)) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: GLOBAL_SEO_PAGE_ID,
            title: predefined.title,
            description: predefined.description,
            seo: data?.seo || {},
            updatedAt: data?.updatedAt ?? null,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: { ...predefined, ...data } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * PUT /api/pages/[id]
 * Actualiza (o crea) el documento de una página predefinida en Firebase.
 */
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;

  if (!locals.user) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const predefined = PREDEFINED_PAGES.find((p) => p.id === id);
  if (!predefined) {
    return new Response(JSON.stringify({ success: false, error: 'Página no encontrada' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const safeBody = isGlobalSeoPage(id!)
      ? pickAllowedFields<GlobalSeoUpdateInput>(body, GLOBAL_SEO_UPDATE_FIELDS)
      : pickAllowedFields<PageUpdateInput>(body, PAGE_UPDATE_FIELDS);

    await adminDb
      .collection('pages')
      .doc(id!)
      .set({ ...safeBody, updatedAt: new Date().toISOString() }, { merge: true });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
