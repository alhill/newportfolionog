import assert from 'node:assert/strict';
import test from 'node:test';
import { StoreError } from '../errors';
import {
  buildDraft,
  eurosNumberToCents,
  mapService,
  packlinkContent,
  readPackage,
  readPrice,
  shipmentBlocksRefund,
} from './model';

test('la cotización guarda el total que queda pendiente de pago', () => {
  const service = mapService({
    id: 20,
    name: 'Punto Pack',
    carrier_name: 'InPost',
    dropoff: true,
    has_print_in_store: true,
    price: { base_price: 4.1, tax_price: 0.86, total_price: 4.96, currency: 'EUR' },
  });
  assert.equal(service?.totalCents, 496);
  assert.equal(service?.baseCents, 410);
  assert.equal(service?.taxCents, 86);
  assert.equal(service?.printInStore, true);
  assert.equal(eurosNumberToCents('4,96'), 496);
  assert.deepEqual(readPrice({ price: { base_price: 4.1 } }), { baseCents: 410, taxCents: 0, totalCents: 410 });
});

test('el borrador separa nombre y apellidos y lleva el precio del servicio elegido', () => {
  const service = mapService({ id: 9, name: 'Clásico', carrier_name: 'SEUR', price: { total_price: 6.5, base_price: 6.5, tax_price: 0 } });
  assert.ok(service);
  const draft = buildDraft({
    service,
    from: {
      firstName: 'Nog', lastName: 'Studio', company: '', email: 'a@b.c', phone: '600', line1: 'Calle 1', line2: '', postalCode: '28001', city: 'Madrid', region: 'Madrid',
    },
    to: {
      firstName: 'Ana', lastName: 'García', company: '', email: 'ana@b.c', phone: '611', line1: 'Calle 2', line2: '', postalCode: '08001', city: 'Barcelona', region: 'Barcelona',
    },
    packages: [{ width: 20, height: 10, length: 30, weight: 1 }],
    content: packlinkContent(['Lámina #1']),
    contentValueEuros: 18,
    reference: 'TN-1',
    orderId: 'abc',
  });
  assert.equal((draft.to as { name: string }).name, 'Ana');
  assert.equal((draft.to as { surname: string }).surname, 'García');
  assert.equal(draft.service_id, 9);
  assert.equal(draft.content, 'Lámina 1');
});

test('un paquete sin peso no se cotiza', () => {
  assert.throws(() => readPackage({ width: 10, height: 10, length: 10, weight: 0 }), StoreError);
});

test('un envío ya etiquetado no se puede reembolsar desde la tienda', () => {
  assert.equal(shipmentBlocksRefund({ labelUrls: ['https://labels.example/a.pdf'], state: 'pending' }), true);
  assert.equal(shipmentBlocksRefund({ labelUrls: [], state: 'ready_to_purchase' }), false);
});
