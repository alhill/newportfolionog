import { randomUUID } from 'node:crypto';
import { adminDb } from '../firebase-admin';
import type { Product, ProductListItem, ProductRecord, StoreImage, Variant, VariantRecord } from '../../types/store';
import { StoreError } from './errors';
import { isIndexError } from './http';
import { eurosToCents } from './money';
import { nextNogSku } from './identifiers';
import { slugify } from './slug';

const products = () => adminDb.collection('products');

function nowIso() {
  return new Date().toISOString();
}

function omitStock<T extends { stock: number | null }>(record: T) {
  const { stock, ...rest } = record;
  void stock;
  return rest;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringList(value: unknown, max = 20) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, max);
}

export function readAttributes(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const attributes: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const name = key.trim();
    const attrValue = typeof raw === 'string' ? raw.trim() : '';
    if (!name || !attrValue || name.includes('/') || name.startsWith('__')) continue;
    attributes[name.slice(0, 40)] = attrValue.slice(0, 80);
  }
  return attributes;
}

export function readImages(value: unknown): StoreImage[] {
  if (!Array.isArray(value)) return [];
  const images: StoreImage[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      images.push({ url: item.trim(), alt: '' });
    } else if (item && typeof item === 'object' && !Array.isArray(item)) {
      const url = asString((item as { url?: unknown }).url);
      if (!url || !/^https?:\/\//i.test(url)) continue;
      images.push({ url, alt: asString((item as { alt?: unknown }).alt).slice(0, 180) });
    }
    if (images.length >= 12) break;
  }
  return images;
}

export function mapProduct(id: string, data: FirebaseFirestore.DocumentData): Product {
  const hasVariants = data.hasVariants === true;
  return {
    id,
    name: asString(data.name),
    nameLower: asString(data.nameLower),
    slug: asString(data.slug),
    description: asString(data.description),
    images: readImages(data.images),
    price: typeof data.price === 'number' ? data.price : 0,
    hasVariants,
    sku: hasVariants ? null : asString(data.sku) || null,
    stock: hasVariants ? null : (typeof data.stock === 'number' ? data.stock : null),
    isActive: data.isActive !== false,
    categoryId: asString(data.categoryId) || null,
    brandId: asString(data.brandId) || null,
    collectionIds: asStringList(data.collectionIds),
    groupId: asString(data.groupId) || null,
    relatedProductIds: asStringList(data.relatedProductIds, 12),
    featured: data.featured === true,
    attributes: readAttributes(data.attributes),
    seoTitle: asString(data.seoTitle),
    seoDescription: asString(data.seoDescription),
    createdAt: asString(data.createdAt),
    updatedAt: asString(data.updatedAt),
    createdBy: asString(data.createdBy),
  };
}

export function mapVariant(id: string, productId: string, data: FirebaseFirestore.DocumentData): Variant {
  return {
    id,
    productId: asString(data.productId) || productId,
    sku: asString(data.sku),
    attributes: readAttributes(data.attributes),
    stock: typeof data.stock === 'number' ? data.stock : 0,
    price: typeof data.price === 'number' ? data.price : null,
    priceInherited: data.priceInherited === true,
    isActive: data.isActive !== false,
    images: readImages(data.images),
    createdAt: asString(data.createdAt),
    updatedAt: asString(data.updatedAt),
  };
}

export function toListItem(product: Product): ProductListItem {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    hasVariants: product.hasVariants,
    sku: product.sku,
    stock: product.stock,
    isActive: product.isActive,
    featured: product.featured,
    categoryId: product.categoryId,
    brandId: product.brandId,
    imageUrl: product.images[0]?.url || null,
    updatedAt: product.updatedAt,
  };
}

export async function suggestUniqueSlug(base: string, excludeId?: string) {
  let slug = slugify(base);
  if (!slug) throw new StoreError('El slug no es válido');

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
    const snapshot = await products().where('slug', '==', candidate).limit(2).get();
    const taken = snapshot.docs.some((doc) => doc.id !== excludeId);
    if (!taken) return candidate;
  }

  throw new StoreError('No se ha podido generar un slug único');
}

export async function assertSlugAvailable(slug: string, excludeId?: string) {
  const normalized = slug.trim();
  if (!normalized) throw new StoreError('El slug es obligatorio');
  if (slugify(normalized) !== normalized) {
    throw new StoreError('El slug solo puede tener minúsculas, números y guiones');
  }

  const snapshot = await products().where('slug', '==', normalized).limit(2).get();
  if (snapshot.docs.some((doc) => doc.id !== excludeId)) {
    throw new StoreError('Ese slug ya está en uso');
  }
  return normalized;
}

