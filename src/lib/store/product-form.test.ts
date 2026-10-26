import assert from 'node:assert/strict';
import test from 'node:test';
import { nextNogSku } from './identifiers';
import { validateProductForm } from './product-form';

const validSimple = {
  name: 'Mesa',
  slug: 'mesa',
  priceEuros: '12.5',
  hasVariants: false,
  sku: 'NOG1',
  stock: 3,
  variants: [],
};

test('marca a la vez los campos obligatorios de un producto simple', () => {
  const errors = validateProductForm({
    name: ' ',
    slug: '',
    priceEuros: '',
    hasVariants: false,
    sku: '',
    stock: '',
    variants: [],
  });

  assert.equal(errors.name, 'El nombre es obligatorio');
  assert.equal(errors.slug, 'El slug es obligatorio');
  assert.equal(errors.priceEuros, 'El precio es obligatorio');
  assert.equal(errors.sku, 'El SKU es obligatorio');
  assert.equal(errors.stock, 'El stock es obligatorio');
});

test('un producto simple completo no tiene errores', () => {
  assert.deepEqual(validateProductForm(validSimple), {});
});

test('el slug tiene que ser una ruta en minúsculas', () => {
  const errors = validateProductForm({ ...validSimple, slug: 'Mesa roja' });
  assert.equal(errors.slug, 'El slug solo puede tener minúsculas, números y guiones');
});

test('con variantes el sku y el precio propio se marcan en cada una', () => {
  const errors = validateProductForm({
    ...validSimple,
    hasVariants: true,
    sku: '',
    stock: '',
    variants: [
      { sku: '', stock: '', priceInherited: false, priceEuros: '' },
      { sku: 'NOG1', stock: 1, priceInherited: true, priceEuros: '' },
      { sku: 'nog1', stock: 2, priceInherited: false, priceEuros: '8' },
    ],
  });

  assert.equal(errors.sku, undefined);
  assert.equal(errors['variants.0.sku'], 'El SKU es obligatorio');
  assert.equal(errors['variants.0.stock'], 'El stock es obligatorio');
  assert.equal(errors['variants.0.priceEuros'], 'El precio es obligatorio');
  assert.equal(errors['variants.1.priceEuros'], undefined);
  assert.equal(errors['variants.1.sku'], 'Este SKU está repetido');
  assert.equal(errors['variants.2.sku'], 'Este SKU está repetido');
});

test('el sku generado usa el primer índice NOG libre', () => {
  assert.equal(nextNogSku([]), 'NOG1');
  assert.equal(nextNogSku(['NOG1', 'nog2', 'OTRO']), 'NOG3');
  assert.equal(nextNogSku(['NOG1', 'NOG3']), 'NOG2');
});
