import assert from 'node:assert/strict';
import test from 'node:test';
import { arrangeCatalog, resolveGroupJoin } from './groups';

test('agrupa los productos del mismo modelo y deja sueltos los demás', () => {
  const blocks = arrangeCatalog([
    { id: 'negro', name: 'Negro', groupId: 'g1' },
    { id: 'blanco', name: 'Blanco', groupId: null },
    { id: 'azul', name: 'Azul', groupId: 'g1' },
    { id: 'rojo', name: 'Rojo', groupId: 'g2' },
  ]);

  assert.deepEqual(blocks.map((block) => (
    block.kind === 'group' ? block.products.map((item) => item.id) : block.product.id
  )), [
    ['azul', 'negro'],
    'blanco',
    'rojo',
  ]);
});

test('al enlazar, el producto editado conserva su modelo si ya tiene uno', () => {
  const created = resolveGroupJoin('', '', () => 'nuevo');
  assert.deepEqual(created, { groupId: 'nuevo', updatePicked: true, updateCurrent: true, already: false });

  const adopt = resolveGroupJoin('', 'del-otro', () => 'nuevo');
  assert.equal(adopt.groupId, 'del-otro');
  assert.equal(adopt.updateCurrent, true);
  assert.equal(adopt.updatePicked, false);

  const keep = resolveGroupJoin('actual', 'otro', () => 'nuevo');
  assert.equal(keep.groupId, 'actual');
  assert.equal(keep.updatePicked, true);
  assert.equal(keep.updateCurrent, false);

  const same = resolveGroupJoin('actual', 'actual', () => 'nuevo');
  assert.equal(same.already, true);
  assert.equal(same.updatePicked, false);
});
