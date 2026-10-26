import { StoreError } from '../errors';
import type { PacklinkPackage, PacklinkShipment } from '../../../types/store';

export interface PacklinkParty {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  region: string;
}

export interface PacklinkDropoff {
  id: string;
  name: string;
  address: string;
}

export interface PacklinkServiceQuote {
  id: number;
  name: string;
  carrierName: string;
  totalCents: number;
  baseCents: number;
  taxCents: number;
  currency: string;
  transitTime: string;
  dropoff: boolean;
  printInStore: boolean;
  labelsRequired: boolean;
  collectionDate: string;
  collectionTime: string;
  dropoffs: PacklinkDropoff[];
}

export function eurosNumberToCents(value: unknown) {
  const numeric = typeof value === 'string' ? Number(value.replace(',', '.')) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100);
}

export function packlinkContent(parts: string[]) {
  const cleaned = parts
    .join(', ')
    .replace(/[;:%&/ºª€$@#()=?¿¡!\\'`´^*Êè]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Pedido').slice(0, 60);
}

export function readPackage(input: unknown): PacklinkPackage {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new StoreError('Indica las medidas del paquete');
  }
  const raw = input as Record<string, unknown>;
  const dimension = (key: string, label: string) => {
    const numeric = Number(typeof raw[key] === 'string' ? raw[key].trim().replace(',', '.') : raw[key]);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 300) {
      throw new StoreError(`${label} tiene que ser mayor que 0 y como máximo 300 cm`);
    }
    return Math.round(numeric * 10) / 10;
  };
  const weight = Number(typeof raw.weight === 'string' ? raw.weight.trim().replace(',', '.') : raw.weight);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 70) {
    throw new StoreError('El peso tiene que ser mayor que 0 y como máximo 70 kg');
  }
  return {
    width: dimension('width', 'El ancho'),
    height: dimension('height', 'El alto'),
    length: dimension('length', 'El largo'),
    weight: Math.round(weight * 1000) / 1000,
  };
}

export function shipmentStateLabel(state: string) {
  const labels: Record<string, string> = {
    pending: 'Pendiente de pago',
    ready_to_purchase: 'Listo para pagar',
    awaiting_completion: 'Borrador incompleto',
    ready_for_shipping: 'Pagado, listo para enviar',
    ready_to_ship: 'Pagado, listo para enviar',
    in_transit: 'En tránsito',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  };
  return labels[state.toLowerCase()] || state || 'Creado';
}

export function shipmentBlocksRefund(shipment: Pick<PacklinkShipment, 'labelUrls' | 'state'> | null) {
  if (!shipment) return false;
  if (shipment.labelUrls.length > 0) return true;
  return /ready_for_shipping|ready_to_ship|in_transit|delivered|shipped/i.test(shipment.state);
}

export function readPrice(raw: unknown) {
  if (!raw || typeof raw !== 'object') return { baseCents: 0, taxCents: 0, totalCents: 0 };
  const price = (raw as { price?: unknown }).price;
  if (typeof price === 'number' || typeof price === 'string') {
    const cents = eurosNumberToCents(price);
    return { baseCents: cents, taxCents: 0, totalCents: cents };
  }
  if (!price || typeof price !== 'object') return { baseCents: 0, taxCents: 0, totalCents: 0 };
  const record = price as Record<string, unknown>;
  const baseCents = eurosNumberToCents(record.base_price);
  const taxCents = eurosNumberToCents(record.tax_price);
  const totalCents = record.total_price == null ? baseCents + taxCents : eurosNumberToCents(record.total_price);
  return { baseCents, taxCents, totalCents };
}

export function readLabels(body: unknown) {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { labels?: unknown }).labels)
      ? (body as { labels: unknown[] }).labels
      : [];
  return list
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      const record = item as Record<string, unknown>;
      return typeof record.url === 'string' ? record.url : typeof record.link === 'string' ? record.link : '';
    })
    .filter((url) => /^https?:\/\//i.test(url));
}

export function mapDropoffs(body: unknown): PacklinkDropoff[] {
  const list = Array.isArray(body) ? body : [];
  return list.slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const id = record.id ?? record.dropoff_point_id ?? record.code;
    if (id == null || String(id).trim() === '') return [];
    const name = String(record.name || record.commerce_name || record.company || 'Punto de entrega');
    const address = [record.address, record.street1, record.zip || record.zip_code, record.city]
      .filter((part) => typeof part === 'string' && part.trim())
      .join(', ');
    return [{ id: String(id), name, address }];
  });
}

