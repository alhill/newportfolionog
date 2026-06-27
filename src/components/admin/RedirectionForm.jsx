import { useEffect, useState } from 'preact/hooks';

export default function RedirectionForm(props) {
  const id = props?.id;
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    from: '',
    to: '',
  });

  useEffect(() => {
    if (!isEdit) return;
    loadRedirection();
  }, [id]);

  const loadRedirection = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/redirections/${id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'No se ha podido cargar la redirección');
      }

      setFormData({
        name: data.data.name || '',
        from: data.data.from || '',
        to: data.data.to || '',
      });
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const endpoint = isEdit ? `/api/redirections/${id}` : '/api/redirections';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'No se han podido guardar los cambios');
      }

      if (isEdit) {
        setSuccess('Redirección actualizada correctamente');
      } else {
        window.location.href = '/admin/redirections';
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main class="main-content">
        <p class="loading">Cargando redirección...</p>
      </main>
    );
  }

  return (
    <main class="main-content">
      <div class="content-header">
        <div>
          <h1>{isEdit ? 'Editar redirección' : 'Nueva redirección'}</h1>
          <p class="section-description">Define el origen y destino de la redirección.</p>
        </div>
        <a href="/admin/redirections" class="btn btn-primary">Volver</a>
      </div>

      {error && (
        <div class="error-message">
          <p>⚠️ {error}</p>
        </div>
      )}

      {success && (
        <div class="success-message">
          <p>{success}</p>
        </div>
      )}

      <form class="page-editor-form" onSubmit={handleSubmit}>
        <div class="form-group">
          <label for="redirection-name">Nombre identificativo</label>
          <input
            id="redirection-name"
            name="name"
            type="text"
            value={formData.name}
            onInput={handleChange}
            placeholder="Campaña primavera 2026"
            required
          />
        </div>

        <div class="form-group">
          <label for="redirection-from">URL de partida</label>
          <input
            id="redirection-from"
            name="from"
            type="text"
            value={formData.from}
            onInput={handleChange}
            placeholder="/promo-primavera"
            required
          />
        </div>

        <div class="form-group">
          <label for="redirection-to">URL de llegada</label>
          <input
            id="redirection-to"
            name="to"
            type="text"
            value={formData.to}
            onInput={handleChange}
            placeholder="/portfolio/nueva-campana"
            required
          />
        </div>

        <div class="modal-actions">
          <button type="submit" class="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear redirección'}
          </button>
        </div>
      </form>
    </main>
  );
}
