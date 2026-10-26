import { randomUUID } from 'node:crypto';
import { adminDb } from '../firebase-admin';
import type {
  CheckoutInput,
  Order,
  OrderLineSnapshot,
  OrderRecord,
  PaymentStatus,
  FulfillmentStatus,
  PostalAddress,
  ReturnStatus,
  StockRestoreSkip,
} from '../../types/store';
import { isSpanishPostalCode, joinPersonName, normalizeCountryCode, splitLegacyName } from './contact';
import { StoreError } from './errors';
import { mapStoredPacklink } from './packlink/model';
import { computeTotals, resolveSellable } from './pricing';
import { mapProduct, mapVariant } from './products';
import { getStoreSettings } from './settings';

const orders = () => adminDb.collection('orders');
const coupons = () => adminDb.collection('storeCoupons');

function nowIso() {
  return new Date().toISOString();
}

function asString(value: unknown, max = 180) {
  return (typeof value === 'string' ? value.trim() : '').slice(0, max);
}

function customerIdFromEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.includes('/')) {
    throw new StoreError('El email no es válido');
  }
  return normalized;
}

function readAddress(
  input: CheckoutInput['address'],
  firstName: string,
  lastName: string,
  phone: string,
  requireSpain: boolean,
): PostalAddress {
  const country = normalizeCountryCode(input?.country);
  const address: PostalAddress = {
    firstName,
    lastName,
    fullName: joinPersonName(firstName, lastName),
    line1: asString(input?.line1, 180),
    line2: asString(input?.line2, 180),
    postalCode: asString(input?.postalCode, 20),
    city: asString(input?.city, 80),
    region: asString(input?.region, 80),
    country,
    phone,
  };
  if (!address.line1 || !address.postalCode || !address.city) {
    throw new StoreError('La dirección necesita calle, código postal y ciudad');
  }
  if (requireSpain && country !== 'ES') throw new StoreError('De momento solo enviamos a España');
  if (requireSpain && !isSpanishPostalCode(address.postalCode)) {
    throw new StoreError('El código postal tiene que ser de España');
  }
  return address;
}

function mapAddress(raw: unknown): PostalAddress {
  const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const storedFirst = asString(data.firstName, 80);
  const storedLast = asString(data.lastName, 80);
  const legacy = asString(data.fullName, 160);
  const parts = storedFirst || storedLast ? { firstName: storedFirst, lastName: storedLast } : splitLegacyName(legacy);
  return {
    firstName: parts.firstName,
    lastName: parts.lastName,
    fullName: joinPersonName(parts.firstName, parts.lastName) || legacy,
    line1: asString(data.line1, 180),
    line2: asString(data.line2, 180),
    postalCode: asString(data.postalCode, 20),
    city: asString(data.city, 80),
    region: asString(data.region, 80),
    country: asString(data.country, 80) || 'ES',
    phone: asString(data.phone, 40),
  };
}

interface NormalizedCheckout {
  idempotencyKey: string;
  email: string;
  customerId: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: PostalAddress;
  carrierId: string | null;
  couponCode: string | null;
  customerNote: string;
  company: string;
  items: { productId: string; variantId: string | null; quantity: number }[];
}

