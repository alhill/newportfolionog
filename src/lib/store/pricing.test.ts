import assert from 'node:assert/strict';
import test from 'node:test';
import { compareSku, mergeSorted } from './inventory-merge';
import { computeTotals, resolveSellable } from './pricing';

const simple = {
  name: 'Libro',
  price: 1500,
  hasVariants: false,
  sku: 'LIBRO',
  stock: 4,
  isActive: true,
};

test('un producto simple se vende con su propio precio y stock', () => {
  const sellable = resolveSellable(simple, null);
  assert.equal(sellable.unitPrice, 1500);
  assert.equal(sellable.stock, 4);
  assert.equal(sellable.sku, 'LIBRO');
});

test('una variante no se puede vender sobre un producto simple', () => {
  assert.throws(() => resolveSellable(simple, {
    sku: 'OTRA',
    stock: 1,
    price: 100,
    priceInherited: false,
    isActive: true,
    attributes: {},
  }));
});

test('la herencia de precio solo se aplica si la variante lo pide', () => {
  const parent = { ...simple, hasVariants: true, sku: null, stock: null, price: 2000 };
  const inherited = resolveSellable(parent, {
    sku: 'ROJO',
    stock: 2,
    price: null,
    priceInherited: true,
    isActive: true,
    attributes: { Color: 'Rojo' },
  });
  assert.equal(inherited.unitPrice, 2000);

  const own = resolveSellable(parent, {
    sku: 'AZUL',
    stock: 2,
    price: 2500,
    priceInherited: false,
    isActive: true,
    attributes: { Color: 'Azul' },
  });
  assert.equal(own.unitPrice, 2500);
  assert.throws(() => resolveSellable(parent, null));
});

test('el cupón no deja el descuento por encima del subtotal', () => {
  const totals = computeTotals({
    lines: [{ unitPrice: 1000, quantity: 1 }],
    coupon: { type: 'fixed', amount: 5000 },
    shippingCents: 300,
    taxRate: 21,
  });
  assert.equal(totals.discount, 1000);
  assert.equal(totals.tax, 63);
  assert.equal(totals.total, 363);
});

test('la página de inventario une las dos fuentes sin pasar del límite', () => {
  const left = [
    { sku: 'A', cursorId: '1' },
    { sku: 'C', cursorId: '2' },
  ];
  const right = [
    { sku: 'B', cursorId: 'products/p/variants/v' },
    { sku: 'D', cursorId: 'products/p/variants/w' },
  ];
  const page = mergeSorted(left, right, 2, compareSku);
  assert.deepEqual(page.items.map((item) => item.sku), ['A', 'B']);
  assert.equal(page.leftUsed, 1);
  assert.equal(page.rightUsed, 1);
  assert.equal(page.hasMore, true);
});
