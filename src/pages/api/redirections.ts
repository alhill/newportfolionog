import type { APIRoute } from 'astro';
import { adminDb } from '../../lib/firebase-admin';

/**
 * GET /api/redirections
 * Lista todas las redirecciones
 */
export const GET: APIRoute = async () => {
  try {
    const snapshot = await adminDb.collection('redirections').orderBy('updatedAt', 'desc').get();

    const redirections = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        from: data.from || '',
        to: data.to || '',
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        createdBy: data.createdBy || '',
      };
    });

    return new Response(JSON.stringify({ success: true, data: redirections }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching redirections:', error);
    return new Response(JSON.stringify({ success: false, error: 'Error fetching redirections' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * POST /api/redirections
 * Crea una redirección
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    if (!locals.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await request.json();
    const name = String(data?.name || '').trim();
    const from = String(data?.from || '').trim();
    const to = String(data?.to || '').trim();

    if (!name || !from || !to) {
      return new Response(
        JSON.stringify({ success: false, error: 'Los campos name, from y to son obligatorios' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const now = new Date().toISOString();
    const redirectionData: {
      name: string;
      from: string;
      to: string;
      createdAt: string;
      updatedAt: string;
      createdBy: string;
    } = {
      name,
      from,
      to,
      createdAt: now,
      updatedAt: now,
      createdBy: locals.user.uid,
    };

    const docRef = await adminDb.collection('redirections').add(redirectionData);

    return new Response(
      JSON.stringify({
        success: true,
        id: docRef.id,
        data: { id: docRef.id, ...redirectionData },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating redirection:', error);
    return new Response(JSON.stringify({ success: false, error: 'Error creating redirection' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