function collectionSlot(raw: unknown) {
  if (!raw || typeof raw !== 'object') return { collectionDate: '', collectionTime: '' };
  const dates = raw as Record<string, unknown>;
  const available = dates.available_dates;
  if (!available || typeof available !== 'object') return { collectionDate: '', collectionTime: '' };
  const [firstDate, slot] = Object.entries(available as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))[0] || [];
  if (!firstDate) return { collectionDate: '', collectionTime: '' };
  const window = slot && typeof slot === 'object' ? slot as Record<string, unknown> : {};
  const from = typeof window.from === 'string' ? window.from : '';
  const to = typeof window.to === 'string' ? window.to : typeof window.till === 'string' ? window.till : '';
  return {
    collectionDate: firstDate.replace(/\//g, '-'),
    collectionTime: from && to ? `${from}-${to}` : '',
  };
}

export function mapService(raw: unknown): PacklinkServiceQuote | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const id = Number(record.id ?? record.service_id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const price = readPrice({ price: record.price });
  const baseCents = price.baseCents || eurosNumberToCents(record.base_price);
  const totalCents = price.totalCents || baseCents;
  const slot = collectionSlot(record);
  return {
    id,
    name: String(record.name || record.service_name || 'Servicio'),
    carrierName: String(record.carrier_name || record.carrier || ''),
    totalCents,
    baseCents,
    taxCents: price.taxCents,
    currency: String(record.currency || (record.price && typeof record.price === 'object' ? (record.price as { currency?: string }).currency : '') || 'EUR'),
    transitTime: String(record.transit_time || record.transit_hours || ''),
    dropoff: record.dropoff === true,
    printInStore: record.has_print_in_store === true,
    labelsRequired: record.labels_required !== false,
    collectionDate: slot.collectionDate,
    collectionTime: slot.collectionTime,
    dropoffs: [],
  };
}

export function buildDraft(input: {
  service: PacklinkServiceQuote;
  from: PacklinkParty;
  to: PacklinkParty;
  packages: PacklinkPackage[];
  content: string;
  contentValueEuros: number;
  reference: string;
  orderId: string;
  dropoffPointId?: string;
}) {
  const party = (person: PacklinkParty) => ({
    name: person.firstName,
    surname: person.lastName,
    company: person.company,
    street1: person.line1,
    street2: person.line2,
    zip_code: person.postalCode,
    city: person.city,
    state: person.region,
    country: 'ES',
    phone: person.phone,
    email: person.email,
  });

  const draft: Record<string, unknown> = {
    service_id: input.service.id,
    service: input.service.name,
    carrier: input.service.carrierName,
    content: input.content,
    contentvalue: input.contentValueEuros,
    contentValue_currency: 'EUR',
    shipment_custom_reference: input.reference,
    from: party(input.from),
    to: party(input.to),
    packages: input.packages.map((item) => ({
      width: item.width,
      height: item.height,
      length: item.length,
      weight: item.weight,
    })),
    additional_data: { order_id: input.orderId },
  };

  if (input.dropoffPointId) {
    draft.dropoff_point_id = input.dropoffPointId;
  } else if (input.service.collectionDate) {
    draft.collection_date = input.service.collectionDate;
    if (input.service.collectionTime) draft.collection_time = input.service.collectionTime;
  }

  return draft;
}

export function mapStoredPacklink(raw: unknown): PacklinkShipment | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.reference !== 'string' || !data.reference.trim()) return null;
  const packages = Array.isArray(data.packages)
    ? data.packages.flatMap((item) => {
      try {
        return [readPackage(item)];
      } catch {
        return [];
      }
    })
    : [];
  return {
    reference: data.reference,
    serviceId: Number(data.serviceId) || 0,
    serviceName: typeof data.serviceName === 'string' ? data.serviceName : '',
    carrierName: typeof data.carrierName === 'string' ? data.carrierName : '',
    totalCents: Number(data.totalCents) || 0,
    baseCents: Number(data.baseCents) || 0,
    taxCents: Number(data.taxCents) || 0,
    currency: 'EUR',
    state: typeof data.state === 'string' ? data.state : '',
    labelUrls: Array.isArray(data.labelUrls) ? data.labelUrls.filter((item): item is string => typeof item === 'string') : [],
    trackingUrl: typeof data.trackingUrl === 'string' ? data.trackingUrl : '',
    printInStore: data.printInStore === true,
    dropoff: data.dropoff === true,
    packages,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

export function readCreatedReference(body: unknown) {
  if (typeof body === 'string' && body.trim()) return body.trim();
  if (!body || typeof body !== 'object') return '';
  const record = body as Record<string, unknown>;
  const reference = record.reference || record.shipment_reference || record.packlink_reference;
  return typeof reference === 'string' ? reference.trim() : '';
}