function normalizeCheckout(input: CheckoutInput, requireContact = true): NormalizedCheckout {
  const firstName = asString(input.firstName, 80);
  const lastName = asString(input.lastName, 80);
  const phone = asString(input.phone, 40);
  if (requireContact && !firstName) throw new StoreError('El nombre es obligatorio');
  if (requireContact && !lastName) throw new StoreError('Los apellidos son obligatorios');
  if (requireContact && !phone) throw new StoreError('El teléfono es obligatorio');

  const key = asString(input.idempotencyKey, 80);
  if (requireContact && !/^[A-Za-z0-9_-]{8,80}$/.test(key)) {
    throw new StoreError('La clave de la operación no es válida');
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new StoreError('El carrito está vacío');
  }
  if (input.items.length > 30) throw new StoreError('El pedido tiene demasiadas líneas');

  const merged = new Map<string, { productId: string; variantId: string | null; quantity: number }>();
  for (const item of input.items) {
    const productId = asString(item?.productId, 120);
    const variantId = asString(item?.variantId, 120) || null;
    const quantity = Number(item?.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new StoreError('Hay una línea del carrito que no es válida');
    }
    const mapKey = `${productId}:${variantId || ''}`;
    const nextQuantity = (merged.get(mapKey)?.quantity || 0) + quantity;
    if (nextQuantity > 99) throw new StoreError('La cantidad máxima por producto es 99');
    merged.set(mapKey, { productId, variantId, quantity: nextQuantity });
  }

  const email = asString(input.email, 180);
  const customerId = (email || requireContact) ? customerIdFromEmail(email) : 'quote';
  const address = requireContact
    ? readAddress(input.address || {}, firstName, lastName, phone, true)
    : {
      firstName,
      lastName,
      fullName: joinPersonName(firstName, lastName),
      line1: asString(input.address?.line1, 180),
      line2: asString(input.address?.line2, 180),
      postalCode: asString(input.address?.postalCode, 20),
      city: asString(input.address?.city, 80),
      region: asString(input.address?.region, 80),
      country: 'ES',
      phone,
    };

  return {
    idempotencyKey: key || 'quote',
    email: customerId === 'quote' ? '' : customerId,
    customerId,
    firstName,
    lastName,
    phone,
    address,
    carrierId: null,
    couponCode: asString(input.couponCode, 40).toUpperCase() || null,
    customerNote: asString(input.customerNote, 1000),
    company: asString(input.company, 80),
    items: [...merged.values()],
  };
}

export function mapOrder(id: string, data: FirebaseFirestore.DocumentData): Order {
  const shippingAddress = mapAddress(data.shippingAddress);
  return {
    id,
    number: String(data.number || id.slice(0, 8).toUpperCase()),
    idempotencyKey: String(data.idempotencyKey || ''),
    publicToken: String(data.publicToken || ''),
    paymentStatus: data.paymentStatus || 'pending',
    fulfillmentStatus: data.fulfillmentStatus || 'pending',
    returnStatus: data.returnStatus || 'none',
    items: Array.isArray(data.items) ? data.items : [],
    currency: 'EUR',
    subtotal: data.subtotal || 0,
    discount: data.discount || 0,
    shipping: data.shipping || 0,
    tax: data.tax || 0,
    taxRate: data.taxRate || 0,
    total: data.total || 0,
    couponCode: data.couponCode || null,
    carrierId: data.carrierId || null,
    carrierName: data.carrierName || null,
    trackingCode: data.trackingCode || '',
    customerId: data.customerId || '',
    customerEmail: data.customerEmail || '',
    customerName: data.customerName || shippingAddress.fullName,
    shippingAddress,
    packlink: mapStoredPacklink(data.packlink),
    paymentProvider: typeof data.paymentProvider === 'string' ? data.paymentProvider : null,
    paymentCheckoutId: typeof data.paymentCheckoutId === 'string' ? data.paymentCheckoutId : null,
    paymentUrl: typeof data.paymentUrl === 'string' ? data.paymentUrl : null,
    paidAt: typeof data.paidAt === 'string' ? data.paidAt : null,
    customerNote: data.customerNote || '',
    adminNote: data.adminNote || '',
    stockCommitted: data.stockCommitted === true,
    stockReleased: data.stockReleased === true,
    stockRestoreSkipped: Array.isArray(data.stockRestoreSkipped) ? data.stockRestoreSkipped : [],
    createdAt: data.createdAt || '',
    updatedAt: data.updatedAt || '',
  };
}

function couponActive(data: FirebaseFirestore.DocumentData, today: string) {
  if (data.isActive === false) return false;
  if (typeof data.startsAt === 'string' && data.startsAt && today < data.startsAt) return false;
  if (typeof data.endsAt === 'string' && data.endsAt && today > data.endsAt) return false;
  if (typeof data.usageLimit === 'number' && typeof data.usageCount === 'number' && data.usageCount >= data.usageLimit) {
    return false;
  }
  return data.type === 'percent' || data.type === 'fixed';
}

