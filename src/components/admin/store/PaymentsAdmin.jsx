import { useEffect, useState } from 'preact/hooks';
import { storeApi } from './api';

export default function PaymentsAdmin() {
  const [form, setForm] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    storeApi('/api/store/payments/settings')
      .then((result) => setForm(result.data))
      .catch((loadError) => setError(loadError.message));
  }, []);

  const sumup = form?.providers?.sumup;

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const body = {
        providers: {
          sumup: {
            enabled: sumup.enabled,
            merchantCode: sumup.merchantCode,
            ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          },
        },
      };
      const result = await storeApi('/api/store/payments/settings', { method: 'PUT', body });
      setForm(result.data);
      setApiKey('');
      setMessage('Configuración de pago guardada.');
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
      const result = await storeApi('/api/store/payments/sumup/test', { method: 'POST', body: {} });
      setMessage(result.data?.message || 'Conexión correcta');
      if (result.data?.merchantCode && form) {
        setForm({
          ...form,
          providers: {
            ...form.providers,
            sumup: { ...form.providers.sumup, merchantCode: form.providers.sumup.merchantCode || result.data.merchantCode },
          },
        });
      }
    } catch (testError) {
      setError(testError.message);
    } finally {
      setTesting(false);
    }
  };

  if (!form) {
    return <main class="main-content">{error ? <p class="store-error">{error}</p> : <p>Cargando…</p>}</main>;
  }

  return (
    <main class="main-content">
      <div class="content-header">
        <h1>Formas de pago</h1>
      </div>
      {error && <p class="store-error">{error}</p>}
      {message && <p class="store-note">{message}</p>}
      <form class="store-panel store-form" onSubmit={save}>
        <h2>SumUp</h2>
        <p class="store-note">
          Los cobros online usan Hosted Checkout con la misma cuenta de comerciante que el datáfono.
          Crea una API key en el panel de SumUp (prefijo <code>sup_sk_</code>) y copia el merchant code.
        </p>
        <div class="form-group">
          <label>
            <input
              type="checkbox"
              checked={sumup.enabled}
              onChange={(event) => setForm({
                ...form,
                providers: {
                  ...form.providers,
                  sumup: { ...sumup, enabled: event.currentTarget.checked },
                },
              })}
            />
            {' '}Activar SumUp como forma de pago de la tienda
          </label>
        </div>
        <div class="form-group">
          <label>Merchant code</label>
          <input
            type="text"
            value={sumup.merchantCode}
            onInput={(event) => setForm({
              ...form,
              providers: {
                ...form.providers,
                sumup: { ...sumup, merchantCode: event.currentTarget.value },
              },
            })}
            placeholder="MH4H92C7"
            autocomplete="off"
          />
        </div>
        <div class="form-group">
          <label>API key secreta</label>
          <input
            type="password"
            value={apiKey}
            onInput={(event) => setApiKey(event.currentTarget.value)}
            placeholder={sumup.apiKeyConfigured ? `Guardada ${sumup.apiKeyHint}` : 'sup_sk_…'}
            autocomplete="new-password"
          />
          <small>
            {sumup.apiKeyConfigured
              ? 'Deja el campo vacío para conservar la key actual.'
              : 'Solo se guarda en el servidor; no se vuelve a mostrar completa.'}
          </small>
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
