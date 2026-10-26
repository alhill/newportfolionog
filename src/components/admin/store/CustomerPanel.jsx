import { useState } from 'preact/hooks';
import { splitLegacyName } from '../../../lib/store/contact';
import { formatEuros } from '../../../lib/store/money';
import { storeApi } from './api';

export default function CustomerPanel({ record }) {
  const stored = record.customer;
  const legacy = stored.firstName || stored.lastName ? null : splitLegacyName(stored.name || '');
  const [customer, setCustomer] = useState({
    ...stored,
    firstName: stored.firstName || legacy?.firstName || '',
    lastName: stored.lastName || legacy?.lastName || '',
  });
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await storeApi(`/api/store/customers/${customer.id}`, {
        method: 'PUT',
        body: { firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone, adminNote: customer.adminNote },
      });
      window.location.reload();
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  const addNote = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await storeApi(`/api/store/customers/${customer.id}/notes`, { method: 'POST', body: { message: note } });
      window.location.reload();
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  return (
    <main class="main-content">
      <div class="content-header">
        <div>
          <p class="store-kicker"><a href="/admin/tienda/clientes">Clientes</a></p>
          <h1>{[customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.name || customer.email}</h1>
        </div>
      </div>
      {error && <p class="store-error">{error}</p>}
      <form class="store-panel store-form" onSubmit={save}>
        <div class="store-grid-2">
          <div class="form-group">
            <label>Nombre</label>
            <input type="text" value={customer.firstName} onInput={(event) => setCustomer({ ...customer, firstName: event.currentTarget.value })} />
          </div>
          <div class="form-group">
            <label>Apellidos</label>
            <input type="text" value={customer.lastName} onInput={(event) => setCustomer({ ...customer, lastName: event.currentTarget.value })} />
          </div>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" value={customer.email} disabled />
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input type="text" value={customer.phone || ''} onInput={(event) => setCustomer({ ...customer, phone: event.currentTarget.value })} />
        </div>
        <div class="form-group">
          <label>Nota interna</label>
          <textarea rows={3} value={customer.adminNote || ''} onInput={(event) => setCustomer({ ...customer, adminNote: event.currentTarget.value })} />
        </div>
        <button class="btn btn-primary" disabled={saving}>Guardar ficha</button>
      </form>

      <section class="store-panel">
        <h2>Direcciones</h2>
        {(customer.addresses || []).length === 0 && <p>Sin direcciones.</p>}
        {(customer.addresses || []).map((address, index) => (
          <p key={index}>{[address.firstName, address.lastName].filter(Boolean).join(' ') || address.fullName} · {address.line1} {address.line2} · {address.postalCode} {address.city}</p>
        ))}
      </section>

      <section class="store-panel">
        <h2>Pedidos</h2>
        {(record.orders || []).map((order) => (
          <p key={order.id}><a href={`/admin/tienda/pedidos/${order.id}`}>{order.number}</a> · {formatEuros(order.total)} · {order.paymentStatus}</p>
        ))}
        {(record.orders || []).length === 0 && <p>Sin pedidos.</p>}
      </section>

      <section class="store-panel">
        <h2>Comunicaciones</h2>
        <form onSubmit={addNote} class="store-form">
          <div class="form-group">
            <label>Nota</label>
            <textarea rows={3} value={note} onInput={(event) => setNote(event.currentTarget.value)} />
          </div>
          <button class="btn btn-secondary">Añadir nota</button>
        </form>
        {(record.notes || []).map((item) => (
          <article key={item.id} class="store-note-card">
            <p>{item.message}</p>
            <small>{item.createdAt ? new Date(item.createdAt).toLocaleString('es-ES') : ''}</small>
          </article>
        ))}
      </section>
    </main>
  );
}