async function findCouponRef(code: string | null) {
  if (!code) return null;
  const snapshot = await coupons().where('code', '==', code).limit(1).get();
  if (snapshot.empty) throw new StoreError('El cupón no existe');
  return snapshot.docs[0].ref;
}

interface PricedCheckout {
  lines: OrderLineSnapshot[];
  totals: ReturnType<typeof computeTotals>;
  couponCode: string | null;
}

function priceLoaded(input: {
  checkout: NormalizedCheckout;
  products: Map<string, ReturnType<typeof mapProduct>>;
  variants: Map<string, ReturnType<typeof mapVariant>>;
  settings: { taxRate: number; shippingFlatRate: number };
  coupon: FirebaseFirestore.DocumentData | null;
  today: string;
}): PricedCheckout {
  if (input.checkout.couponCode && (!input.coupon || !couponActive(input.coupon, input.today))) {
    throw new StoreError('El cupón no se puede aplicar');
  }

  const lines: OrderLineSnapshot[] = input.checkout.items.map((item) => {
    const product = input.products.get(item.productId);
    if (!product) throw new StoreError('Un producto del carrito ya no existe');
    const variant = item.variantId ? input.variants.get(`${item.productId}:${item.variantId}`) || null : null;
    if (item.variantId && !variant) throw new StoreError('Una variante del carrito ya no existe');
    const sellable = resolveSellable(product, variant);
    if (!sellable.isActive) throw new StoreError(`${product.name} no está disponible`);
    if (sellable.stock < item.quantity) {
      throw new StoreError(`No hay stock suficiente de ${sellable.sku}`);
    }
    return {
      productId: product.id,
      variantId: variant?.id || null,
      sku: sellable.sku,
      name: product.name,
      attributes: sellable.attributes,
      unitPrice: sellable.unitPrice,
      quantity: item.quantity,
      lineTotal: sellable.unitPrice * item.quantity,
    };
  });

  const shipping = input.settings.shippingFlatRate;

  return {
    lines,
    totals: computeTotals({
      lines,
      coupon: input.coupon
        ? { type: input.coupon.type, amount: input.coupon.amount }
        : null,
      shippingCents: shipping,
      taxRate: input.settings.taxRate,
    }),
    couponCode: input.coupon ? String(input.coupon.code) : null,
  };
}

async function loadOutside(checkout: NormalizedCheckout) {
  const [settings, couponRef] = await Promise.all([
    getStoreSettings(),
    findCouponRef(checkout.couponCode),
  ]);
  return { settings, couponRef };
}

export async function quoteCheckout(input: CheckoutInput) {
  const checkout = normalizeCheckout(input, false);
  const { settings, couponRef } = await loadOutside(checkout);
  const productSnaps = await adminDb.getAll(...checkout.items.map((item) => adminDb.collection('products').doc(item.productId)));
  const products = new Map(productSnaps.filter((snap) => snap.exists).map((snap) => [snap.id, mapProduct(snap.id, snap.data() || {})]));
  const variantSnaps = await Promise.all(checkout.items.map(async (item) => {
    if (!item.variantId) return null;
    const snap = await adminDb.collection('products').doc(item.productId).collection('variants').doc(item.variantId).get();
    return snap.exists ? mapVariant(snap.id, item.productId, snap.data() || {}) : null;
  }));
  const variants = new Map<string, ReturnType<typeof mapVariant>>();
  checkout.items.forEach((item, index) => {
    const variant = variantSnaps[index];
    if (variant && item.variantId) variants.set(`${item.productId}:${item.variantId}`, variant);
  });
  const coupon = couponRef ? (await couponRef.get()).data() || null : null;
  const priced = priceLoaded({
    checkout,
    products,
    variants,
    settings,
    coupon,
    today: nowIso().slice(0, 10),
  });

  return {
    items: priced.lines,
    ...priced.totals,
    currency: 'EUR' as const,
    couponCode: priced.couponCode,
  };
}

