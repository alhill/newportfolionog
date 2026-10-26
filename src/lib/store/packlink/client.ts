import { StoreError } from '../errors';

const API = 'https://api.packlink.com/v1/';

function errorMessage(body: unknown, status: number) {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) return record.message.trim();
    if (typeof record.error === 'string' && record.error.trim()) return record.error.trim();
    const messages = record.messages;
    if (messages && typeof messages === 'object') {
      const first = Object.values(messages as Record<string, unknown>).flat()[0];
      if (typeof first === 'string' && first.trim()) return first.trim();
    }
  }
  if (status === 401) return 'La API key de Packlink no es válida';
  return `Packlink respondió ${status}`;
}

export async function packlinkFetch(apiKey: string, path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path.replace(/^\//, '')}`, {
    ...init,
    headers: {
      Authorization: apiKey,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text.slice(0, 240) };
    }
  }
  if (!response.ok) {
    throw new StoreError(errorMessage(body, response.status), response.status >= 500 ? 502 : 400);
  }
  return body;
}
