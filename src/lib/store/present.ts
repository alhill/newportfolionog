import type { Product, Variant } from '../../types/store';
import { centsToEuros } from './money';

export function presentVariant(variant: Variant) {
  return {
    ...variant,
    priceEuros: variant.price == null ? '' : centsToEuros(variant.price),
    expectedStock: variant.stock,
  };
}

export function presentProduct(product: Product, variants: Variant[] = []) {
  return {
    ...product,
    priceEuros: centsToEuros(product.price),
    expectedStock: product.stock,
    variants: variants.map(presentVariant),
  };
}
