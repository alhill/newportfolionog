import { adminDb } from '../firebase-admin';
import type { Product, Variant } from '../../types/store';
import { isIndexError } from './http';
import { getProduct, listProducts, mapProduct, toListItem } from './products';
import { getStoreSettings } from './settings';

interface LooseDoc {
  id: string;
  name?: string;
  slug?: string;
  title?: string;
  body?: string;
  href?: string;
  imageUrl?: string;
  slot?: string;
  sortOrder?: number;
}

function toLooseDoc(doc: FirebaseFirestore.QueryDocumentSnapshot): LooseDoc {
  return { id: doc.id, ...doc.data() };
}

async function safeDocs(collection: string, limit = 20) {
  try {
    const snapshot = await adminDb.collection(collection).where('isActive', '==', true).limit(limit).get();
    return snapshot.docs.map(toLooseDoc);
  } catch (error) {
    if (!isIndexError(error)) console.error(error);
    return [] as LooseDoc[];
  }
}

export async function getStorefront(categorySlug?: string | null) {
  const [settings, categories, brands, banners, blocks, pages, menus] = await Promise.all([
    getStoreSettings(),
    safeDocs('storeCategories', 40),
    safeDocs('storeBrands', 40),
    safeDocs('storeBanners', 8),
    safeDocs('storeBlocks', 12),
    adminDb.collection('storePages').where('published', '==', true).limit(20).get().then((snap) => snap.docs.map(toLooseDoc)).catch(() => [] as LooseDoc[]),
    safeDocs('storeMenus', 10),
  ]);

  const category = categorySlug
    ? categories.find((item) => item.slug === categorySlug) || null
    : null;

  const products = await listProducts({
    admin: false,
    limit: 60,
    categoryId: category ? String(category.id) : null,
  });

  const home = pages.find((page) => page.slug === 'inicio') || null;
  return {
    settings,
    categories,
    brands,
    banners: banners.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    blocks: blocks
      .filter((block) => !block.slot || block.slot === 'home')
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    menus,
    home,
    category,
    products,
  };
}

export async function getPublicProduct(slug: string) {
  const found = await getProduct(slug, { includeVariants: true });
  if (!found || !found.product.isActive) return null;
  const variants = found.product.hasVariants ? found.variants.filter((variant) => variant.isActive) : [];
  const related = await relatedSummaries(found.product.relatedProductIds);
  return { product: found.product, variants, related };
}

async function relatedSummaries(ids: string[]) {
  if (ids.length === 0) return [];
  const snaps = await adminDb.getAll(...ids.map((id) => adminDb.collection('products').doc(id)));
  return snaps
    .filter((snap) => snap.exists)
    .map((snap) => toListItem(mapProduct(snap.id, snap.data() || {})))
    .filter((item) => item.isActive);
}

export type PublicProductPayload = {
  product: Product;
  variants: Variant[];
};
