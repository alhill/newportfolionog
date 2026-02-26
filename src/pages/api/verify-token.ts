import type { APIRoute } from 'astro';
import { adminAuth } from '../../lib/firebase-admin';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { idToken } = await request.json();

    // Verificar el token
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid token',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