export async function assertSkuAvailable(sku: string, except?: { productId: string; variantId?: string | null }) {
  const normalized = sku.trim();
  if (!normalized) throw new StoreError('El SKU es obligatorio');

  const productHits = await products().where('sku', '==', normalized).limit(3).get();
  if (productHits.docs.some((doc) => !(except && !except.variantId && doc.id === except.productId))) {
    throw new StoreError(`El SKU ${normalized} ya está usado por otro producto`);
  }

  let variantHits: FirebaseFirestore.QuerySnapshot;
  try {
    variantHits = await adminDb.collectionGroup('variants').where('sku', '==', normalized).limit(3).get();
  } catch (error) {
    if (!isIndexError(error)) throw error;
    throw new StoreError('No se puede comprobar el SKU en todas las variantes hasta que el índice de grupo de colección esté activo. Despliega firestore.indexes.json y espera a que quede habilitado.');
  }
  const taken = variantHits.docs.some((doc) => {
    const productId = doc.ref.parent.parent?.id;
    return !(except?.variantId && productId === except.productId && doc.id === except.variantId);
  });
  if (taken) throw new StoreError(`El SKU ${normalized} ya está usado por una variante`);
}

async function usedNogSkus(except?: { productId: string; variantId?: string | null }) {
  const used = new Set<string>();
  const add = (value: unknown, skip: boolean) => {
    if (skip) return;
    const sku = asString(value).toUpperCase();
    if (sku) used.add(sku);
  };

  const productHits = await products().where('sku', '>=', 'NOG').where('sku', '<=', 'NOG\uf8ff').get();
  for (const doc of productHits.docs) {
    add(doc.get('sku'), Boolean(except && !except.variantId && doc.id === except.productId));
  }

  let variantHits: FirebaseFirestore.QuerySnapshot;
  try {
    variantHits = await adminDb.collectionGroup('variants').where('sku', '>=', 'NOG').where('sku', '<=', 'NOG\uf8ff').get();
  } catch (error) {
    if (!isIndexError(error)) throw error;
    throw new StoreError('No se puede generar el SKU hasta que el índice de variantes esté activo. Despliega firestore.indexes.json y espera a que quede habilitado.');
  }

  for (const doc of variantHits.docs) {
    const productId = doc.ref.parent.parent?.id;
    const skip = Boolean(except?.variantId && productId === except.productId && doc.id === except.variantId);
    add(doc.get('sku'), skip);
  }

  return used;
}

export async function suggestUniqueSku(reserved: string[] = [], except?: { productId: string; variantId?: string | null }) {
  const used = await usedNogSkus(except);
  for (const sku of reserved) {
    const normalized = sku.trim().toUpperCase();
    if (normalized) used.add(normalized);
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    let candidate = '';
    try {
      candidate = nextNogSku(used);
    } catch {
      throw new StoreError('No se ha podido generar un SKU único');
    }

    try {
      await assertSkuAvailable(candidate, except);
      return candidate;
    } catch (error) {
      if (!(error instanceof StoreError) || !/ya está usado/i.test(error.message)) throw error;
      used.add(candidate.toUpperCase());
    }
  }

  throw new StoreError('No se ha podido generar un SKU único');
}

interface VariantInput {
  id?: string;
  sku: string;
  attributes: Record<string, string>;
  stock: number;
  expectedStock?: number | null;
  price: number | null;
  priceInherited: boolean;
  isActive: boolean;
  images: StoreImage[];
}

export function readVariantInput(raw: unknown): VariantInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new StoreError('La variante no es válida');
  }
  const input = raw as Record<string, unknown>;
  const priceInherited = input.priceInherited === true;
  let price: number | null = null;
  if (!priceInherited) {
    price = typeof input.price === 'number' && Number.isInteger(input.price)
      ? input.price
      : eurosToCents(input.priceEuros ?? input.price);
  }

  const stock = Number(input.stock);
  if (!Number.isInteger(stock) || stock < 0) throw new StoreError('El stock de la variante no es válido');

  const expected = input.expectedStock == null || input.expectedStock === ''
    ? null
    : Number(input.expectedStock);

  return {
    id: asString(input.id) || undefined,
    sku: asString(input.sku),
    attributes: readAttributes(input.attributes),
    stock,
    expectedStock: expected != null && Number.isInteger(expected) ? expected : null,
    price,
    priceInherited,
    isActive: input.isActive !== false,
    images: readImages(input.images),
  };
}

