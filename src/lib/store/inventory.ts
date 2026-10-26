import { FieldPath } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import type { InventoryCursor, InventoryItem } from '../../types/store';
import { StoreError } from './errors';
import { isIndexError } from './http';
import { compareSku, compareStock, mergeSorted } from './inventory-merge';
import { resolveSellable } from './pricing';
import { compareAndSetStock, mapProduct, mapVariant } from './products';
import { getStoreSettings } from './settings';

interface InventoryQuery {
  limit?: number;
  source?: 'all' | 'product' | 'variant';
  isActive?: boolean;
  lowStock?: boolean;
  productCursor?: string | null;
  variantCursor?: string | null;
}

function encodeCursor(cursor: InventoryCursor | { done: true } | null) {
  if (!cursor) return null;
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(value: string | null | undefined): InventoryCursor | { done: true } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as InventoryCursor & { done?: boolean };
    if (parsed?.done) return { done: true };
    if (!parsed || typeof parsed.id !== 'string') return null;
    return parsed;
  } catch {
    throw new StoreError('El cursor de inventario no es válido');
  }
}

function productCursorId(id: string) {
  return id;
}

function variantCursorId(productId: string, variantId: string) {
  return `products/${productId}/variants/${variantId}`;
}

function itemFromProduct(id: string, data: FirebaseFirestore.DocumentData): InventoryItem | null {
  const product = mapProduct(id, data);
  if (product.hasVariants || product.stock == null || !product.sku) return null;
  let price = product.price;
  try {
    price = resolveSellable(product, null).unitPrice;
  } catch {
    price = product.price;
  }
  return {
    source: 'product',
    productId: id,
    variantId: null,
    productName: product.name,
    sku: product.sku,
    attributes: {},
    stock: product.stock,
    price,
    priceInherited: false,
    isActive: product.isActive,
    sellable: product.isActive && product.stock > 0,
    cursorId: productCursorId(id),
  };
}

function itemFromVariant(doc: FirebaseFirestore.QueryDocumentSnapshot): InventoryItem | null {
  const productId = doc.ref.parent.parent?.id;
  if (!productId) return null;
  const variant = mapVariant(doc.id, productId, doc.data());
  return {
    source: 'variant',
    productId,
    variantId: variant.id,
    productName: '',
    sku: variant.sku,
    attributes: variant.attributes,
    stock: variant.stock,
    price: variant.price ?? 0,
    priceInherited: variant.priceInherited,
    isActive: variant.isActive,
    sellable: false,
    cursorId: variantCursorId(productId, variant.id),
  };
}

async function hydrateVariants(items: InventoryItem[]) {
  const ids = [...new Set(items.filter((item) => item.source === 'variant').map((item) => item.productId))];
  if (ids.length === 0) return items;
  const snaps = await adminDb.getAll(...ids.map((id) => adminDb.collection('products').doc(id)));
  const byId = new Map(snaps.filter((snap) => snap.exists).map((snap) => [snap.id, mapProduct(snap.id, snap.data() || {})]));

  return items.map((item) => {
    if (item.source !== 'variant') return item;
    const product = byId.get(item.productId);
    if (!product || !product.hasVariants) {
      return { ...item, productName: product?.name || 'Producto eliminado', sellable: false };
    }
    try {
      const resolved = resolveSellable(product, {
        sku: item.sku,
        stock: item.stock,
        price: item.priceInherited ? null : item.price,
        priceInherited: item.priceInherited,
        isActive: item.isActive,
        attributes: item.attributes,
      });
      return {
        ...item,
        productName: product.name,
        price: resolved.unitPrice,
        sellable: resolved.isActive && resolved.stock > 0,
      };
    } catch {
      return { ...item, productName: product.name, sellable: false };
    }
  });
}

function sideCursor(
  fetched: InventoryItem[],
  used: number,
  fetchSize: number,
  incoming: InventoryCursor | { done: true } | null,
) {
  if (incoming && 'done' in incoming) return incoming;
  if (fetched.length === 0) return { done: true as const };
  if (used === 0) return incoming;
  if (used >= fetched.length && fetched.length < fetchSize) return { done: true as const };
  const last = fetched[used - 1];
  return { sku: last.sku, id: last.cursorId };
}

