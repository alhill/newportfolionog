import { StoreError } from './errors';

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function requireAdmin(locals: { user?: { uid: string } | null }) {
  if (!locals.user) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }
  return null;
}

export function isIndexError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /FAILED_PRECONDITION|requires an index|index/i.test(message);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new StoreError('El cuerpo de la petición no es válido');
    }
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof StoreError) throw error;
    throw new StoreError('El cuerpo de la petición no es válido');
  }
}

export function handleStoreError(error: unknown) {
  if (error instanceof StoreError) {
    return json({ success: false, error: error.message }, error.status);
  }

  console.error(error);
  const message = error instanceof Error ? error.message : 'Error interno';
  if (isIndexError(error)) {
    return json({ success: false, error: message, indexRequired: true }, 500);
  }

  return json({ success: false, error: 'Error interno' }, 500);
}
