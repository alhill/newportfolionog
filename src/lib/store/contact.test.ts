import assert from 'node:assert/strict';
import test from 'node:test';
import { isSpanishPostalCode, joinPersonName, normalizeCountryCode, splitLegacyName } from './contact';

test('nombre y apellidos se guardan separados y se muestran juntos', () => {
  assert.equal(joinPersonName('Ana', 'García López'), 'Ana García López');
  assert.deepEqual(splitLegacyName('Ana García López'), { firstName: 'Ana', lastName: 'García López' });
});

test('solo se acepta España como país de entrega', () => {
  assert.equal(normalizeCountryCode(''), 'ES');
  assert.equal(normalizeCountryCode('España'), 'ES');
  assert.equal(normalizeCountryCode('spain'), 'ES');
  assert.equal(normalizeCountryCode('FR'), 'FR');
});

test('el código postal tiene que ser de una provincia española', () => {
  assert.equal(isSpanishPostalCode('28013'), true);
  assert.equal(isSpanishPostalCode('35001'), true);
  assert.equal(isSpanishPostalCode('52001'), true);
  assert.equal(isSpanishPostalCode('53000'), false);
  assert.equal(isSpanishPostalCode('2801'), false);
});
