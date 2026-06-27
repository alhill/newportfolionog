import { useEffect, useState } from 'preact/hooks';
import {
  EMPTY_LINKTREE_DATA,
  LINKTREE_FIELD_GROUPS,
  parseLinktreeLinks,
  serializeLinktreeLinks,
} from '../../lib/linktree-keys';
import LinktreeLinksRepeater from './LinktreeLinksRepeater';

const PUBLIC_LINKTREE_URL = 'https://enlaces.srtanognog.com';

function renderFieldGroup(group, formData, handleChange) {
  return (
    <div class="form-section" key={group.title}>
      <h2>{group.title}</h2>

      {group.fields.map((field) => (
        <div class="form-group" key={field.key}>
          <label for={`linktree-${field.key}`}>{field.label}</label>
          {field.type === 'textarea' ? (
            <textarea
              id={`linktree-${field.key}`}
              name={field.key}
              rows={field.rows ?? 4}
              value={formData[field.key]}
              onInput={handleChange}
            />
          ) : (
            <input
              id={`linktree-${field.key}`}
              name={field.key}
              type="text"
              value={formData[field.key]}
              onInput={handleChange}
            />
          )}
          {field.hint && <small>{field.hint}</small>}
        </div>
      ))}
    </div>
  );
}

export default function LinksEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(EMPTY_LINKTREE_DATA);
  const [linkItems, setLinkItems] = useState([]);
  const [reloadModalOpen, setReloadModalOpen] = useState(false);

  useEffect(() => {
    loadLinktree();
  }, []);

  const loadLinktree = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/linktree');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'No se han podido cargar los enlaces');
      }

      const nextData = { ...EMPTY_LINKTREE_DATA, ...data.data };
      setFormData(nextData);
      setLinkItems(parseLinktreeLinks(nextData.links));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveChanges = async () => {
    setSaving(true);
    setError(null);

    const payload = {
      ...formData,
      links: serializeLinktreeLinks(linkItems),
    };

    try {
      const response = await fetch('/api/linktree', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'No se han podido guardar los cambios');
      }

      window.alert('Enlaces guardados correctamente');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await saveChanges();
  };

  const handleReloadClick = () => {
    setReloadModalOpen(true);
  };

  const handleConfirmReload = async () => {
    setReloadModalOpen(false);
    await loadLinktree();
  };

  if (loading) {
    return (
      <main class="main-content">
        <p class="loading">Cargando enlaces...</p>
      </main>
    );
  }

  const [headerGroup, ...otherGroups] = LINKTREE_FIELD_GROUPS;

  return (
    <main class="main-content">
      <div class="content-header">
        <h1>Enlaces</h1>
        <div class="content-header-actions">
          <button
            type="button"
            class="btn btn-primary"
            onClick={saveChanges}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <a
            href={PUBLIC_LINKTREE_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-secondary"
          >
            Ir a página de enlaces
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>
      </div>

      {error && (
        <div class="error-message">
          <p>⚠️ {error}</p>
        </div>
      )}

      <form class="page-editor-form" onSubmit={handleSubmit}>
        {renderFieldGroup(headerGroup, formData, handleChange)}

        <LinktreeLinksRepeater items={linkItems} onChange={setLinkItems} />

        {otherGroups.map((group) => renderFieldGroup(group, formData, handleChange))}

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onClick={handleReloadClick} disabled={saving}>
            Recargar
          </button>
          <button type="submit" class="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      {reloadModalOpen && (
        <div class="modal" onClick={() => setReloadModalOpen(false)}>
          <div class="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h2 class="confirm-dialog-title">Descartar cambios</h2>
            <p class="confirm-dialog-message">
              Vas a descartar los cambios sin guardar y recargar los datos desde KV. Esta acción no se puede deshacer.
            </p>
            <div class="confirm-dialog-actions">
              <button
                type="button"
                class="btn-secondary"
                onClick={() => setReloadModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                class="btn-danger"
                onClick={handleConfirmReload}
              >
                Descartar y recargar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
