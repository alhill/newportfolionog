import { useEffect, useState } from 'preact/hooks';
import { storeApi } from './api';

export default function SettingsAdmin({ mode = 'all' }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    storeApi('/api/store/settings')
      .then((result) => setForm(result.data))
      .catch((loadError) => setError(loadError.message));
  }, []);

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await storeApi('/api/store/settings', { method: 'PUT', body: form });
      setForm(result.data);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <main class="main-content">{error ? <p class="store-error">{error}</p> : <p>Cargando…</p>}</main>;

  return (
    <main class="main-content">
      <div class="content-header">
        <h1>{mode === 'seo' ? 'SEO de la tienda' : 'Configuración'}</h1>
      </div>
      {error && <p class="store-error">{error}</p>}
      <form class="store-panel store-form" onSubmit={save}>
        {mode !== 'seo' && (
          <>
            <div class="form-group">
              <label>Nombre de la tienda</label>
              <input type="text" value={form.name} onInput={(event) => setField('name', event.currentTarget.value)} />
            </div>
            <div class="form-group">
              <label>Dominio público</label>
              <input type="text" value={form.domain} onInput={(event) => setField('domain', event.currentTarget.value)} placeholder="https://" />
              <small>Referencia comercial. El enrutado sigue siendo el de este sitio. SumUp se configura en Formas de pago.</small>
            </div>
            <div class="store-grid-2">
              <div class="form-group">
                <label>Envío que paga el cliente (€)</label>
                <input type="number" min="0" step="0.01" value={form.shippingEuros} onInput={(event) => setField('shippingEuros', event.currentTarget.value)} />
                <small>Importe fijo en el checkout. El coste de Packlink se consulta al preparar el pedido.</small>
              </div>
              <div class="form-group">
                <label>Impuesto (%)</label>
                <input type="number" min="0" max="100" step="0.01" value={form.taxRate} onInput={(event) => setField('taxRate', event.currentTarget.value)} />
              </div>
            </div>
            <div class="store-grid-2">
              <div class="form-group">
                <label>Umbral de poco stock</label>
                <input type="number" min="0" step="1" value={form.lowStockThreshold} onInput={(event) => setField('lowStockThreshold', event.currentTarget.value)} />
              </div>
              <div class="form-group">
                <label>Email de avisos</label>
                <input type="email" value={form.notificationEmail} onInput={(event) => setField('notificationEmail', event.currentTarget.value)} />
                <small>Aviso por email cuando un pedido queda pagado.</small>
              </div>
            </div>
            <p class="store-note">Los usuarios que administran la tienda son las cuentas de Firebase Auth que ya entran en /admin. No hay una lista de usuarios aparte.</p>
          </>
        )}
        <div class="form-group">
          <label>Título SEO</label>
          <input type="text" value={form.seoTitle} onInput={(event) => setField('seoTitle', event.currentTarget.value)} />
        </div>
        <div class="form-group">
          <label>Descripción SEO</label>
          <textarea rows={3} value={form.seoDescription} onInput={(event) => setField('seoDescription', event.currentTarget.value)} />
        </div>
        <button class="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </main>
  );
}
