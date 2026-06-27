import { defineMiddleware } from 'astro:middleware';
import { adminAuth } from './lib/firebase-admin';
import redirectionsSnapshot from './generated/redirections.snapshot.json';

type RedirectionEntry = {
  from?: string;
  to?: string;
  statusCode?: number;
};

const redirectionMap = new Map<string, RedirectionEntry>();

for (const entry of redirectionsSnapshot.items || []) {
  const from = normalizePath(entry.from);
  const to = String(entry.to || '').trim();

  if (!from || !to || redirectionMap.has(from)) {
    continue;
  }

  redirectionMap.set(from, {
    from,
    to,
    statusCode: Number(entry.statusCode) || 308,
  });
}

function normalizePath(input: string | undefined | null) {
  const value = String(input || '').trim();
  if (!value) return '';

  try {
    const parsedUrl = new URL(value);
    return normalizePath(parsedUrl.pathname);
  } catch {
    // Not a full URL, continue with path normalization.
  }

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  const collapsed = withLeadingSlash.replace(/\/+/, '/').replace(/\/+/g, '/');

  if (collapsed !== '/' && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }

  return collapsed;
}

function shouldApplyDynamicRedirection(pathname: string) {
  return !(pathname.startsWith('/admin') || pathname.startsWith('/api/') || pathname.startsWith('/_astro/'));
}

function buildRedirectTarget(currentUrl: URL, target: string) {
  const redirectUrl = new URL(target, currentUrl.origin);

  // If destination does not include query params, keep the incoming ones.
  if (!redirectUrl.search && currentUrl.search) {
    redirectUrl.search = currentUrl.search;
  }

  if (redirectUrl.origin === currentUrl.origin) {
    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
  }

  return redirectUrl.toString();
}

function getSessionToken(request: Request): string | undefined {
  const authHeader = request.headers.get('Authorization');
  const sessionCookie = request.headers.get('Cookie')?.split(';')
    .find(c => c.trim().startsWith('session='))
    ?.split('=')[1];

  return authHeader?.replace('Bearer ', '') || sessionCookie;
}

async function verifySessionToken(token: string) {
  const decodedToken = await adminAuth.verifyIdToken(token);
  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
  };
}

export const onRequest = defineMiddleware(async ({ request, locals, redirect }, next) => {
  const url = new URL(request.url);

  if ((request.method === 'GET' || request.method === 'HEAD') && shouldApplyDynamicRedirection(url.pathname)) {
    const from = normalizePath(url.pathname);
    const hit = redirectionMap.get(from);

    if (hit?.to) {
      const target = buildRedirectTarget(url, hit.to);
      const statusCode = hit.statusCode && hit.statusCode >= 300 && hit.statusCode <= 399 ? hit.statusCode : 308;

      const targetPath = target.startsWith('http') ? normalizePath(new URL(target).pathname) : normalizePath(target);

      // Prevent accidental loops if from and to resolve to the same path.
      if (targetPath !== from) {
        return redirect(target, statusCode);
      }
    }
  }
  
  // Proteger rutas /admin (excepto login)
  if (url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login')) {
    const token = getSessionToken(request);

    if (!token) {
      return redirect('/admin/login');
    }

    try {
      locals.user = await verifySessionToken(token);
    } catch (error) {
      console.error('Error verificando token:', error);
      return redirect('/admin/login');
    }
  }

  // Proteger endpoints API que requieren autenticación (POST, PUT, DELETE)
  if (url.pathname.startsWith('/api/') && ['POST', 'PUT', 'DELETE'].includes(request.method)) {
    const token = getSessionToken(request);

    if (token) {
      try {
        locals.user = await verifySessionToken(token);
      } catch (error) {
        console.error('Error verificando token en API:', error);
        // El endpoint manejará el error de autenticación
      }
    }
  }

  // Detectar admin en páginas públicas (p. ej. enlace "Editar este proyecto")
  if (!locals.user) {
    const token = getSessionToken(request);

    if (token) {
      try {
        locals.user = await verifySessionToken(token);
      } catch {
        // Cookie caducada o inválida: ignorar silenciosamente en páginas públicas
      }
    }
  }

  return next();
});
