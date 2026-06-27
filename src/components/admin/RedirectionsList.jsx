import { useEffect, useState } from 'preact/hooks';

export default function RedirectionsList() {
  const [redirections, setRedirections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadRedirections();
  }, []);

  const loadRedirections = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/redirections');
      const data = await response.json();

      if (data.success) {
        setRedirections(data.data);
      } else {
        setError(data.error || 'No se han podido cargar las redirecciones');
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

  const openDeleteModal = (item) => {
    setCurrentItem(item);
    setConfirmOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setConfirmOpen(false);
    setCurrentItem(null);
  };

  const deleteRedirection = async () => {
    if (!currentItem) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/redirections/${currentItem.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'No se ha podido borrar la redirección');
      }

      closeDeleteModal();
      await loadRedirections();
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  };

  return (
    <main class="main-content">
      <div class="content-header">
        <h1>Redirecciones</h1>
        <a href="/admin/redirections/new" class="btn btn-primary">+ Nueva redirección</a>
      </div>

      {error && (
        <div class="error-message">
          <p>⚠️ {error}</p>
        </div>
      )}

      {loading ? (
        <p class="loading">Cargando redirecciones...</p>
      ) : (
        <div class="table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Desde</th>
                <th>Hacia</th>
                <th>Última edición</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {redirections.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <p class="empty">No hay redirecciones creadas</p>
                  </td>
                </tr>
              ) : (
                redirections.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>
                      <span class="page-url-link">{item.from}</span>
                    </td>
                    <td>
                      <span class="page-url-link">{item.to}</span>
                    </td>
                    <td class="date-cell">{formatDate(item.updatedAt || item.createdAt)}</td>
                    <td>
                      <div class="table-actions">
                        <a href={`/admin/redirections/${item.id}`} class="btn-icon-edit" title="Editar" aria-label="Editar redirección">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                          </svg>
                        </a>
                        <button
                          type="button"
                          class="btn-icon-delete"
                          title="Borrar"
                          aria-label="Borrar redirección"
                          onClick={() => openDeleteModal(item)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                            <path d="M10 11v6"></path>
                            <path d="M14 11v6"></path>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {confirmOpen && (
        <div class="modal" onClick={closeDeleteModal}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h2>Confirmar borrado</h2>
              <button onClick={closeDeleteModal} class="close-btn" disabled={deleting}>×</button>
            </div>
            <div class="modal-body">
              <p class="confirm-message">
                ¿Seguro que quieres borrar la redirección <strong>{currentItem?.name}</strong>? Esta acción no se puede deshacer.
              </p>
              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onClick={closeDeleteModal} disabled={deleting}>
                  Cancelar
                </button>
                <button type="button" class="btn btn-danger" onClick={deleteRedirection} disabled={deleting}>
                  {deleting ? 'Borrando...' : 'Borrar redirección'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
