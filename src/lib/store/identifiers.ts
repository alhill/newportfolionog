/** Next free SKU in the NOG series: NOG1, NOG2, NOG3… */
export function nextNogSku(used: Iterable<string>): string {
  const taken = new Set<string>();
  for (const value of used) {
    const sku = value.trim().toUpperCase();
    if (sku) taken.add(sku);
  }

  for (let index = 1; index < 100000; index += 1) {
    const candidate = `NOG${index}`;
    if (!taken.has(candidate)) return candidate;
  }

  throw new Error('No se ha podido generar un SKU único');
}