function readVariantList(value: unknown) {
  if (!Array.isArray(value)) return [];
  if (value.length > 100) throw new StoreError('Un producto admite como máximo 100 variantes');
  const variants = value.map(readVariantInput);
  const skus = new Set<string>();
  const signatures = new Set<string>();
  for (const variant of variants) {
    const sku = variant.sku.toLowerCase();
    if (skus.has(sku)) throw new StoreError(`SKU repetido: ${variant.sku}`);
    skus.add(sku);
    const signature = Object.keys(variant.attributes).sort().map((key) => `${key}=${variant.attributes[key]}`).join('|');
    if (signature && signatures.has(signature)) {
      throw new StoreError('Hay dos variantes con los mismos atributos');
    }
    if (signature) signatures.add(signature);
  }
  return variants;
}

interface ProductWrite {
  name: string;
  slug: string;
  description: string;
  images: StoreImage[];
  price: number;
  isActive: boolean;
  categoryId: string | null;
  brandId: string | null;
  collectionIds: string[];
  groupId: string | null;
  relatedProductIds: string[];
  featured: boolean;
  attributes: Record<string, string>;
  seoTitle: string;
  seoDescription: string;
  hasVariants: boolean;
  sku: string | null;
  stock: number | null;
  expectedStock: number | null;
  variants: VariantInput[];
}

function readProductWrite(input: Record<string, unknown>, mode: 'create' | 'update'): ProductWrite {
  const name = asString(input.name);
  if (!name) throw new StoreError('El nombre es obligatorio');
  const slug = asString(input.slug);
  if (!slug) throw new StoreError('El slug es obligatorio');

  const hasVariants = input.hasVariants === true;
  const price = typeof input.price === 'number' && Number.isInteger(input.price) && input.priceInputUnit !== 'euros'
    ? input.price
    : eurosToCents(input.priceEuros ?? input.price);

  const stockValue = input.stock == null || input.stock === '' ? null : Number(input.stock);
  const expectedValue = input.expectedStock == null || input.expectedStock === '' ? null : Number(input.expectedStock);

  return {
    name,
    slug,
    description: asString(input.description).slice(0, 20000),
    images: readImages(input.images),
    price,
    isActive: input.isActive !== false,
    categoryId: asString(input.categoryId) || null,
    brandId: asString(input.brandId) || null,
    collectionIds: asStringList(input.collectionIds),
    groupId: asString(input.groupId).replace(/\//g, '').slice(0, 80) || null,
    relatedProductIds: asStringList(input.relatedProductIds, 12),
    featured: asBoolean(input.featured),
    attributes: readAttributes(input.attributes),
    seoTitle: asString(input.seoTitle).slice(0, 180),
    seoDescription: asString(input.seoDescription).slice(0, 320),
    hasVariants,
    sku: hasVariants ? null : asString(input.sku) || null,
    stock: hasVariants ? null : stockValue,
    expectedStock: expectedValue != null && Number.isInteger(expectedValue) ? expectedValue : null,
    variants: mode === 'create' || Array.isArray(input.variants) ? readVariantList(input.variants) : [],
  };
}

function productFields(write: ProductWrite, slug: string, timestamps: { createdAt?: string; updatedAt: string; createdBy?: string }): ProductRecord {
  return {
    name: write.name,
    nameLower: write.name.toLowerCase(),
    slug,
    description: write.description,
    images: write.images,
    price: write.price,
    hasVariants: write.hasVariants,
    sku: write.hasVariants ? null : write.sku,
    stock: write.hasVariants ? null : write.stock,
    isActive: write.isActive,
    categoryId: write.categoryId,
    brandId: write.brandId,
    collectionIds: write.collectionIds,
    groupId: write.groupId,
    relatedProductIds: write.relatedProductIds.filter((id) => id !== ''),
    featured: write.featured,
    attributes: write.attributes,
    seoTitle: write.seoTitle,
    seoDescription: write.seoDescription,
    createdAt: timestamps.createdAt || timestamps.updatedAt,
    updatedAt: timestamps.updatedAt,
    createdBy: timestamps.createdBy || '',
  };
}

function variantFields(input: VariantInput, productId: string, timestamps: { createdAt: string; updatedAt: string }): VariantRecord {
  return {
    productId,
    sku: input.sku.trim(),
    attributes: input.attributes,
    stock: input.stock,
    price: input.priceInherited ? null : input.price,
    priceInherited: input.priceInherited,
    isActive: input.isActive,
    images: input.images,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  };
}

export async function listProducts(options: { admin?: boolean; limit?: number; categoryId?: string | null; search?: string } = {}) {
  const limit = Math.min(Math.max(options.limit || 60, 1), 100);
  let query: FirebaseFirestore.Query = products();

  if (options.search) {
    const prefix = options.search.trim().toLowerCase();
    query = query.where('nameLower', '>=', prefix).where('nameLower', '<=', `${prefix}\uf8ff`);
  } else if (!options.admin && options.categoryId) {
    query = query.where('categoryId', '==', options.categoryId);
  } else if (!options.admin) {
    query = query.where('isActive', '==', true);
  } else {
    query = query.orderBy('updatedAt', 'desc');
  }

  const snapshot = await query.limit(limit).get();
  let items = snapshot.docs.map((doc) => mapProduct(doc.id, doc.data()));
  if (!options.admin) items = items.filter((item) => item.isActive);
  if (options.categoryId) items = items.filter((item) => item.categoryId === options.categoryId);
  items.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return items.slice(0, limit).map(toListItem);
}

export async function getProduct(idOrSlug: string, options: { includeVariants?: boolean } = {}) {
  const byId = await products().doc(idOrSlug).get();
  const doc = byId.exists ? byId : (await products().where('slug', '==', idOrSlug).limit(1).get()).docs[0];
  if (!doc) return null;

  const product = mapProduct(doc.id, doc.data() || {});
  if (!options.includeVariants) return { product, variants: [] as Variant[] };

  const variantsSnap = await doc.ref.collection('variants').get();
  const variants = variantsSnap.docs
    .map((variant) => mapVariant(variant.id, doc.id, variant.data()))
    .sort((a, b) => a.sku.localeCompare(b.sku, 'es'));
  return { product, variants };
}

export async function compareAndSetStock(ref: FirebaseFirestore.DocumentReference, expected: number | null, next: number | null) {
  if (next == null) return;
  if (!Number.isInteger(next) || next < 0) throw new StoreError('El stock no es válido');
  if (expected === next) return;

  await adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) throw new StoreError('El documento de stock ya no existe', 404);
    const current = fresh.get('stock');
    if (expected != null && current !== expected) {
      throw new StoreError('El stock ha cambiado desde que abriste la ficha. Recarga antes de guardarlo.', 409);
    }
    tx.update(ref, { stock: next, updatedAt: nowIso() });
  });
}

