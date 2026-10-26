import { adminDb } from '../../firebase-admin';
import type { Order, PacklinkShipment } from '../../../types/store';
import { centsToEuros } from '../money';
import { StoreError } from '../errors';
import { getOrder } from '../orders';
import { packlinkFetch } from './client';
import {
  buildDraft,
  mapDropoffs,
  mapService,
  packlinkContent,
  readCreatedReference,
  readLabels,
  readPackage,
  readPrice,
  type PacklinkServiceQuote,
} from './model';
import { getPacklinkCredentials } from './settings';

const orders = () => adminDb.collection('orders');

function nowIso() {
  return new Date().toISOString();
}

function requirePaidOrder(order: Order | null): Order {
  if (!order) throw new StoreError('Pedido no encontrado', 404);
  if (order.paymentStatus !== 'paid') throw new StoreError('El envío se crea cuando el cliente ha pagado');
  if (order.fulfillmentStatus === 'cancelled' || order.stockReleased) {
    throw new StoreError('Este pedido ya no se puede enviar');
  }
  return order;
}

async function credentials() {
  const stored = await getPacklinkCredentials();
  if (!stored) throw new StoreError('Packlink no está configurado. Actívalo en Packlink e indica el origen.');
  return stored;
}

function serviceQuery(fromZip: string, toZip: string, packages: ReturnType<typeof readPackage>[]) {
  const params = new URLSearchParams();
  params.set('from[country]', 'ES');
  params.set('from[zip]', fromZip);
  params.set('to[country]', 'ES');
  params.set('to[zip]', toZip);
  packages.forEach((item, index) => {
    params.set(`packages[${index}][width]`, String(item.width));
    params.set(`packages[${index}][height]`, String(item.height));
    params.set(`packages[${index}][length]`, String(item.length));
    params.set(`packages[${index}][weight]`, String(item.weight));
  });
  return params.toString();
}

async function quoteServices(apiKey: string, fromZip: string, toZip: string, packages: ReturnType<typeof readPackage>[]) {
  const body = await packlinkFetch(apiKey, `services?${serviceQuery(fromZip, toZip, packages)}`);
  const list = Array.isArray(body) ? body : [];
  const services = list.map(mapService).filter((item): item is PacklinkServiceQuote => item != null);
  await Promise.all(services.filter((service) => service.dropoff).slice(0, 6).map(async (service) => {
    try {
      const points = await packlinkFetch(apiKey, `dropoffs/${service.id}/ES/${encodeURIComponent(fromZip)}`);
      service.dropoffs = mapDropoffs(points);
    } catch {
      service.dropoffs = [];
    }
  }));
  return services;
}

export async function quoteOrderShipment(orderId: string, input: Record<string, unknown>) {
  const order = requirePaidOrder(await getOrder(orderId));
  if (order.packlink?.reference) throw new StoreError('Este pedido ya tiene un envío en Packlink');
  const { apiKey, origin } = await credentials();
  const parcel = readPackage(input.package || input.packages);
  const services = await quoteServices(apiKey, origin.postalCode, order.shippingAddress.postalCode, [parcel]);
  if (services.length === 0) throw new StoreError('Packlink no tiene servicios para este bulto y destino');
  return { package: parcel, services };
}

function fulfillmentForState(state: string, current: Order['fulfillmentStatus']) {
  const normalized = state.toLowerCase();
  if (current === 'cancelled' || current === 'returned') return current;
  if (/delivered/.test(normalized)) return 'delivered' as const;
  if (/in_transit|shipped|collected/.test(normalized)) return 'shipped' as const;
  if (current === 'pending') return 'preparing' as const;
  return current;
}