export async function commitCheckout(input: CheckoutInput, options: { origin: string }) {
  const checkout = normalizeCheckout(input);
  if (checkout.company) throw new StoreError('No se ha podido crear el pedido');

  const { attachPaymentSession, isPaymentsReady } = await import('./payments');
  if (!(await isPaymentsReady())) {
    throw new StoreError('Forma de pago no configurada. Activa SumUp en Formas de pago.');
  }

  const opRef = adminDb.collection('stockOperations').doc(checkout.idempotencyKey);
  const orderRef = orders().doc();
  const { settings, couponRef } = await loadOutside(checkout);
  const customerRef = adminDb.collection('customers').doc(checkout.customerId);
  let orderId = orderRef.id;

  await adminDb.runTransaction(async (tx) => {
    const operation = await tx.get(opRef);
    if (operation.exists) {
      orderId = String(operation.get('orderId') || '');
      return;
    }

    const productRefs = checkout.items.map((item) => adminDb.collection('products').doc(item.productId));
    const variantRefs = checkout.items.map((item) => (
      item.variantId
        ? adminDb.collection('products').doc(item.productId).collection('variants').doc(item.variantId)
        : null
    ));
    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));
    const variantSnaps = await Promise.all(variantRefs.map((ref) => (ref ? tx.get(ref) : Promise.resolve(null))));
    const settingsSnap = await tx.get(adminDb.collection('storeSettings').doc('config'));
    const couponSnap = couponRef ? await tx.get(couponRef) : null;
    const customerSnap = await tx.get(customerRef);

    const liveSettings = settingsSnap.exists ? { ...settings, ...settingsSnap.data() } : settings;
    const products = new Map(productSnaps.filter((snap) => snap.exists).map((snap) => [snap.id, mapProduct(snap.id, snap.data() || {})]));
    const variants = new Map<string, ReturnType<typeof mapVariant>>();
    checkout.items.forEach((item, index) => {
      const snap = variantSnaps[index];
      if (snap?.exists && item.variantId) {
        variants.set(`${item.productId}:${item.variantId}`, mapVariant(snap.id, item.productId, snap.data() || {}));
      }
    });

    const priced = priceLoaded({
      checkout,
      products,
      variants,
      settings: {
        taxRate: typeof liveSettings.taxRate === 'number' ? liveSettings.taxRate : settings.taxRate,
        shippingFlatRate: typeof liveSettings.shippingFlatRate === 'number' ? liveSettings.shippingFlatRate : settings.shippingFlatRate,
      },
      coupon: couponSnap?.exists ? couponSnap.data() || null : null,
      today: nowIso().slice(0, 10),
    });

    const timestamp = nowIso();
    checkout.items.forEach((item, index) => {
      const productSnap = productSnaps[index];
      const product = products.get(item.productId);
      if (!productSnap.exists || !product) throw new StoreError('Un producto del carrito ya no existe');
      if (item.variantId) {
        const variantSnap = variantSnaps[index];
        if (!variantSnap?.exists) throw new StoreError('Una variante del carrito ya no existe');
        const next = Number(variantSnap.get('stock')) - item.quantity;
        tx.update(variantSnap.ref, { stock: next, updatedAt: timestamp });
      } else {
        const next = Number(productSnap.get('stock')) - item.quantity;
        tx.update(productSnap.ref, { stock: next, updatedAt: timestamp });
      }
    });

    if (couponSnap?.exists && couponRef) {
      tx.update(couponRef, { usageCount: Number(couponSnap.get('usageCount') || 0) + 1, updatedAt: timestamp });
    }

    const previousAddresses = customerSnap.exists && Array.isArray(customerSnap.get('addresses'))
      ? customerSnap.get('addresses') as PostalAddress[]
      : [];
    const sameAddress = previousAddresses.some((address) => (
      address.line1 === checkout.address.line1
      && address.postalCode === checkout.address.postalCode
      && address.city === checkout.address.city
    ));
    const customerName = joinPersonName(checkout.firstName, checkout.lastName);
    tx.set(customerRef, {
      email: checkout.email,
      firstName: checkout.firstName,
      lastName: checkout.lastName,
      name: customerName,
      phone: checkout.phone || (customerSnap.exists ? customerSnap.get('phone') || '' : ''),
      addresses: sameAddress ? previousAddresses : [checkout.address, ...previousAddresses].slice(0, 8),
      adminNote: customerSnap.exists ? customerSnap.get('adminNote') || '' : '',
      createdAt: customerSnap.exists ? customerSnap.get('createdAt') || timestamp : timestamp,
      updatedAt: timestamp,
    });

    const order: OrderRecord = {
      number: `TN-${orderRef.id.slice(0, 8).toUpperCase()}`,
      idempotencyKey: checkout.idempotencyKey,
      publicToken: randomUUID(),
      paymentStatus: 'pending',
      fulfillmentStatus: 'pending',
      returnStatus: 'none',
      items: priced.lines,
      currency: 'EUR',
      subtotal: priced.totals.subtotal,
      discount: priced.totals.discount,
      shipping: priced.totals.shipping,
      tax: priced.totals.tax,
      taxRate: priced.totals.taxRate,
      total: priced.totals.total,
      couponCode: priced.couponCode,
      carrierId: null,
      carrierName: null,
      trackingCode: '',
      customerId: checkout.customerId,
      customerEmail: checkout.email,
      customerName,
      shippingAddress: checkout.address,
      packlink: null,
      paymentProvider: null,
      paymentCheckoutId: null,
      paymentUrl: null,
      paidAt: null,
      customerNote: checkout.customerNote,
      adminNote: '',
      stockCommitted: true,
      stockReleased: false,
      stockRestoreSkipped: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    tx.set(orderRef, order);
    tx.set(opRef, {
      orderId: orderRef.id,
      status: 'committed',
      createdAt: timestamp,
    });
  });

  const saved = await orders().doc(orderId).get();
  if (!saved.exists) throw new StoreError('No se ha podido recuperar el pedido', 500);
  const order = mapOrder(saved.id, saved.data() || {});
  if (order.paymentUrl && order.paymentCheckoutId) return order;
  return attachPaymentSession(order, options.origin);
}

