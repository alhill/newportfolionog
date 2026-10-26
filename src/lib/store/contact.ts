export function joinPersonName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
}

export function splitLegacyName(name: string) {
  const trimmed = name.trim();
  const space = trimmed.indexOf(' ');
  if (space === -1) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1).trim(),
  };
}

export function normalizeCountryCode(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const key = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!raw || key === 'es' || key === 'esp' || key === 'espana' || key === 'spain') return 'ES';
  return raw.toUpperCase();
}

export function isSpanishPostalCode(value: string) {
  return /^(?:0[1-9]|[1-4]\d|5[0-2])\d{3}$/.test(value.trim());
}
