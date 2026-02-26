import type { APIRoute } from 'astro';
import { db } from '../../../lib/firebase-admin';
import type { MediaUpdateInput, MediaResponse } from '../../../types/api';

// GET - Obtener un medio específico
export const GET: APIRoute = async ({ params }) => {
  const { id } = params;

  if (!id) {
    return new Response(
      JSON.stringify({ success: false, error: 'ID no proporcionado' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const doc = await db.collection('media').doc(id).get();

    if (!doc.exists) {
      return new Response(
        JSON.stringify({ success: false, error: 'Medio no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response: MediaResponse = {
      success: true,
      data: { id: doc.id, ...doc.data() } as any,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error al obtener medio' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// PUT - Actualizar un medio
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;

  // Verificar autenticación
  if (!locals.user) {
    return new Response(
      JSON.stringify({ success: false, error: 'No autorizado' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!id) {
    return new Response(
      JSON.stringify({ success: false, error: 'ID no proporcionado' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const data: MediaUpdateInput = await request.json();

    // Verificar que el medio existe
    const docRef = db.collection('media').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return new Response(
        JSON.stringify({ success: false, error: 'Medio no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Actualizar solo los campos proporcionados
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (data.alt !== undefined) {
      updateData.alt = data.alt;
    }

    if (data.related !== undefined) {
      updateData.related = data.related;
    }

    await docRef.update(updateData);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating media:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error al actualizar medio' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// DELETE - Eliminar un medio
export const DELETE: APIRoute = async ({ params, locals }) => {
  const { id } = params;

  // Verificar autenticación
  if (!locals.user) {
    return new Response(
      JSON.stringify({ success: false, error: 'No autorizado' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!id) {
    return new Response(
      JSON.stringify({ success: false, error: 'ID no proporcionado' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const docRef = db.collection('media').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return new Response(
        JSON.stringify({ success: false, error: 'Medio no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const mediaData = doc.data();

    // Advertir si el medio está siendo usado
    if (mediaData?.related && mediaData.related.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Este medio está siendo usado en ${mediaData.related.length} proyecto(s)`,
          relatedProjects: mediaData.related,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // TODO: Eliminar también el archivo de Firebase Storage
    // await deleteFile(mediaData.uri);

    await docRef.delete();

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error deleting media:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error al eliminar medio' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