export async function refreshPacklinkShipment(orderId: string) {
  const order = await getOrder(orderId);
  if (!order) throw new StoreError('Pedido no encontrado', 404);
  if (!order.packlink?.reference) return order;
  const { apiKey } = await credentials();
  const reference = encodeURIComponent(order.packlink.reference);
  const remote = await packlinkFetch(apiKey, `shipments/${reference}`);
  let labelUrls = order.packlink.labelUrls;
  try {
    labelUrls = readLabels(await packlinkFetch(apiKey, `shipments/${reference}/labels`));
  } catch {
    labelUrls = order.packlink.labelUrls;
  }
  const price = readPrice(remote);
  const record = remote && typeof remote === 'object' ? remote as Record<string, unknown> : {};
  const state = typeof record.state === 'string' ? record.state : order.packlink.state;
  const trackingUrl = typeof record.tracking_url === 'string' ? record.tracking_url : order.packlink.trackingUrl;
  const trackings = Array.isArray(record.trackings) ? record.trackings.filter((item): item is string => typeof item === 'string') : [];
  const timestamp = nowIso();
  const packlink: PacklinkShipment = {
    ...order.packlink,
    state,
    trackingUrl,
    labelUrls: labelUrls.length > 0 ? labelUrls : order.packlink.labelUrls,
    baseCents: price.baseCents || order.packlink.baseCents,
    taxCents: price.taxCents || order.packlink.taxCents,
    totalCents: price.totalCents || order.packlink.totalCents,
    updatedAt: timestamp,
  };
  const trackingCode = trackings[0] || order.trackingCode;
  await orders().doc(order.id).update({
    packlink,
    trackingCode,
    fulfillmentStatus: fulfillmentForState(state, order.fulfillmentStatus),
    updatedAt: timestamp,
  });
  return getOrder(order.id);
}

export async function createOrderShipment(orderId: string, input: Record<string, unknown>) {
  const order = requirePaidOrder(await getOrder(orderId));
  if (order.packlink?.reference) throw new StoreError('Este pedido ya tiene un envío en Packlink');
  const { apiKey, origin } = await credentials();
  const parcel = readPackage(input.package || input.packages);
  const serviceId = Number(input.serviceId);
  if (!Number.isInteger(serviceId) || serviceId <= 0) throw new StoreError('Elige un servicio de envío');

  const services = await quoteServices(apiKey, origin.postalCode, order.shippingAddress.postalCode, [parcel]);
  const service = services.find((item) => item.id === serviceId);
  if (!service) throw new StoreError('Ese servicio ya no está disponible. Vuelve a consultar los precios');
  const dropoffPointId = typeof input.dropoffPointId === 'string' ? input.dropoffPointId.trim() : '';
  if (service.dropoffs.length > 0 && !service.dropoffs.some((point) => point.id === dropoffPointId)) {
    throw new StoreError('Elige el punto donde dejarás el paquete');
  }

  const address = order.shippingAddress;
  if (!address.firstName || !address.lastName) {
    throw new StoreError('El pedido necesita nombre y apellidos por separado');
  }
  if (!address.phone) throw new StoreError('Packlink necesita el teléfono de entrega');

  const draft = buildDraft({
    service,
    from: origin,
    to: {
      firstName: address.firstName,
      lastName: address.lastName,
      company: '',
      email: order.customerEmail,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      postalCode: address.postalCode,
      city: address.city,
      region: address.region,
    },
    packages: [parcel],
    content: packlinkContent(order.items.map((item) => item.name)),
    contentValueEuros: centsToEuros(Math.max(order.subtotal - order.discount, 0)),
    reference: order.number,
    orderId: order.id,
    dropoffPointId: dropoffPointId || undefined,
  });

  const created = await packlinkFetch(apiKey, 'shipments', { method: 'POST', body: JSON.stringify(draft) });
  const reference = readCreatedReference(created);
  if (!reference) throw new StoreError('Packlink no ha devuelto la referencia del envío', 502);

  const timestamp = nowIso();
  const packlink: PacklinkShipment = {
    reference,
    serviceId: service.id,
    serviceName: service.name,
    carrierName: service.carrierName,
    totalCents: service.totalCents,
    baseCents: service.baseCents,
    taxCents: service.taxCents,
    currency: 'EUR',
    state: 'ready_to_purchase',
    labelUrls: [],
    trackingUrl: '',
    printInStore: service.printInStore,
    dropoff: service.dropoff,
    packages: [parcel],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await orders().doc(order.id).update({
    packlink,
    carrierId: null,
    carrierName: service.carrierName,
    fulfillmentStatus: 'preparing',
    updatedAt: timestamp,
  });

  try {
    return await refreshPacklinkShipment(order.id);
  } catch {
    return getOrder(order.id);
  }
}
