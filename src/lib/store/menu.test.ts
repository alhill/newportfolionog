import assert from 'node:assert/strict';
import test from 'node:test';
import { StoreError } from './errors';
import {
  describeMenuItem,
  fallbackStoreMenu,
  landingHref,
  resolveStoreMenu,
  sanitizeStoreMenu,
  type MenuTargets,
} from './menu';

const targets: MenuTargets = {
  categories: [
    { id: 'cat-prints', name: 'Prints', slug: 'prints', active: true },
    { id: 'cat-hidden', name: 'Oculta', slug: 'oculta', active: false },
  ],
  landings: [
    { id: 'page-home', name: 'Inicio', slug: 'inicio', active: true },
    { id: 'page-about', name: 'Envíos', slug: 'envios', active: true },
    { id: 'page-draft', name: 'Borrador', slug: 'borrador', active: false },
  ],
  products: [
    { id: 'prod-1', name: 'Lámina roja', slug: 'lamina-roja', active: true },
  ],
};

test('sin menú guardado se mantienen los enlaces fijos y las categorías', () => {
  const menu = fallbackStoreMenu([
    { id: 'b', name: 'Prints', slug: 'prints' },
    { id: '', name: 'Sin id', slug: 'vacio' },
    { id: 'a', name: 'Láminas', slug: 'laminas' },
    { id: 'c', name: 'Sin ruta', slug: '' },
  ]);
  const links = resolveStoreMenu(menu, {
    categories: [
      { id: 'b', name: 'Prints', slug: 'prints', active: true },
      { id: 'a', name: 'Láminas', slug: 'laminas', active: true },
    ],
    landings: [],
    products: [],
  });

  assert.deepEqual(links, {
    top: [
      { label: 'Tienda', href: '/tienda' },
      { label: 'Portfolio', href: '/' },
      { label: 'Láminas', href: '/tienda?categoria=laminas' },
      { label: 'Prints', href: '/tienda?categoria=prints' },
      { label: 'Carrito', href: '/tienda/carrito' },
    ],
    bottom: [],
  });
});

test('cada tipo de enlace resuelve su destino y omite lo oculto', () => {
  const menu = sanitizeStoreMenu({
    top: [
      { id: 'home', type: 'landing', refId: 'page-home', label: 'Portada', href: '' },
      { id: 'ships', type: 'landing', refId: 'page-about', label: 'Envíos', href: '' },
      { id: 'draft', type: 'landing', refId: 'page-draft', label: 'Borrador', href: '' },
      { id: 'gone', type: 'category', refId: 'missing', label: 'Antigua', href: '' },
    ],
    bottom: [
      { id: 'prints', type: 'category', refId: 'cat-prints', label: 'Prints', href: '' },
      { id: 'hidden', type: 'category', refId: 'cat-hidden', label: 'Oculta', href: '' },
      { id: 'poster', type: 'product', refId: 'prod-1', label: 'Lámina', href: '' },
      { id: 'mail', type: 'link', refId: '', label: 'Correo', href: 'https://example.com/hola' },
    ],
  });

  assert.equal(landingHref('inicio'), '/tienda');
  assert.equal(landingHref('envios'), '/tienda/pagina/envios');
  assert.equal(describeMenuItem(menu.top[2], targets).status, 'hidden');
  assert.equal(describeMenuItem(menu.top[3], targets).status, 'missing');
  assert.deepEqual(resolveStoreMenu(menu, targets), {
    top: [
      { label: 'Inicio', href: '/tienda' },
      { label: 'Envíos', href: '/tienda/pagina/envios' },
    ],
    bottom: [
      { label: 'Prints', href: '/tienda?categoria=prints' },
      { label: 'Lámina roja', href: '/tienda/lamina-roja' },
      { label: 'Correo', href: 'https://example.com/hola' },
    ],
  });
});

test('un enlace personalizado solo acepta rutas o http(s)', () => {
  const menu = sanitizeStoreMenu({
    top: [{ id: 'shop', type: 'link', refId: 'ignored', label: 'Tienda', href: '/tienda/' }],
    bottom: [],
  });
  assert.equal(menu.top[0].href, '/tienda');
  assert.equal(menu.top[0].refId, '');

  assert.throws(
    () => sanitizeStoreMenu({ top: [{ id: 'bad', type: 'link', label: 'X', href: 'javascript:alert(1)' }], bottom: [] }),
    StoreError,
  );
  assert.throws(
    () => sanitizeStoreMenu({ top: [{ id: 'cat', type: 'category', label: 'Prints', refId: '' }], bottom: [] }),
    StoreError,
  );
});
