import { useEffect, useState } from 'preact/hooks';
import { storeApi } from './api';

const emptyOrigin = {
  firstName: '',
  lastName: '',
  company: '',
  email: '',
  phone: '',
  line1: '',
  line2: '',
  postalCode: '',
  city: '',
  region: '',
  country: 'ES',
};

export default function PacklinkAdmin() {
  const [form, setForm] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    storeApi('/api/store/packlink/settings')
      .then((result) => setForm(result.data))
      .catch((loadError) => setError(loadError.message));
  }, []);

  const setOrigin = (name, value) => {
    setForm((current) => ({ ...current, origin: { ...current.origin, [name]: value } }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await storeApi('/api/store/packlink/settings', {
        method: 'PUT',
        body: {
          enabled: form.enabled,
          origin: form.origin,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        },
      });
      setForm(result.data);
      setApiKey('');
      setMessage('Packlink guardado.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setError('');
    setMessage('');
    try {
      const result = await storeApi('/api/store/packlink/test', { method: 'POST', body: {} });
      setMessage(result.data?.message || 'Conexión correcta');
    } catch (testError) {
      setError(testError.message);
    } finally {
      setTesting(false);
    }
  };

  if (!form) {
    return <main class="main-content">{error ? <p class="store-error">{error}</p> : <p>Cargando…</p>}</main>;
  }

  const origin = form.origin || emptyOrigin;

  return (
    <main class="main-content">
      <div class="content-header">
        <h1>Packlink</h1>
      </div>
      {error && <p class="store-error">{error}</p>}
      {message && <p class="store-note">{message}</p>}
      <form class="store-panel store-form" onSubmit={save}>
        <h2>Packlink PRO</h2>
        <p class="store-note">
          El cliente paga el envío fijo de Configuración. Aquí se conecta la cuenta y la dirección de origen.
          El coste del bulto se consulta en cada pedido.
        </p>
        <div class="form-group">
          <label>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm({ ...form, enabled: event.currentTarget.checked })}
            />
            {' '}Activar Packlink
          </label>
        </div>
        <div class="form-group">
          <label>API key</label>
          <input
            type="password"
            value={apiKey}
            onInput={(event) => setApiKey(event.currentTarget.value)}
            placeholder={form.apiKeyConfigured ? `Guardada ${form.apiKeyHint}` : 'Clave de Packlink PRO'}
            autocomplete="new-password"
          />
          <small>
            {form.apiKeyConfigured
              ? 'Deja el campo vacío para conservar la key actual. Se genera en Packlink PRO, Configuración, Clave de API.'
              : 'Se genera en Packlink PRO, Configuración, Clave de API. Solo se guarda en el servidor.'}
          </small>
        </div>
        <h2>Origen de los envíos</h2>
        <div class="store-grid-2">
          <div class="form-group">
            <label>Nombre</label>
            <input type="text" value={origin.firstName} onInput={(event) => setOrigin('firstName', event.currentTarget.value)} />
          </div>
          <div class="form-group">
            <label>Apellidos</label>
            <input type="text" value={origin.lastName} onInput={(event) => setOrigin('lastName', event.currentTarget.value)} />
          </div>
        </div>
        <div class="store-grid-2">
          <div class="form-group">
            <label>Email</label>
            <input type="email" value={origin.email} onInput={(event) => setOrigin('email', event.currentTarget.value)} />
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input type="tel" value={origin.phone} onInput={(event) => setOrigin('phone', event.currentTarget.value)} />
          </div>
        </div>
        <div class="form-group">
          <label>Empresa</label>
          <input type="text" value={origin.company} onInput={(event) => setOrigin('company', event.currentTarget.value)} />
        </div>
        <div class="form-group">
          <label>Dirección</label>
          <input type="text" value={origin.line1} onInput={(event) => setOrigin('line1', event.currentTarget.value)} />
        </div>
        <div class="form-group">
          <label>Piso, puerta…</label>
          <input type="text" value={origin.line2} onInput={(event) => setOrigin('line2', event.currentTarget.value)} />
        </div>
        <div class="store-grid-2">
          <div class="form-group">
            <label>Código postal</label>
            <input type="text" value={origin.postalCode} onInput={(event) => setOrigin('postalCode', event.currentTarget.value)} />
          </div>
          <div class="form-group">
            <label>Ciudad</label>
            <input type="text" value={origin.city} onInput={(event) => setOrigin('city', event.currentTarget.value)} />
          </div>
        </div>
        <div class="store-grid-2">
          <div class="form-group">
            <label>Provincia</label>
            <input type="text" value={origin.region} onInput={(event) => setOrigin('region', event.currentTarget.value)} />
          </div>
          <div class="form-group">
            <label>País</label>
            <input type="text" value="España" disabled />
          </div>
        </div>
        <div class="store-actions">
          <button class="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          <button class="btn btn-secondary" type="button" disabled={testing} onClick={test}>
            {testing ? 'Probando…' : 'Probar conexión'}
          </button>
        </div>
      </form>
    </main>
  );
}
