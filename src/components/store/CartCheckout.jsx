import { useEffect, useState } from 'preact/hooks';
import { formatEuros } from '../../lib/store/money';

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem('tienda-cart') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function checkoutKey() {
  const current = sessionStorage.getItem('tienda-checkout-key');
  if (current) return current;
  const next = crypto.randomUUID();
  sessionStorage.setItem('tienda-checkout-key', next);
  return next;
}

export default function CartCheckout() {
  const [cart, setCart] = useState([]);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    line1: '',
    line2: '',
    postalCode: '',
    city: '',
    region: '',
    couponCode: '',
    customerNote: '',
    company: '',
  });

  useEffect(() => {
    setCart(readCart());
  }, []);

  useEffect(() => {
    if (cart.length === 0) {
      setQuote(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/store/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart,
            couponCode: form.couponCode,
          }),
        });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok || data.success === false) {
          setQuote(null);
          setError(data.error || 'No se ha podido calcular el pedido');
          return;
        }
        setError('');
        setQuote(data.data);
      } catch (quoteError) {
        if (!cancelled) setError(quoteError.message);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cart, form.couponCode]);

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const updateQuantity = (index, quantity) => {
    const next = cart
      .map((line, lineIndex) => (lineIndex === index ? { ...line, quantity } : line))
      .filter((line) => line.quantity > 0);
    setCart(next);
    localStorage.setItem('tienda-cart', JSON.stringify(next));
    window.dispatchEvent(new Event('tienda-cart'));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/store/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: checkoutKey(),
          items: cart,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          couponCode: form.couponCode,
          customerNote: form.customerNote,
          company: form.company,
          address: {
            line1: form.line1,
            line2: form.line2,
            postalCode: form.postalCode,
            city: form.city,
            region: form.region,
            country: 'ES',
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) throw new Error(data.error || 'No se ha podido crear el pedido');
      localStorage.removeItem('tienda-cart');
      sessionStorage.removeItem('tienda-checkout-key');
      if (data.data.paymentUrl) {
        window.location.href = data.data.paymentUrl;
        return;
      }
      window.location.href = `/tienda/pedido/${data.data.publicToken}`;
    } catch (submitError) {
      setError(submitError.message);
      setSending(false);
    }
  };

  if (cart.length === 0) {
    return <p>El carrito está vacío. <a href="/tienda">Volver a la tienda</a></p>;
  }

  return (
    <form class="store-checkout" onSubmit={submit}>
      <ul class="store-lines">
        {(quote?.items || cart).map((item, index) => (
          <li key={`${item.productId || item.sku}-${index}`}>
            <span>
              {item.name || 'Producto'}
              {item.sku ? ` · ${item.sku}` : ''}
            </span>
            <span>
              <input
                type="number"
                min="0"
                max="99"
                value={cart[index]?.quantity || item.quantity}
                onInput={(event) => updateQuantity(index, Number(event.currentTarget.value))}
              />
              {item.lineTotal != null ? ` ${formatEuros(item.lineTotal)}` : ''}
            </span>
          </li>
        ))}
      </ul>

      {quote && (
        <div class="store-totals">
          <p><span>Subtotal</span><span>{formatEuros(quote.subtotal)}</span></p>
          <p><span>Descuento</span><span>{formatEuros(quote.discount)}</span></p>
          <p><span>Envío</span><span>{formatEuros(quote.shipping)}</span></p>
          <p><span>Impuestos</span><span>{formatEuros(quote.tax)}</span></p>
          <p><strong>Total</strong><strong>{formatEuros(quote.total)}</strong></p>
        </div>
      )}

      <input class="honeypot" tabIndex={-1} autocomplete="off" value={form.company} onInput={(event) => setField('company', event.currentTarget.value)} />
      <div class="store-pair">
        <input required autocomplete="given-name" placeholder="Nombre" value={form.firstName} onInput={(event) => setField('firstName', event.currentTarget.value)} />
        <input required autocomplete="family-name" placeholder="Apellidos" value={form.lastName} onInput={(event) => setField('lastName', event.currentTarget.value)} />
      </div>
      <input required type="email" autocomplete="email" placeholder="Email" value={form.email} onInput={(event) => setField('email', event.currentTarget.value)} />
      <input required autocomplete="tel" placeholder="Teléfono" value={form.phone} onInput={(event) => setField('phone', event.currentTarget.value)} />
      <input required autocomplete="address-line1" placeholder="Dirección" value={form.line1} onInput={(event) => setField('line1', event.currentTarget.value)} />
      <input autocomplete="address-line2" placeholder="Piso, puerta…" value={form.line2} onInput={(event) => setField('line2', event.currentTarget.value)} />
      <input required autocomplete="postal-code" placeholder="Código postal" value={form.postalCode} onInput={(event) => setField('postalCode', event.currentTarget.value)} />
      <input required autocomplete="address-level2" placeholder="Ciudad" value={form.city} onInput={(event) => setField('city', event.currentTarget.value)} />
      <input autocomplete="address-level1" placeholder="Provincia" value={form.region} onInput={(event) => setField('region', event.currentTarget.value)} />
      <p class="store-copy">Enviamos solo a España.</p>
      <input placeholder="Cupón" value={form.couponCode} onInput={(event) => setField('couponCode', event.currentTarget.value)} />
      <textarea rows={3} placeholder="Nota para el pedido" value={form.customerNote} onInput={(event) => setField('customerNote', event.currentTarget.value)} />
      {error && <p class="store-message">{error}</p>}
      <button disabled={sending || !quote}>{sending ? 'Redirigiendo al pago…' : 'Pagar con SumUp'}</button>
    </form>
  );
}