async function queryProducts(limit: number, cursor: InventoryCursor | { done: true } | null, isActive?: boolean) {
  if (cursor && 'done' in cursor) return [];
  let query = adminDb.collection('products').where('hasVariants', '==', false) as FirebaseFirestore.Query;
  if (typeof isActive === 'boolean') query = query.where('isActive', '==', isActive);
  query = query.orderBy('sku').orderBy(FieldPath.documentId());
  if (cursor && cursor.sku != null) query = query.startAfter(cursor.sku, cursor.id);
  const snapshot = await query.limit(limit).get();
  return snapshot.docs.map((doc) => itemFromProduct(doc.id, doc.data())).filter((item): item is InventoryItem => Boolean(item));
}

async function queryVariants(limit: number, cursor: InventoryCursor | { done: true } | null, isActive?: boolean) {
  if (cursor && 'done' in cursor) return [];
  let query = adminDb.collectionGroup('variants') as FirebaseFirestore.Query;
  if (typeof isActive === 'boolean') query = query.where('isActive', '==', isActive);
  query = query.orderBy('sku').orderBy(FieldPath.documentId());
  if (cursor && cursor.sku != null) query = query.startAfter(cursor.sku, cursor.id);
  const snapshot = await query.limit(limit).get();
  return snapshot.docs.map(itemFromVariant).filter((item): item is InventoryItem => Boolean(item));
}

async function listIndexed(params: InventoryQuery) {
  const limit = Math.min(Math.max(params.limit || 40, 1), 80);
  const fetchSize = limit + 1;
  const source = params.source || 'all';
  const productCursor = decodeCursor(params.productCursor);
  const variantCursor = decodeCursor(params.variantCursor);

  const [productRows, variantRows] = await Promise.all([
    source === 'variant' ? Promise.resolve([]) : queryProducts(fetchSize, productCursor, params.isActive),
    source === 'product' ? Promise.resolve([]) : queryVariants(fetchSize, variantCursor, params.isActive),
  ]);

  const merged = mergeSorted(productRows, variantRows, limit, compareSku);
  const items = await hydrateVariants(merged.items);
  return {
    items,
    paginationMode: 'indexed' as const,
    truncated: false,
    warning: '',
    hasMore: merged.hasMore,
    productCursor: encodeCursor(source === 'variant' ? { done: true } : sideCursor(productRows, merged.leftUsed, fetchSize, productCursor)),
    variantCursor: encodeCursor(source === 'product' ? { done: true } : sideCursor(variantRows, merged.rightUsed, fetchSize, variantCursor)),
  };
}

async function listPreview(params: InventoryQuery, warning: string) {
  const limit = Math.min(params.limit || 40, 80);
  const cap = 80;
  const [productSnap, variantSnap] = await Promise.all([
    params.source === 'variant'
      ? Promise.resolve(null)
      : adminDb.collection('products').where('hasVariants', '==', false).limit(cap).get(),
    params.source === 'product'
      ? Promise.resolve(null)
      : adminDb.collectionGroup('variants').limit(cap).get(),
  ]);

  let products = productSnap ? productSnap.docs.map((doc) => itemFromProduct(doc.id, doc.data())).filter((item): item is InventoryItem => Boolean(item)) : [];
  let variants = variantSnap ? variantSnap.docs.map(itemFromVariant).filter((item): item is InventoryItem => Boolean(item)) : [];
  if (typeof params.isActive === 'boolean') {
    products = products.filter((item) => item.isActive === params.isActive);
    variants = variants.filter((item) => item.isActive === params.isActive);
  }
  products.sort(compareSku);
  variants.sort(compareSku);
  const merged = mergeSorted(products, variants, limit, compareSku);
  return {
    items: await hydrateVariants(merged.items),
    paginationMode: 'preview' as const,
    truncated: (productSnap?.size || 0) >= cap || (variantSnap?.size || 0) >= cap,
    warning,
    hasMore: false,
    productCursor: null,
    variantCursor: null,
  };
}

