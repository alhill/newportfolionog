import type { APIRoute } from 'astro';
import { adminDb } from '../../../lib/firebase-admin';

/**
 * GET /api/redirections/[id]
 * Obtiene una redirección por id
 */
export const GET: APIRoute = async ({ params }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ success: false, error: 'ID requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const doc = await adminDb.collection('redirections').doc(id).get();

    if (!doc.exists) {
      return new Response(JSON.stringify({ success: false, error: 'Redirección no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: doc.id,
          ...doc.data(),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching redirection:', error);
    return new Response(JSON.stringify({ success: false, error: 'Error fetching redirection' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * PUT /api/redirections/[id]
 * Actualiza una redirección
 */
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;

  if (!locals.user) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!id) {
    return new Response(JSON.stringify({ success: false, error: 'ID requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const docRef = adminDb.collection('redirections').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return new Response(JSON.stringify({ success: false, error: 'Redirección no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const updateData: Record<string, string> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return new Response(JSON.stringify({ success: false, error: 'El campo name no puede estar vacío' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updateData.name = name;
    }

    if (body.from !== undefined) {
      const from = String(body.from).trim();
      if (!from) {
        return new Response(JSON.stringify({ success: false, error: 'El campo from no puede estar vacío' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updateData.from = from;
    }

    if (body.to !== undefined) {
      const to = String(body.to).trim();
      if (!to) {
        return new Response(JSON.stringify({ success: false, error: 'El campo to no puede estar vacío' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updateData.to = to;
    }

    if (!Object.keys(updateData).length) {
      return new Response(JSON.stringify({ success: false, error: 'No hay campos para actualizar' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await docRef.update({
      ...updateData,
      updatedAt: new Date().toISOString(),
    });

    const updatedDoc = await docRef.get();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: updatedDoc.id,
          ...updatedDoc.data(),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error updating redirection:', error);
    return new Response(JSON.stringify({ success: false, error: 'Error updating redirection' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * DELETE /api/redirections/[id]
 * Elimina una redirección
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const { id } = params;

  if (!locals.user) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!id) {
    return new Response(JSON.stringify({ success: false, error: 'ID requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const docRef = adminDb.collection('redirections').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return new Response(JSON.stringify({ success: false, error: 'Redirección no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await docRef.delete();

    return new Response(JSON.stringify({ success: true, message: 'Redirección eliminada' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error deleting redirection:', error);
    return new Response(JSON.stringify({ success: false, error: 'Error deleting redirection' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
