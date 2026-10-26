import { useState } from 'preact/hooks';
import { formatEuros } from '../../lib/store/money';
import { resolveSellable } from '../../lib/store/pricing';

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem('tienda-cart') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AddToCart({ product, variants = [] }) {
  const [variantId, setVariantId] = useState(variants[0]?.id || '');
  const [message, setMessage] = useState('');
  const selected = variants.find((variant) => variant.id === variantId) || null;

  let resolved = null;
  let blocked = '';
  try {
    resolved = resolveSellable(product, product.hasVariants ? selected : null);
  } catch (error) {
    blocked = error.message;
  }

  const add = () => {
    if (!resolved || !resolved.isActive || resolved.stock < 1) return;
    const cart = readCart();
    const variantKey = product.hasVariants ? selected.id : null;
    const existing = cart.find((line) => line.productId === product.id && (line.variantId || null) === variantKey);
    if (existing) existing.quantity += 1;
    else cart.push({ productId: product.id, variantId: variantKey, quantity: 1 });
    localStorage.setItem('tienda-cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('tienda-cart'));
    setMessage('Añadido al carrito');
  };

  return (
    <div class="store-buy">
      <h1>{product.name}</h1>
      <p class="store-price">{resolved ? formatEuros(resolved.unitPrice) : formatEuros(product.price)}</p>
      <p class="store-copy">{product.description}</p>
      {product.hasVariants && (
        <div class="store-options">
          {variants.map((variant) => (
            <label key={variant.id}>
              <input
                type="radio"
                name="variant"
                checked={variant.id === variantId}
                onChange={() => setVariantId(variant.id)}
              />
              <span>
                {Object.entries(variant.attributes || {}).map(([key, value]) => `${key}: ${value}`).join(' · ') || variant.sku}
                {variant.stock < 1 ? ' · agotado' : ''}
              </span>
            </label>
          ))}
        </div>
      )}
      {blocked && <p class="store-message">{blocked}</p>}
      <div class="store-actions">
        <button type="button" onClick={add} disabled={!resolved || !resolved.isActive || resolved.stock < 1}>
          {resolved && resolved.stock > 0 ? 'Añadir al carrito' : 'Sin stock'}
        </button>
        {message && <p>{message}</p>}
      </div>
    </div>
  );
}