export async function listOrders(limit = 50) {
  const snapshot = await orders().orderBy('createdAt', 'desc').limit(Math.min(limit, 100)).get();
  return snapshot.docs.map((doc) => mapOrder(doc.id, doc.data()));
}

export async function getOrder(id: string) {
  const doc = await orders().doc(id).get();
  if (!doc.exists) return null;
  return mapOrder(doc.id, doc.data() || {});
}

export async function getOrderByPublicToken(token: string) {
  const snapshot = await orders().where('publicToken', '==', token).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return mapOrder(doc.id, doc.data());
}

async function restoreStock(tx: FirebaseFirestore.Transaction, order: Order) {
  const skips: StockRestoreSkip[] = [];
  if (!order.stockCommitted || order.stockReleased) return skips;

  const productRefs = order.items.map((item) => adminDb.collection('products').doc(item.productId));
  const variantRefs = order.items.map((item) => (
    item.variantId ? adminDb.collection('products').doc(item.productId).collection('variants').doc(item.variantId) : null
  ));
  const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));
  const variantSnaps = await Promise.all(variantRefs.map((ref) => (ref ? tx.get(ref) : Promise.resolve(null))));
  const timestamp = nowIso();

  order.items.forEach((item, index) => {
    const productSnap = productSnaps[index];
    if (!productSnap.exists) {
      skips.push({ sku: item.sku, quantity: item.quantity, reason: 'El producto ya no existe' });
      return;
    }
    const hasVariants = productSnap.get('hasVariants') === true;
    if (item.variantId) {
      const variantSnap = variantSnaps[index];
      if (!hasVariants || !variantSnap?.exists) {
        skips.push({
          sku: item.sku,
          quantity: item.quantity,
          reason: 'La variante ya no es la unidad vendible',
        });
        return;
      }
      tx.update(variantSnap.ref, { stock: Number(variantSnap.get('stock') || 0) + item.quantity, updatedAt: timestamp });
      return;
    }
    if (hasVariants) {
      skips.push({
        sku: item.sku,
        quantity: item.quantity,
        reason: 'El producto ahora tiene variantes; el stock no vuelve al documento padre',
      });
      return;
    }
    tx.update(productSnap.ref, { stock: Number(productSnap.get('stock') || 0) + item.quantity, updatedAt: timestamp });
  });

  return skips;
}

