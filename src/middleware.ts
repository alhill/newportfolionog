import { defineMiddleware } from 'astro:middleware';
import { adminAuth } from './lib/firebase-admin';

export const onRequest = defineMiddleware(async ({ request, locals, redirect }, next) => {
  const url = new URL(request.url);
  
  // Proteger rutas /admin (excepto login)
  if (url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login')) {
    const authHeader = request.headers.get('Authorization');
    const sessionCookie = request.headers.get('Cookie')?.split(';')
      .find(c => c.trim().startsWith('session='))
      ?.split('=')[1];

    let token = authHeader?.replace('Bearer ', '') || sessionCookie;

    if (!token) {
      return redirect('/admin/login');
    }

    try {
      // Verificar el token con Firebase Admin
      const decodedToken = await adminAuth.verifyIdToken(token);
      locals.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
      };
    } catch (error) {
      console.error('Error verificando token:', error);
      return redirect('/admin/login');
    }
  }

  // Proteger endpoints API que requieren autenticación (POST, PUT, DELETE)
  if (url.pathname.startsWith('/api/') && ['POST', 'PUT', 'DELETE'].includes(request.method)) {
    const authHeader = request.headers.get('Authorization');
    const sessionCookie = request.headers.get('Cookie')?.split(';')
      .find(c => c.trim().startsWith('session='))
      ?.split('=')[1];

    let token = authHeader?.replace('Bearer ', '') || sessionCookie;

    if (token) {
      try {
        // Verificar el token con Firebase Admin
        const decodedToken = await adminAuth.verifyIdToken(token);
        locals.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
        };
      } catch (error) {
        console.error('Error verificando token en API:', error);
        // El endpoint manejará el error de autenticación
      }
    }
  }

  return next();
});
