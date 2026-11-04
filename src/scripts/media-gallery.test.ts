import assert from 'node:assert/strict';
import test from 'node:test';
import { imageAlt, imageSrc, stepIndex } from './media-gallery.js';

test('la galería es circular en ambos sentidos', () => {
  assert.equal(stepIndex(0, -1, 4), 3);
  assert.equal(stepIndex(3, 1, 4), 0);
  assert.equal(stepIndex(1, 1, 4), 2);
  assert.equal(stepIndex(0, 0, 0), 0);
});

test('acepta urls sueltas y objetos con texto alternativo', () => {
  assert.equal(imageSrc('https://cdn.example/a.jpg'), 'https://cdn.example/a.jpg');
  assert.equal(imageSrc({ url: 'https://cdn.example/b.jpg', alt: 'Frente' }), 'https://cdn.example/b.jpg');
  assert.equal(imageAlt('https://cdn.example/a.jpg'), '');
  assert.equal(imageAlt({ url: 'https://cdn.example/b.jpg', alt: 'Frente' }), 'Frente');
});
