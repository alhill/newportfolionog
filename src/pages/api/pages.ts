import type { APIRoute } from 'astro';
import { adminDb } from '../../lib/firebase-admin';

/**
 * Páginas predefinidas del sitio. El id es el slug que se usa como documento en Firebase
 * y coincide con la URL donde se renderiza la página.
 */
export const PREDEFINED_PAGES = [
  {
    id: 'index',
    title: 'Inicio',
    url: '/',
    description: 'Metadatos y contenido SEO de la portada',
  },
  {
    id: 'sobre-mi',
    title: 'Sobre mí',
    url: '/sobre-mi',
    description: 'Página de presentación personal',
  },
  {
    id: 'contacto',
    title: 'Contacto',
    url: '/contacto',
    description: 'Página de contacto',
  },
  {
    id: 'global-seo',
    title: 'SEO global',
    url: '',
    description: 'Valores por defecto de SEO para todo el sitio',
  },
] as const;

export const GLOBAL_SEO_PAGE_ID = 'global-seo' as const;

export function isGlobalSeoPage(id: string): id is typeof GLOBAL_SEO_PAGE_ID {
  return id === GLOBAL_SEO_PAGE_ID;
}

/**
 * GET /api/pages
 * Devuelve la lista de páginas predefinidas junto con sus datos de Firebase (si existen).
 */
export const GET: APIRoute = async () => {
  try {
    const results = await Promise.all(
      PREDEFINED_PAGES.map(async (page) => {
        const doc = await adminDb.collection('pages').doc(page.id).get();
        const data = doc.exists ? doc.data() : {};
        return {
          ...page,
          title: data?.title ?? page.title,
          published: page.id === 'global-seo' ? true : (data?.published ?? false),
          updatedAt: data?.updatedAt ?? null,
        };
      })
    );

    return new Response(JSON.stringify({ success: true, data: results }), {
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
