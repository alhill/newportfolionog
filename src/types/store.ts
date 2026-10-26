/**
 * Catálogo de la tienda.
 *
 * `price` se guarda en céntimos de euro (entero). El proyecto no tenía un tipo
 * monetario previo; el entero evita errores de coma flotante.
 *
 * Stock vendible:
 * - `hasVariants === false`: `sku` y `stock` viven en el producto.
 * - `hasVariants === true`: `sku` y `stock` viven solo en `variants`.
 *   El padre deja `sku` y `stock` a null. Ese null no es la suma de las variantes.
 *
 * Precio efectivo:
 * - Producto simple: `product.price`.
 * - Variante con `priceInherited === true`: hereda `product.price`.
 * - Variante con `priceInherited === false`: usa su propio `price`.
 * La herencia es explícita; no se asume por dejar el precio vacío.
 */

export interface StoreImage {
  url: string;
  alt: string;
}

export interface ProductRecord {
  name: string;
  nameLower: string;
  slug: string;
  description: string;
  images: StoreImage[];
  price: number;
  hasVariants: boolean;
  sku: string | null;
  stock: number | null;
  isActive: boolean;
  categoryId: string | null;
  brandId: string | null;
  collectionIds: string[];
  groupId: string | null;
  relatedProductIds: string[];
  featured: boolean;
  attributes: Record<string, string>;
  seoTitle: string;
  seoDescription: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface VariantRecord {
  productId: string;
  sku: string;
  attributes: Record<string, string>;
  stock: number;
  price: number | null;
  priceInherited: boolean;
  isActive: boolean;
  images: StoreImage[];
  createdAt: string;
  updatedAt: string;
}

export interface Product extends ProductRecord {
  id: string;
}

export interface Variant extends VariantRecord {
  id: string;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  price: number;
  hasVariants: boolean;
  sku: string | null;
  stock: number | null;
  isActive: boolean;
  featured: boolean;
  categoryId: string | null;
  brandId: string | null;
  imageUrl: string | null;
  updatedAt: string;
}

export interface InventoryItem {
  source: 'product' | 'variant';
  productId: string;
  variantId: string | null;
  productName: string;
  sku: string;
  attributes: Record<string, string>;
  stock: number;
  price: number;
  priceInherited: boolean;
  isActive: boolean;
  sellable: boolean;
  cursorId: string;
}

export interface InventoryCursor {
  sku?: string;
  stock?: number;
  id: string;
}

export interface OrderLineSnapshot {
  productId: string;
  variantId: string | null;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'cancelled';
export type FulfillmentStatus = 'pending' | 'preparing' | 'shipped' | 'delivered' | 'returned' | 'cancelled';
export type ReturnStatus = 'none' | 'requested' | 'received' | 'refunded';

export interface PostalAddress {
  firstName: string;
  lastName: string;
  fullName: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  region: string;
  country: string;
  phone: string;
}

export interface PacklinkPackage {
  width: number;
  height: number;
  length: number;
  weight: number;
}

export interface PacklinkShipment {
  reference: string;
  serviceId: number;
  serviceName: string;
  carrierName: string;
  totalCents: number;
  baseCents: number;
  taxCents: number;
  currency: 'EUR';
  state: string;
  labelUrls: string[];
  trackingUrl: string;
  printInStore: boolean;
  dropoff: boolean;
  packages: PacklinkPackage[];
  createdAt: string;
  updatedAt: string;
}

export interface StockRestoreSkip {
  sku: string;
  quantity: number;
  reason: string;
}

export interface OrderRecord {
  number: string;
  idempotencyKey: string;
  publicToken: string;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  returnStatus: ReturnStatus;
  items: OrderLineSnapshot[];
  currency: 'EUR';
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  taxRate: number;
  total: number;
  couponCode: string | null;
  carrierId: string | null;
  carrierName: string | null;
  trackingCode: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  shippingAddress: PostalAddress;
  packlink: PacklinkShipment | null;
  paymentProvider: string | null;
  paymentCheckoutId: string | null;
  paymentUrl: string | null;
  paidAt: string | null;
  customerNote: string;
  adminNote: string;
  stockCommitted: boolean;
  stockReleased: boolean;
  stockRestoreSkipped: StockRestoreSkip[];
  createdAt: string;
  updatedAt: string;
}

export interface Order extends OrderRecord {
  id: string;
}

export interface CustomerRecord {
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  addresses: PostalAddress[];
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer extends CustomerRecord {
  id: string;
}

export interface CustomerNote {
  id: string;
  message: string;
  createdAt: string;
  createdBy: string;
}

export interface StoreSettings {
  name: string;
  currency: 'EUR';
  domain: string;
  shippingFlatRate: number;
  taxRate: number;
  lowStockThreshold: number;
  notificationEmail: string;
  seoTitle: string;
  seoDescription: string;
  updatedAt: string;
}

export interface CheckoutItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface CheckoutInput {
  idempotencyKey: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address: Partial<PostalAddress>;
  carrierId?: string | null;
  couponCode?: string | null;
  items: CheckoutItemInput[];
  customerNote?: string;
  company?: string;
}
