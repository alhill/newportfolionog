import assert from 'node:assert/strict';
import test from 'node:test';
import { storeMenuLinks } from './nav';

test('el menú de la tienda lista sus secciones y el enlace al portfolio', () => {
  const links = storeMenuLinks([
    { name: 'Prints', slug: 'prints' },
    { name: '', slug: 'vacio' },
    { name: 'Láminas', slug: 'laminas' },
    { name: 'Sin ruta' },
  ]);

  assert.deepEqual(links, [
    { label: 'Tienda', href: '/tienda' },
    { label: 'Portfolio', href: '/' },
    { label: 'Láminas', href: '/tienda?categoria=laminas' },
    { label: 'Prints', href: '/tienda?categoria=prints' },
    { label: 'Carrito', href: '/tienda/carrito' },
  ]);
});
