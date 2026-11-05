import { adminDb } from '../firebase-admin';
import { StoreError } from './errors';
import { isIndexError } from './http';
import {
  describeMenu,
  fallbackStoreMenu,
  resolveStoreMenu,
  sanitizeStoreMenu,
  type MenuItem,
  type MenuTarget,
  type MenuTargets,
  type StoreMenu,
} from './menu';

const emptyTargets: MenuTargets = { categories: [], landings: [], products: [] };

const menuRef = () => adminDb.collection('storeMenu').doc('main');

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function listActiveCategories() {
  try {
    const snapshot = await adminDb.collection('storeCategories').where('isActive', '==', true).limit(40).get();
    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        name: asString(doc.get('name')),
        slug: asString(doc.get('slug')),
      }))
      .filter((category) => category.name && category.slug);
  } catch (error) {
    if (!isIndexError(error)) console.error(error);
    return [];
  }
}

async function fetchTargets(collection: string, ids: string[], nameField: 'name' | 'title', active: (data: FirebaseFirestore.DocumentData) => boolean) {
  if (ids.length === 0) return [] as MenuTarget[];
  const snaps = await adminDb.getAll(...ids.map((id) => adminDb.collection(collection).doc(id)));
  return snaps
    .filter((snap) => snap.exists)
    .map((snap) => {
      const data = snap.data() || {};
      return {
        id: snap.id,
        name: asString(data[nameField]),
        slug: asString(data.slug),
        active: active(data),
      };
    });
}

function idsOf(menu: StoreMenu, type: MenuItem['type']) {
  return [...new Set([...menu.top, ...menu.bottom].filter((item) => item.type === type).map((item) => item.refId))];
}

async function loadTargets(menu: StoreMenu): Promise<MenuTargets> {
  const [categories, landings, products] = await Promise.all([
    fetchTargets('storeCategories', idsOf(menu, 'category'), 'name', (data) => data.isActive === true),
    fetchTargets('storePages', idsOf(menu, 'landing'), 'title', (data) => data.published === true),
    fetchTargets('products', idsOf(menu, 'product'), 'name', (data) => data.isActive === true),
  ]);
  return { categories, landings, products };
}

async function fallbackView() {
  const categories = await listActiveCategories();
  const menu = fallbackStoreMenu(categories);
  const targets: MenuTargets = {
    categories: categories.map((category) => ({ ...category, active: true })),
    landings: [],
    products: [],
  };
  return { menu, targets };
}

export async function getMenuForAdmin() {
  const doc = await menuRef().get();
  if (!doc.exists) {
    const { menu, targets } = await fallbackView();
    return { ...describeMenu(menu, targets), saved: false };
  }
  try {
    const menu = sanitizeStoreMenu(doc.data() || {});
    return { ...describeMenu(menu, await loadTargets(menu)), saved: true };
  } catch (error) {
    console.error(error);
    const { menu, targets } = await fallbackView();
    return { ...describeMenu(menu, targets), saved: false };
  }
}

export async function saveStoreMenu(input: unknown) {
  const menu = sanitizeStoreMenu(input);
  const targets = await loadTargets(menu);
  for (const item of [...menu.top, ...menu.bottom]) {
    if (item.type === 'link') continue;
    const list = item.type === 'category' ? targets.categories : item.type === 'landing' ? targets.landings : targets.products;
    if (!list.some((entry) => entry.id === item.refId)) {
      const message = item.type === 'category'
        ? 'Esa categoría no existe'
        : item.type === 'landing'
          ? 'Esa landing no existe'
          : 'Ese producto no existe';
      throw new StoreError(message);
    }
  }
  await menuRef().set({ ...menu, updatedAt: new Date().toISOString() });
  return { ...describeMenu(menu, targets), saved: true };
}

export async function getPublicStoreMenu() {
  try {
    const doc = await menuRef().get();
    if (!doc.exists) {
      const { menu, targets } = await fallbackView();
      return resolveStoreMenu(menu, targets);
    }
    const menu = sanitizeStoreMenu(doc.data() || {});
    return resolveStoreMenu(menu, await loadTargets(menu));
  } catch (error) {
    console.error(error);
    return resolveStoreMenu(fallbackStoreMenu([]), emptyTargets);
  }
}

export async function getPublishedLanding(slug: string) {
  const normalized = slug.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) || normalized === 'inicio') return null;
  const snapshot = await adminDb.collection('storePages').where('slug', '==', normalized).limit(1).get();
  const doc = snapshot.docs[0];
  if (!doc) return null;
  const data = doc.data() || {};
  if (data.published !== true) return null;
  return {
    title: asString(data.title) || normalized,
    body: asString(data.body),
    seoTitle: asString(data.seoTitle),
    seoDescription: asString(data.seoDescription),
    slug: normalized,
  };
}
