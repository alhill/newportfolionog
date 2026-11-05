import { StoreError } from './errors';

export type MenuItemType = 'category' | 'landing' | 'product' | 'link';
export type MenuZone = 'top' | 'bottom';
export type MenuItemStatus = 'ok' | 'hidden' | 'missing';

export interface MenuItem {
  id: string;
  type: MenuItemType;
  refId: string;
  label: string;
  href: string;
}

export interface StoreMenu {
  top: MenuItem[];
  bottom: MenuItem[];
}

export interface MenuTarget {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

export interface MenuTargets {
  categories: MenuTarget[];
  landings: MenuTarget[];
  products: MenuTarget[];
}

export interface MenuItemView extends MenuItem {
  name: string;
  destination: string;
  status: MenuItemStatus;
}

export interface StoreMenuLink {
  label: string;
  href: string;
}

const types = new Set<MenuItemType>(['category', 'landing', 'product', 'link']);
const maxItems = 40;

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function findTarget(item: MenuItem, targets: MenuTargets) {
  const list = item.type === 'category'
    ? targets.categories
    : item.type === 'landing'
      ? targets.landings
      : item.type === 'product'
        ? targets.products
        : [];
  return list.find((entry) => entry.id === item.refId) || null;
}

export function landingHref(slug: string) {
  return slug === 'inicio' ? '/tienda' : `/tienda/pagina/${slug}`;
}

export function resolveMenuItem(item: MenuItem, targets: MenuTargets): StoreMenuLink | null {
  if (item.type === 'link') {
    if (!item.label || !item.href) return null;
    return { label: item.label, href: item.href };
  }

  const target = findTarget(item, targets);
  if (!target?.active || !target.name || !target.slug) return null;
  if (item.type === 'category') return { label: target.name, href: `/tienda?categoria=${target.slug}` };
  if (item.type === 'landing') return { label: target.name, href: landingHref(target.slug) };
  return { label: target.name, href: `/tienda/${target.slug}` };
}

export function describeMenuItem(item: MenuItem, targets: MenuTargets): MenuItemView {
  const resolved = resolveMenuItem(item, targets);
  const target = item.type === 'link' ? null : findTarget(item, targets);
  const status: MenuItemStatus = item.type === 'link'
    ? (resolved ? 'ok' : 'hidden')
    : !target
      ? 'missing'
      : resolved
        ? 'ok'
        : 'hidden';

  return {
    ...item,
    name: target?.name || item.label,
    destination: resolved?.href || '',
    status,
  };
}

export function describeMenu(menu: StoreMenu, targets: MenuTargets) {
  return {
    top: menu.top.map((item) => describeMenuItem(item, targets)),
    bottom: menu.bottom.map((item) => describeMenuItem(item, targets)),
  };
}

export function resolveStoreMenu(menu: StoreMenu, targets: MenuTargets) {
  const described = describeMenu(menu, targets);
  const links = (items: MenuItemView[]): StoreMenuLink[] => items
    .filter((item) => item.status === 'ok')
    .map((item) => ({ label: item.name, href: item.destination }));
  return { top: links(described.top), bottom: links(described.bottom) };
}

export function fallbackStoreMenu(categories: { id: string; name: string; slug: string }[]): StoreMenu {
  const sections = categories
    .filter((category) => category.id && category.name && category.slug)
    .map((category) => ({
      id: `category-${category.id}`.slice(0, 80),
      type: 'category' as const,
      refId: category.id,
      label: category.name.slice(0, 80),
      href: '',
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
    .slice(0, maxItems - 3);

  return {
    top: [
      { id: 'tienda', type: 'link', refId: '', label: 'Tienda', href: '/tienda' },
      { id: 'portfolio', type: 'link', refId: '', label: 'Portfolio', href: '/' },
      ...sections,
      { id: 'carrito', type: 'link', refId: '', label: 'Carrito', href: '/tienda/carrito' },
    ],
    bottom: [],
  };
}

function cleanHref(value: string) {
  const href = value.trim();
  if (href.startsWith('/') && !href.startsWith('//') && !/[\s\\]/.test(href)) {
    const split = href.match(/^([^?#]*)(.*)$/);
    const path = split?.[1] || '/';
    const tail = split?.[2] || '';
    const normalized = path !== '/' ? path.replace(/\/+$/, '') : '/';
    return `${normalized}${tail}`.slice(0, 300);
  }
  if (/^https?:\/\//i.test(href) && !/\s/.test(href)) return href.slice(0, 300);
  throw new StoreError('La URL tiene que ser una ruta (/tienda) o una dirección http(s)');
}

function cleanItem(value: unknown, ids: Set<string>): MenuItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new StoreError('Hay un enlace del menú que no es válido');
  }
  const raw = value as Record<string, unknown>;
  const type = asString(raw.type);
  if (!types.has(type as MenuItemType)) throw new StoreError('El tipo de enlace no es válido');
  const id = asString(raw.id);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new StoreError('Hay un enlace sin identificador válido');
  if (ids.has(id)) throw new StoreError('Hay enlaces repetidos en el menú');
  ids.add(id);

  const label = asString(raw.label).slice(0, 80);
  if (!label) throw new StoreError('El texto del enlace es obligatorio');

  if (type === 'link') {
    return { id, type: 'link', refId: '', label, href: cleanHref(asString(raw.href)) };
  }

  const refId = asString(raw.refId);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(refId)) {
    const missing = type === 'category' ? 'Elige una categoría' : type === 'landing' ? 'Elige una landing' : 'Elige un producto';
    throw new StoreError(missing);
  }
  return { id, type: type as MenuItemType, refId, label, href: '' };
}

function cleanZone(value: unknown, ids: Set<string>) {
  if (!Array.isArray(value)) throw new StoreError('El menú no es válido');
  if (value.length > maxItems) throw new StoreError(`Cada parte del menú admite hasta ${maxItems} enlaces`);
  return value.map((item) => cleanItem(item, ids));
}

export function sanitizeStoreMenu(input: unknown): StoreMenu {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new StoreError('El menú no es válido');
  }
  const raw = input as Record<string, unknown>;
  const ids = new Set<string>();
  return {
    top: cleanZone(raw.top, ids),
    bottom: cleanZone(raw.bottom, ids),
  };
}
