export interface MergeResult<T> {
  items: T[];
  leftUsed: number;
  rightUsed: number;
  hasMore: boolean;
}

/**
 * Une dos listas ya ordenadas y se queda con una página.
 * El llamador pide `limit + 1` a cada fuente para saber si queda otra página
 * sin recorrer el inventario completo.
 */
export function mergeSorted<T>(left: T[], right: T[], limit: number, compare: (a: T, b: T) => number): MergeResult<T> {
  const items: T[] = [];
  let leftUsed = 0;
  let rightUsed = 0;

  while (items.length < limit && (leftUsed < left.length || rightUsed < right.length)) {
    const leftItem = left[leftUsed];
    const rightItem = right[rightUsed];
    const takeLeft = rightItem == null || (leftItem != null && compare(leftItem, rightItem) <= 0);

    if (takeLeft && leftItem != null) {
      items.push(leftItem);
      leftUsed += 1;
    } else if (rightItem != null) {
      items.push(rightItem);
      rightUsed += 1;
    } else {
      break;
    }
  }

  return {
    items,
    leftUsed,
    rightUsed,
    hasMore: leftUsed < left.length || rightUsed < right.length,
  };
}

export function compareSku(a: { sku: string; cursorId: string }, b: { sku: string; cursorId: string }) {
  const bySku = a.sku.localeCompare(b.sku, 'es');
  if (bySku !== 0) return bySku;
  return a.cursorId.localeCompare(b.cursorId);
}

export function compareStock(a: { stock: number; cursorId: string }, b: { stock: number; cursorId: string }) {
  if (a.stock !== b.stock) return a.stock - b.stock;
  return a.cursorId.localeCompare(b.cursorId);
}