export async function createProduct(input: Record<string, unknown>, userId: string) {
  const write = readProductWrite(input, 'create');
  if (!write.hasVariants) {
    if (!write.sku) throw new StoreError('El SKU es obligatorio');
    if (write.stock == null || !Number.isInteger(write.stock) || write.stock < 0) {
      throw new StoreError('El stock es obligatorio');
    }
    await assertSkuAvailable(write.sku);
  } else if (write.variants.length === 0) {
    throw new StoreError('Añade al menos una variante');
  }

  const slug = await assertSlugAvailable(write.slug);
  const timestamp = nowIso();
  const ref = products().doc();
  const record = productFields(write, slug, { createdAt: timestamp, updatedAt: timestamp, createdBy: userId });
  if (write.hasVariants) {
    record.sku = null;
    record.stock = null;
  }

  const batch = adminDb.batch();
  batch.set(ref, record);

  if (write.hasVariants) {
    for (const variant of write.variants) {
      await assertSkuAvailable(variant.sku);
      const variantRef = ref.collection('variants').doc();
      batch.set(variantRef, variantFields(variant, ref.id, { createdAt: timestamp, updatedAt: timestamp }));
    }
  }

  await batch.commit();
  return getProduct(ref.id, { includeVariants: true });
}

export async function updateProduct(id: string, input: Record<string, unknown>) {
  const existing = await getProduct(id, { includeVariants: true });
  if (!existing) throw new StoreError('Producto no encontrado', 404);

  const write = readProductWrite({ ...input, hasVariants: existing.product.hasVariants }, 'update');
  write.hasVariants = existing.product.hasVariants;
  if (input.hasVariants != null && Boolean(input.hasVariants) !== existing.product.hasVariants) {
    throw new StoreError('Para crear variantes manteniendo este producto usa la conversión. Así no se vende a la vez el padre y las variantes.');
  }

  const slug = await assertSlugAvailable(write.slug, id);
  const timestamp = nowIso();
  const ref = products().doc(id);

  if (!write.hasVariants) {
    if (!write.sku) throw new StoreError('El SKU es obligatorio');
    if (write.stock == null || !Number.isInteger(write.stock) || write.stock < 0) {
      throw new StoreError('El stock es obligatorio');
    }
    await assertSkuAvailable(write.sku, { productId: id });
    const nextStock = write.stock;
    const record = productFields(write, slug, {
      createdAt: existing.product.createdAt,
      updatedAt: timestamp,
      createdBy: existing.product.createdBy,
    });
    await ref.set(omitStock(record), { merge: true });
    await compareAndSetStock(ref, write.expectedStock ?? existing.product.stock, nextStock);
    return getProduct(id, { includeVariants: true });
  }

  const record = productFields(write, slug, {
    createdAt: existing.product.createdAt,
    updatedAt: timestamp,
    createdBy: existing.product.createdBy,
  });
  record.sku = null;
  record.stock = null;
  await ref.set(record);

  if (Array.isArray(input.variants)) {
    await syncVariants(id, write.variants, existing.variants);
  }

  return getProduct(id, { includeVariants: true });
}

