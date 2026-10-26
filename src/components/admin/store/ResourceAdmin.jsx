import { useEffect, useState } from 'preact/hooks';
import MediaPicker from '../MediaPicker';
import { validateResourceForm } from '../../../lib/store/resource-form';
import { resourceSpecs } from '../../../lib/store/resource-specs';
import ProductPicker from './ProductPicker';
import { storeApi } from './api';

const VALIDATION_MESSAGE = 'Revisa los campos marcados.';

function emptyValue(field) {
  if (field.type === 'checkbox') return true;
  if (field.type === 'number') return field.name === 'sortOrder' ? 0 : '';
  if (field.type === 'select') return field.options?.[0]?.value || '';
  if (field.type === 'products') return [];
  return '';
}

function Field({ id, label, required = false, error = '', hint = '', children }) {
  return (
    <div class={`form-group${error ? ' has-error' : ''}`}>
      <label for={id}>
        {label}
        {required ? <span class="required"> *</span> : null}
      </label>
      {children}
      {error ? <small class="store-field-error">{error}</small> : hint ? <small>{hint}</small> : null}
    </div>
  );
}

export default function ResourceAdmin({ resource, embedded = false }) {
  const spec = resourceSpecs[resource];
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imagePicker, setImagePicker] = useState(false);

  const blank = () => {
    const next = {};
    for (const field of spec.fields) next[field.name] = emptyValue(field);
    return next;
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await storeApi(`/api/store/resources/${resource}`);
      setItems(result.data || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setForm(null);
    setErrors({});
    load();
  }, [resource]);

  if (!spec) return <main class="main-content"><p>Sección no disponible.</p></main>;

  const hasSlug = spec.fields.some((field) => field.name === 'slug');
  const slugSourceName = resource === 'pages' ? 'title' : 'name';
  const slugSourceLabel = resource === 'pages' ? 'título' : 'nombre';

  const clearError = (name) => {
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
    setError((current) => (current === VALIDATION_MESSAGE ? '' : current));
  };

  const setField = (name, value) => {
    setForm((current) => (current ? { ...current, [name]: value } : current));
    clearError(name);
  };

  const resolveProducts = async (ids) => Promise.all(ids.map(async (id) => {
    try {
      const found = await storeApi(`/api/store/products/${id}`);
      const item = found.data;
      return { id, name: item?.name || id, imageUrl: item?.images?.[0]?.url || '' };
    } catch {
      return { id, name: id, imageUrl: '' };
    }
  }));

  const openForm = async (item) => {
    setErrors({});
    setError('');
    if (resource === 'campaigns') {
      const ids = Array.isArray(item?.featuredProductIds) ? item.featuredProductIds : [];
      const products = await resolveProducts(ids);
      setForm({ ...(item || blank()), featuredProductIds: products });
      return;
    }
    setForm(item || blank());
  };

  const showFieldErrors = (fieldErrors) => {
    setErrors(fieldErrors);
    setError(VALIDATION_MESSAGE);
    setSaving(false);
    setTimeout(() => {
      document.querySelector('.store-form .form-group.has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const fieldErrors = validateResourceForm(resource, form);
    const slug = String(form.slug || '').trim();
    if (hasSlug && slug && !fieldErrors.slug) {
      try {
        const availability = await storeApi(`/api/store/resources/${resource}/slug`, {
          method: 'POST',
          body: { kind: 'check', slug, excludeId: form.id || '' },
        });
        if (availability.data?.message) fieldErrors.slug = availability.data.message;
      } catch (checkError) {
        setErrors(fieldErrors);
        setError(checkError.message);
        setSaving(false);
        return;
      }
    }
    if (Object.keys(fieldErrors).length) {
      showFieldErrors(fieldErrors);
      return;
    }

    setErrors({});
    try {
      const body = { ...form };
      for (const field of spec.fields) {
        if (field.type === 'number' && body[field.name] !== '') body[field.name] = Number(body[field.name]);
        if (field.type === 'products') body[field.name] = (body[field.name] || []).map((item) => item.id);
      }
      if (form.id) {
        await storeApi(`/api/store/resources/${resource}/${form.id}`, { method: 'PUT', body });
      } else {
        await storeApi(`/api/store/resources/${resource}`, { method: 'POST', body });
      }
      setForm(null);
      await load();
    } catch (saveError) {
      const message = saveError.message || 'No se ha podido guardar';
      if (/slug/i.test(message)) setErrors((current) => ({ ...current, slug: message }));
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const generateSlug = async () => {
    const source = String(form[slugSourceName] || '').trim();
    if (!source) {
      setErrors((current) => ({ ...current, slug: `Escribe el ${slugSourceLabel} para poder generar el slug` }));
      return;
    }
    setGenerating(true);
    try {
      const result = await storeApi(`/api/store/resources/${resource}/slug`, {
        method: 'POST',
        body: { kind: 'generate', name: source, excludeId: form.id || '' },
      });
      setField('slug', result.data.value);
    } catch (generateError) {
      setErrors((current) => ({ ...current, slug: generateError.message }));
    } finally {
      setGenerating(false);
    }
  };

  const remove = async (id) => {
    if (!confirm(`¿Eliminar esta ${spec.singular.toLowerCase()}?`)) return;
    try {
      await storeApi(`/api/store/resources/${resource}/${id}`, { method: 'DELETE' });
      if (form?.id === id) setForm(null);
      await load();
    } catch (removeError) {
      setError(removeError.message);
    }
  };

  const labelOf = (item) => item.name || item.title || item.code || 'Sin nombre';

  return (
    <div class={embedded ? 'store-embedded' : 'main-content'}>
      <div class="content-header">
        <h1>{spec.title}</h1>
        <button type="button" class="btn btn-primary" onClick={() => openForm(null)}>+ {spec.singular}</button>
      </div>
      {error && !form && <p class="store-error">{error}</p>}
      {loading ? <p>Cargando…</p> : (
        <div class="store-table-wrap">
          <table class="store-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{labelOf(item)}</td>
                  <td class="store-row-actions">
                    <button type="button" class="btn btn-secondary" onClick={() => openForm(item)}>Editar</button>
                    <button type="button" class="btn btn-danger" onClick={() => remove(item.id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <p class="empty">Todavía no hay registros.</p>}
        </div>
      )}

      {form && (
        <form class="store-panel store-form" onSubmit={save} noValidate>
          <h2>{form.id ? `Editar ${spec.singular.toLowerCase()}` : `Nueva ${spec.singular.toLowerCase()}`}</h2>
          {error && <p class="store-error">{error}</p>}
          {spec.fields.map((field) => {
            if (field.type === 'checkbox') {
              return (
                <label class="store-checkline" key={field.name}>
                  <input type="checkbox" checked={form[field.name] === true} onChange={(event) => setField(field.name, event.currentTarget.checked)} />
                  {field.label}
                </label>
              );
            }
            if (field.type === 'products') {
              return (
                <ProductPicker
                  key={field.name}
                  label={field.label}
                  products={Array.isArray(form[field.name]) ? form[field.name] : []}
                  onChange={(products) => setField(field.name, products)}
                  max={30}
                  hint={field.help}
                />
              );
            }
            if (field.type === 'image') {
              return (
                <Field key={field.name} id={`field-${field.name}`} label={field.label} required={field.required} error={errors[field.name]}>
                  <div class="store-banner-pick">
                    <div class="store-image-thumb">
                      {form[field.name] ? <img src={form[field.name]} alt="" /> : null}
                    </div>
                    <button type="button" class="btn btn-secondary" onClick={() => setImagePicker(true)}>
                      {form[field.name] ? 'Cambiar imagen' : 'Elegir imagen'}
                    </button>
                  </div>
                </Field>
              );
            }
            if (field.name === 'slug') {
              return (
                <Field key={field.name} id={`field-${field.name}`} label={field.label} required error={errors.slug} hint={field.help}>
                  <div class="input-with-button">
                    <input
                      id={`field-${field.name}`}
                      type="text"
                      value={form.slug || ''}
                      autoComplete="off"
                      onInput={(event) => setField('slug', event.currentTarget.value)}
                    />
                    <button type="button" class="btn-secondary-small" onClick={generateSlug} disabled={generating || saving}>
                      {generating ? 'Generando…' : 'Generar'}
                    </button>
                  </div>
                </Field>
              );
            }
            const inputType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
            return (
              <Field key={field.name} id={`field-${field.name}`} label={field.label} required={field.required} error={errors[field.name]} hint={field.help}>
                {field.type === 'textarea' || field.type === 'lines' ? (
                  <textarea
                    id={`field-${field.name}`}
                    rows={field.type === 'lines' ? 6 : 4}
                    value={form[field.name] || ''}
                    placeholder={field.type === 'lines' ? 'Texto | /ruta' : undefined}
                    onInput={(event) => setField(field.name, event.currentTarget.value)}
                  />
                ) : field.type === 'select' ? (
                  <select id={`field-${field.name}`} value={form[field.name] || ''} onChange={(event) => setField(field.name, event.currentTarget.value)}>
                    {field.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                  </select>
                ) : (
                  <input
                    id={`field-${field.name}`}
                    type={inputType}
                    step={field.type === 'number' ? (field.name === 'sortOrder' || field.name === 'usageLimit' ? '1' : '0.01') : undefined}
                    min={field.type === 'number' && field.name !== 'sortOrder' ? '0' : undefined}
                    value={form[field.name] ?? ''}
                    onInput={(event) => setField(field.name, event.currentTarget.value)}
                  />
                )}
              </Field>
            );
          })}
          {resource === 'coupons' && form.usageCount != null && <p class="store-note">Usos registrados: {form.usageCount}. El checkout los incrementa; este formulario no los reinicia.</p>}
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onClick={() => { setForm(null); setErrors({}); setError(''); setImagePicker(false); }}>Cerrar</button>
            <button class="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      )}

      <MediaPicker
        isOpen={imagePicker}
        onClose={() => setImagePicker(false)}
        onSelect={(uri) => setField('imageUrl', uri)}
        allowedTypes={['image']}
      />
    </div>
  );
}
