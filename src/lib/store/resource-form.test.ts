import assert from 'node:assert/strict';
import test from 'node:test';
import { validateResourceForm } from './resource-form';

test('una categoría marca a la vez el nombre y el slug', () => {
  const errors = validateResourceForm('categories', { name: ' ', slug: '', description: '', isActive: true });
  assert.equal(errors.name, 'El nombre es obligatorio');
  assert.equal(errors.slug, 'El slug es obligatorio');
  assert.equal(errors.description, undefined);
});

test('el slug de una marca tiene que ser una ruta', () => {
  const errors = validateResourceForm('brands', { name: 'Nog', slug: 'Nog Studio', description: '', isActive: true });
  assert.equal(errors.slug, 'El slug solo puede tener minúsculas, números y guiones');
});

test('una página válida no tiene errores', () => {
  assert.deepEqual(validateResourceForm('pages', {
    title: 'Inicio',
    slug: 'inicio',
    body: '',
    seoTitle: '',
    seoDescription: '',
    published: false,
  }), {});
});

test('un banner exige título e imagen', () => {
  const errors = validateResourceForm('banners', {
    title: '',
    imageUrl: '',
    href: '',
    sortOrder: 0,
    isActive: true,
  });
  assert.equal(errors.title, 'El título es obligatorio');
  assert.equal(errors.imageUrl, 'La imagen es obligatoria');
});

test('un cupón marca el código, el valor y un porcentaje imposible', () => {
  const empty = validateResourceForm('coupons', {
    code: '',
    type: 'percent',
    amount: '',
    startsAt: '',
    endsAt: '',
    usageLimit: '',
    isActive: true,
  });
  assert.equal(empty.code, 'El código es obligatorio');
  assert.equal(empty.amount, 'El valor es obligatorio');

  const high = validateResourceForm('coupons', {
    code: 'VERANO',
    type: 'percent',
    amount: '140',
    startsAt: '',
    endsAt: '',
    usageLimit: '0',
    isActive: true,
  });
  assert.equal(high.amount, 'El porcentaje tiene que estar entre 0 y 100');
  assert.equal(high.usageLimit, 'El límite de usos no es válido');
});

test('un menú rechaza un enlace mal escrito', () => {
  const errors = validateResourceForm('menus', { name: 'Principal', itemsText: 'Tienda', isActive: true });
  assert.equal(errors.itemsText, 'Cada enlace tiene que usar el formato Texto | /ruta');
});