async function syncVariants(productId: string, next: VariantInput[], current: Variant[]) {
  if (next.length === 0) throw new StoreError('Un producto con variantes necesita al menos una');

  const currentById = new Map(current.map((variant) => [variant.id, variant]));
  const kept = new Set<string>();
  const parent = products().doc(productId);

  for (const variant of next) {
    if (variant.id && !currentById.has(variant.id)) {
      throw new StoreError('Una de las variantes ya no existe. Recarga la ficha.');
    }
    await assertSkuAvailable(variant.sku, variant.id ? { productId, variantId: variant.id } : undefined);
  }

  const batch = adminDb.batch();
  const timestamp = nowIso();
  const stockUpdates: { ref: FirebaseFirestore.DocumentReference; expected: number; next: number }[] = [];

  for (const variant of next) {
    if (variant.id) {
      kept.add(variant.id);
      const previous = currentById.get(variant.id)!;
      const ref = parent.collection('variants').doc(variant.id);
      const fields = variantFields(variant, productId, { createdAt: previous.createdAt, updatedAt: timestamp });
      batch.set(ref, omitStock(fields), { merge: true });
      if (variant.expectedStock != null && variant.stock !== variant.expectedStock) {
        stockUpdates.push({ ref, expected: variant.expectedStock, next: variant.stock });
      } else if (variant.expectedStock == null && variant.stock !== previous.stock) {
        stockUpdates.push({ ref, expected: previous.stock, next: variant.stock });
      }
    } else {
      const ref = parent.collection('variants').doc();
      batch.set(ref, variantFields(variant, productId, { createdAt: timestamp, updatedAt: timestamp }));
    }
  }

  for (const variant of current) {
    if (!kept.has(variant.id)) batch.delete(parent.collection('variants').doc(variant.id));
  }

  await batch.commit();

  for (const update of stockUpdates) {
    await compareAndSetStock(update.ref, update.expected, update.next);
  }
}

export async function convertProductToVariants(id: string, input: Record<string, unknown>) {
  const existing = await getProduct(id, { includeVariants: false });
  if (!existing) throw new StoreError('Producto no encontrado', 404);
  if (existing.product.hasVariants) throw new StoreError('Este producto ya tiene variantes');
  if (!existing.product.sku || existing.product.stock == null) {
    throw new StoreError('El producto simple no tiene SKU o stock para transferir');
  }

  const provided = Array.isArray(input.variants) ? readVariantList(input.variants) : [];
  const variants = provided.length > 0 ? provided : [{
    sku: existing.product.sku,
    attributes: {},
    stock: existing.product.stock,
    price: existing.product.price,
    priceInherited: false,
    isActive: existing.product.isActive,
    images: [],
  } satisfies VariantInput];

  for (const variant of variants) {
    const except = variant.sku === existing.product.sku ? { productId: id } : undefined;
    await assertSkuAvailable(variant.sku, except);
  }

  const ref = products().doc(id);
  const timestamp = nowIso();

  await adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) throw new StoreError('Producto no encontrado', 404);
    if (fresh.get('hasVariants') === true) throw new StoreError('Este producto ya tiene variantes');

    const created: FirebaseFirestore.DocumentReference[] = [];
    for (const variant of variants) {
      const variantRef = ref.collection('variants').doc();
      created.push(variantRef);
      tx.set(variantRef, variantFields(variant, id, { createdAt: timestamp, updatedAt: timestamp }));
    }

    tx.update(ref, {
      hasVariants: true,
      sku: null,
      stock: null,
      updatedAt: timestamp,
    });

    void created;
  });

  return getProduct(id, { includeVariants: true });
}

export async function deleteProduct(id: string) {
  const ref = products().doc(id);
  const variants = await ref.collection('variants').get();
  const batch = adminDb.batch();
  variants.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(ref);
  await batch.commit();
}

export async function setFeatured(id: string, featured: boolean) {
  const ref = products().doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new StoreError('Producto no encontrado', 404);
  await ref.update({ featured, updatedAt: nowIso() });
}

export function newId() {
  return randomUUID();
}