function missingIndexWarning(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const link = message.match(/https:\/\/console\.firebase\.google\.com\S+/)?.[0];
  const text = 'Falta el índice de grupo de colección de variants. Las reglas de seguridad no bloquean esta lectura: el servidor usa Admin SDK y no pasa por ellas. Recargar la página no crea el índice. Hay que desplegar firestore.indexes.json y esperar a que quede habilitado.';
  return link ? `${text} ${link}` : text;
}

async function listLow(params: InventoryQuery) {
  const settings = await getStoreSettings();
  const threshold = settings.lowStockThreshold;
  const cap = 50;
  const productSnap = params.source === 'variant'
    ? null
    : await adminDb.collection('products').where('stock', '<=', threshold).limit(cap).get();

  let variantSnap: FirebaseFirestore.QuerySnapshot | null = null;
  let warning = '';
  if (params.source !== 'product') {
    try {
      variantSnap = await adminDb.collectionGroup('variants').where('stock', '<=', threshold).limit(cap).get();
    } catch (error) {
      if (!isIndexError(error)) throw error;
      warning = missingIndexWarning(error);
      variantSnap = await adminDb.collectionGroup('variants').limit(cap).get();
    }
  }

  let products = (productSnap?.docs || [])
    .map((doc) => itemFromProduct(doc.id, doc.data()))
    .filter((item): item is InventoryItem => Boolean(item && item.stock <= threshold));
  let variants = (variantSnap?.docs || [])
    .map(itemFromVariant)
    .filter((item): item is InventoryItem => Boolean(item && item.stock <= threshold));
  if (typeof params.isActive === 'boolean') {
    products = products.filter((item) => item.isActive === params.isActive);
    variants = variants.filter((item) => item.isActive === params.isActive);
  }

  const merged = mergeSorted(products, variants, Math.min(params.limit || cap, cap), compareStock);
  return {
    items: await hydrateVariants(merged.items),
    paginationMode: 'low-stock' as const,
    truncated: Boolean(warning) || (productSnap?.size || 0) >= cap || (variantSnap?.size || 0) >= cap,
    warning,
    hasMore: false,
    productCursor: null,
    variantCursor: null,
    threshold,
  };
}

/**
 * Inventario = productos simples (`hasVariants == false`) + `collectionGroup('variants')`.
 * No hay colección intermedia. La ordenación por SKU usa índices compuestos y,
 * en el grupo de colección, una exención de campo. Si todavía no están
 * desplegados, se devuelve una muestra acotada.
 * El filtro de poco stock es una desigualdad sobre `stock` y se corta en 50 por fuente.
 */
export async function listInventory(params: InventoryQuery = {}) {
  if (params.lowStock) return listLow(params);
  try {
    return await listIndexed(params);
  } catch (error) {
    if (!isIndexError(error)) throw error;
    return listPreview(params, missingIndexWarning(error));
  }
}

export async function updateInventoryStock(input: Record<string, unknown>) {
  const productId = typeof input.productId === 'string' ? input.productId : '';
  const variantId = typeof input.variantId === 'string' && input.variantId ? input.variantId : null;
  const stock = Number(input.stock);
  const expected = Number(input.expectedStock);
  if (!productId) throw new StoreError('Falta el producto');
  if (!Number.isInteger(stock) || stock < 0 || !Number.isInteger(expected)) {
    throw new StoreError('El stock no es válido');
  }

  const parentRef = adminDb.collection('products').doc(productId);
  const parent = await parentRef.get();
  if (!parent.exists) throw new StoreError('Producto no encontrado', 404);
  const hasVariants = parent.get('hasVariants') === true;

  if (variantId) {
    if (!hasVariants) throw new StoreError('Ese producto no guarda el stock en variantes');
    await compareAndSetStock(parentRef.collection('variants').doc(variantId), expected, stock);
    return;
  }

  if (hasVariants) throw new StoreError('El stock de un producto con variantes se edita en cada variante');
  await compareAndSetStock(parentRef, expected, stock);
}
