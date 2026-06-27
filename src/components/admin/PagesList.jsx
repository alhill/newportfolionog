import { useState, useEffect } from 'preact/hooks';

export default function PagesList() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      const response = await fetch('/api/pages');
      const data = await response.json();
      if (data.success) {
        setPages(data.data);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <main class="main-content">
      <div class="content-header">
        <h1>Páginas del sitio</h1>
      </div>

      {error && (
        <div class="error-message">
          <p>⚠️ Error al cargar páginas: {error}</p>
        </div>
      )}

      {loading ? (
        <p class="loading">Cargando páginas...</p>
      ) : (
        <div class="table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Página</th>
                <th>URL</th>
                <th>Estado</th>
                <th>Última edición</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id}>
                  <td class="page-title-cell">
                    <strong>{page.title}</strong>
                    {page.description && (
                      <span class="page-description">{page.description}</span>
                    )}
                  </td>
                  <td>
                    {page.url ? (
                      <a href={page.url} target="_blank" rel="noopener noreferrer" class="page-url-link">
                        {page.url}
                      </a>
                    ) : (
                      <span>Configuración global</span>
                    )}
                  </td>
                  <td>
                    <span class={`status-badge ${page.published ? 'status-published' : 'status-draft'}`}>
                      {page.published ? 'Publicada' : 'Borrador'}
                    </span>
                  </td>
                  <td class="date-cell">{formatDate(page.updatedAt)}</td>
                  <td>
                    <a href={`/admin/pages/${page.id}`} class="btn btn-sm btn-primary">
                      Editar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