export async function releaseOrderStock(id: string, patch: Partial<OrderRecord> = {}) {
  const ref = orders().doc(id);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new StoreError('Pedido no encontrado', 404);
    const order = mapOrder(snap.id, snap.data() || {});
    if (order.stockReleased) {
      tx.update(ref, { ...patch, updatedAt: nowIso() });
      return;
    }
    const skipped = await restoreStock(tx, order);
    tx.update(ref, {
      ...patch,
      stockReleased: true,
      stockRestoreSkipped: skipped,
      updatedAt: nowIso(),
    });
  });
  return getOrder(id);
}

const paymentStatuses: PaymentStatus[] = ['pending', 'paid', 'refunded', 'cancelled'];
const fulfillmentStatuses: FulfillmentStatus[] = ['pending', 'preparing', 'shipped', 'delivered', 'returned', 'cancelled'];
const returnStatuses: ReturnStatus[] = ['none', 'requested', 'received', 'refunded'];

export async function updateOrder(id: string, input: Record<string, unknown>) {
  const current = await getOrder(id);
  if (!current) throw new StoreError('Pedido no encontrado', 404);

  const paymentStatus = typeof input.paymentStatus === 'string' ? input.paymentStatus as PaymentStatus : current.paymentStatus;
  const fulfillmentStatus = typeof input.fulfillmentStatus === 'string' ? input.fulfillmentStatus as FulfillmentStatus : current.fulfillmentStatus;
  const returnStatus = typeof input.returnStatus === 'string' ? input.returnStatus as ReturnStatus : current.returnStatus;
  if (!paymentStatuses.includes(paymentStatus)) throw new StoreError('Estado de pago no válido');
  if (!fulfillmentStatuses.includes(fulfillmentStatus)) throw new StoreError('Estado de preparación no válido');
  if (!returnStatuses.includes(returnStatus)) throw new StoreError('Estado de devolución no válido');

  const patch: Partial<OrderRecord> = {
    paymentStatus,
    fulfillmentStatus,
    returnStatus,
    trackingCode: typeof input.trackingCode === 'string' ? input.trackingCode.trim().slice(0, 120) : current.trackingCode,
    adminNote: typeof input.adminNote === 'string' ? input.adminNote.trim().slice(0, 2000) : current.adminNote,
  };

  if (paymentStatus === 'paid' && current.paymentStatus !== 'paid' && !current.paidAt) {
    patch.paidAt = nowIso();
  }

  const shouldRelease = (
    (paymentStatus === 'cancelled' || paymentStatus === 'refunded' || fulfillmentStatus === 'cancelled' || returnStatus === 'refunded')
    && !current.stockReleased
  );

  if (paymentStatus === 'refunded' || returnStatus === 'refunded') {
    patch.paymentStatus = 'refunded';
    patch.returnStatus = 'refunded';
  }

  if (shouldRelease) return releaseOrderStock(id, patch);
  await orders().doc(id).update({ ...patch, updatedAt: nowIso() });
  return getOrder(id);
}

export async function requestReturn(publicToken: string, message: string) {
  const order = await getOrderByPublicToken(publicToken);
  if (!order) throw new StoreError('Pedido no encontrado', 404);
  if (order.returnStatus !== 'none') return order;
  if (order.paymentStatus === 'cancelled') throw new StoreError('Este pedido está cancelado');
  await orders().doc(order.id).update({
    returnStatus: 'requested',
    customerNote: message ? `${order.customerNote}\nDevolución: ${message}`.trim().slice(0, 2000) : order.customerNote,
    updatedAt: nowIso(),
  });
  return getOrder(order.id);
}

export async function listReturns(limit = 50) {
  const snapshot = await orders().where('returnStatus', 'in', ['requested', 'received', 'refunded']).limit(limit).get();
  return snapshot.docs
    .map((doc) => mapOrder(doc.id, doc.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
