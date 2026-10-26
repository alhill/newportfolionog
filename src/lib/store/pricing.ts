import { StoreError } from './errors';

export interface SellableProduct {
  name: string;
  price: number;
  hasVariants: boolean;
  sku: string | null;
  stock: number | null;
  isActive: boolean;
}

export interface SellableVariant {
  sku: string;
  stock: number;
  price: number | null;
  priceInherited: boolean;
  isActive: boolean;
  attributes: Record<string, string>;
}

export interface ResolvedSellable {
  sku: string;
  stock: number;
  unitPrice: number;
  isActive: boolean;
  attributes: Record<string, string>;
}

/**
 * Resuelve la unidad vendible.
 * El padre no se vende cuando tiene variantes, y una variante no se vende
 * sobre un producto simple.
 */
export function resolveSellable(product: SellableProduct, variant: SellableVariant | null): ResolvedSellable {
  if (product.hasVariants) {
    if (!variant) {
      throw new StoreError('Este producto se vende por variantes');
    }

    const unitPrice = variant.priceInherited ? product.price : variant.price;
    if (!variant.priceInherited && (variant.price == null || !Number.isInteger(variant.price) || variant.price < 0)) {
      throw new StoreError(`La variante ${variant.sku || ''} no tiene un precio propio`.trim());
    }
    if (unitPrice == null || !Number.isInteger(unitPrice) || unitPrice < 0) {
      throw new StoreError('No se ha podido resolver el precio de la variante');
    }
    if (!variant.sku.trim()) {
      throw new StoreError('La variante no tiene SKU');
    }
    if (!Number.isInteger(variant.stock) || variant.stock < 0) {
      throw new StoreError('El stock de la variante no es válido');
    }

    return {
      sku: variant.sku,
      stock: variant.stock,
      unitPrice,
      isActive: product.isActive && variant.isActive,
      attributes: variant.attributes,
    };
  }

  if (variant) {
    throw new StoreError('Este producto no tiene variantes vendibles');
  }
  if (!product.sku?.trim()) {
    throw new StoreError('El producto no tiene SKU');
  }
  if (product.stock == null || !Number.isInteger(product.stock) || product.stock < 0) {
    throw new StoreError('El producto no tiene stock');
  }
  if (!Number.isInteger(product.price) || product.price < 0) {
    throw new StoreError('El producto no tiene un precio válido');
  }

  return {
    sku: product.sku,
    stock: product.stock,
    unitPrice: product.price,
    isActive: product.isActive,
    attributes: {},
  };
}

export interface TotalsInput {
  lines: { unitPrice: number; quantity: number }[];
  coupon: { type: 'percent' | 'fixed'; amount: number } | null;
  shippingCents: number;
  taxRate: number;
}

export function computeTotals(input: TotalsInput) {
  const subtotal = input.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  let discount = 0;

  if (input.coupon?.type === 'percent') {
    discount = Math.round(subtotal * (input.coupon.amount / 100));
  } else if (input.coupon?.type === 'fixed') {
    discount = input.coupon.amount;
  }

  if (discount > subtotal) discount = subtotal;
  if (discount < 0) discount = 0;

  const shipping = Math.max(0, input.shippingCents);
  const taxable = subtotal - discount + shipping;
  const taxRate = Number.isFinite(input.taxRate) ? input.taxRate : 0;
  const tax = Math.round(taxable * (taxRate / 100));

  return {
    subtotal,
    discount,
    shipping,
    tax,
    taxRate,
    total: taxable + tax,
  };
}
