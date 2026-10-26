import { useState } from 'preact/hooks';
import { formatEuros } from '../../../lib/store/money';
import { storeApi } from './api';
import ShipmentPanel from './ShipmentPanel';

const paymentOptions = [
  ['pending', 'Pendiente'],
  ['paid', 'Pagado'],
  ['refunded', 'Reembolsado'],
  ['cancelled', 'Cancelado'],
];

const fulfillmentOptions = [
  ['pending', 'Pendiente'],
  ['preparing', 'En preparación'],
  ['shipped', 'Enviado'],
  ['delivered', 'Entregado'],
  ['returned', 'Devuelto'],
  ['cancelled', 'Cancelado'],
];

const returnOptions = [
  ['none', 'Sin devolución'],
  ['requested', 'Solicitada'],
  ['received', 'Recibida'],
  ['refunded', 'Reembolsada'],
];

export default function OrderActions({ order }) {
  const [form, setForm] = useState({
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    returnStatus: order.returnStatus,
    trackingCode: order.trackingCode || '',
    adminNote: order.adminNote || '',
  });
  const [saving, setSaving] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [paymentUrl, setPaymentUrl] = useState(order.paymentUrl || '');

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await storeApi(`/api/store/orders/${order.id}`, { method: 'PUT', body: form });
      window.location.reload();
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  const copyPaymentLink = async (forceNew = false) => {
    setLinkBusy(true);
    setError('');
    setNote('');
    try {
      const result = await storeApi(`/api/store/orders/${order.id}/payment-link`, {
        method: 'POST',
        body: { forceNew },
      });
      const url = result.data?.paymentUrl || '';
      setPaymentUrl(url);
      if (url && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setNote(forceNew ? 'Nuevo enlace de pago copiado.' : 'Enlace de pago copiado.');
      } else if (url) {
        setNote(url);
      }
    } catch (linkError) {
      setError(linkError.message);
    } finally {
      setLinkBusy(false);
    }
  };

  return (
    <main class="main-content">
      <div class="content-header">
        <div>
          <p class="store-kicker"><a href="/admin/tienda/pedidos">Pedidos</a></p>
          <h1>{order.number}</h1>
        </div>
      </div>
      {error && <p class="store-error">{error}</p>}
      {note && <p class="store-note">{note}</p>}
      <section class="store-panel">
        <p>{order.customerName} · {order.customerEmail}</p>
        <p>{order.shippingAddress?.line1}{order.shippingAddress?.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress?.postalCode} {order.shippingAddress?.city}</p>
        {order.shippingAddress?.phone && <p>{order.shippingAddress.phone}</p>}
        <p>Total {formatEuros(order.total)} · Impuestos {formatEuros(order.tax)} ({order.taxRate}%)</p>
        {order.couponCode && <p>Cupón {order.couponCode} · descuento {formatEuros(order.discount)}</p>}
        {order.paidAt && <p>Pagado el {order.paidAt}</p>}
        {paymentUrl && order.paymentStatus === 'pending' && (
          <p><a href={paymentUrl} target="_blank" rel="noreferrer">Abrir enlace de pago SumUp</a></p>
        )}
        {order.paymentStatus === 'pending' && (
          <p>
            <button class="btn btn-secondary" type="button" disabled={linkBusy} onClick={() => copyPaymentLink(false)}>
              {linkBusy ? 'Generando…' : 'Copiar enlace de pago'}
            </button>
            {' '}
            <button class="btn btn-secondary" type="button" disabled={linkBusy} onClick={() => copyPaymentLink(true)}>
              Regenerar enlace
            </button>
          </p>
        )}
        {order.stockRestoreSkipped?.length > 0 && (
          <p class="store-error">Parte del stock no se pudo devolver porque el catálogo cambió de modo: {order.stockRestoreSkipped.map((item) => item.sku).join(', ')}</p>
        )}
      </section>
      <div class="store-table-wrap">
        <table class="store-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>SKU</th>
              <th>Atributos</th>
              <th>Precio</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={`${item.sku}-${index}`}>
                <td>{item.name}</td>
                <td>{item.sku}</td>
                <td>{Object.entries(item.attributes || {}).map(([key, value]) => `${key}: ${value}`).join(' · ') || '—'}</td>
                <td>{formatEuros(item.unitPrice)}</td>
                <td>{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="store-note">Estas líneas son la copia guardada al crear el pedido. Un cambio posterior del catálogo no las modifica.</p>
      <ShipmentPanel order={order} />
      <form class="store-panel store-form" onSubmit={save}>
        <div class="store-grid-2">
          <div class="form-group">
            <label>Pago</label>
            <select value={form.paymentStatus} onChange={(event) => setForm({ ...form, paymentStatus: event.currentTarget.value })}>
              {paymentOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </div>
          <div class="form-group">
            <label>Preparación</label>
            <select value={form.fulfillmentStatus} onChange={(event) => setForm({ ...form, fulfillmentStatus: event.currentTarget.value })}>
              {fulfillmentOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Devolución</label>
          <select value={form.returnStatus} onChange={(event) => setForm({ ...form, returnStatus: event.currentTarget.value })}>
            {returnOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          <small>Marcar el pago o la devolución como reembolsado devuelve el cobro en SumUp si todavía no hay etiqueta de Packlink.</small>
        </div>
        <div class="form-group">
          <label>Seguimiento</label>
          <input type="text" value={form.trackingCode} onInput={(event) => setForm({ ...form, trackingCode: event.currentTarget.value })} />
        </div>
        <div class="form-group">
          <label>Nota interna</label>
          <textarea rows={3} value={form.adminNote} onInput={(event) => setForm({ ...form, adminNote: event.currentTarget.value })} />
        </div>
        <button class="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar pedido'}</button>
      </form>
    </main>
  );
}
