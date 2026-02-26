import type { APIRoute } from 'astro';
import { db } from '../../lib/firebase-admin';
import type { MediaCreateInput, MediaListResponse } from '../../types/api';

// GET - Listar medios con paginación
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '24');
  const type = url.searchParams.get('type'); // Filtrar por tipo

  try {
    let query = db.collection('media').orderBy('createdAt', 'desc');

    // Filtrar por tipo si se proporciona
    if (type && ['image', 'video', 'pdf', 'audio'].includes(type)) {
      query = query.where('type', '==', type);
    }

    // Contar total
    const countSnapshot = await query.count().get();
    const total = countSnapshot.data().count;
    const totalPages = Math.ceil(total / limit);

    // Obtener página específica
    const offset = (page - 1) * limit;
    const snapshot = await query.limit(limit).offset(offset).get();

    const media = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        uri: data.uri,
        alt: data.alt,
        type: data.type,
        relatedCount: data.related?.length || 0,
      };
    });

    const response: MediaListResponse = {
      success: true,
      data: media,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error al obtener medios' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// POST - Crear nuevo medio
export const POST: APIRoute = async ({ request, locals }) => {
  // Verificar autenticación
  if (!locals.user) {
    return new Response(
      JSON.stringify({ success: false, error: 'No autorizado' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const data: MediaCreateInput = await request.json();

    // Validar datos requeridos
    if (!data.uri || !data.type) {
      return new Response(
        JSON.stringify({ success: false, error: 'Faltan datos requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que el tipo sea válido
    if (!['image', 'video', 'pdf', 'audio'].includes(data.type)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tipo de medio inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Crear documento de medio
    const mediaData = {
      uri: data.uri,
      alt: data.alt || undefined,
      type: data.type,
      related: [],
      createdAt: new Date().toISOString(),
      createdBy: locals.user.uid,
    };

    const docRef = await db.collection('media').add(mediaData);

    return new Response(
      JSON.stringify({
        success: true,
        id: docRef.id,
        data: { id: docRef.id, ...mediaData },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating media:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error al crear medio' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
