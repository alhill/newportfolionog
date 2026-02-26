import { useState, useEffect } from 'preact/hooks';

export default function ProjectsList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const [layoutSettings, setLayoutSettings] = useState({ width: 1, height: 1 });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects?limit=100');
      const data = await response.json();
      
      if (data.success) {
        setProjects(data.data);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const openLayoutModal = (project) => {
    setCurrentProject(project);
    setLayoutSettings({
      width: project.width || 1,
      height: project.height || 1,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setCurrentProject(null);
  };

  const updateLayout = async () => {
    if (!currentProject) return;

    try {
      const response = await fetch(`/api/projects/${currentProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          width: layoutSettings.width,
          height: layoutSettings.height,
        }),
      });

      if (response.ok) {
        await loadProjects();
        closeModal();
      }
    } catch (error) {
      console.error('Error actualizando layout:', error);
    }
  };

  const goToEdit = () => {
    if (currentProject) {
      window.location.href = `/admin/projects/${currentProject.id}`;
    }
  };

  return (
    <main class="main-content">
      <div class="content-header">
        <h1>Gestión de Proyectos</h1>
        <a href="/admin/projects/new" class="btn btn-primary">+ Nuevo Proyecto</a>
      </div>

      {error && (
        <div class="error-message">
          <p>⚠️ Error al cargar proyectos: {error}</p>
        </div>
      )}

      {loading ? (
        <p class="loading">Cargando proyectos...</p>
      ) : (
        <section class="projects-grid-admin">
          {projects.length === 0 ? (
            <p class="empty">No hay proyectos. <a href="/admin/projects/new">Crear el primero</a></p>
          ) : (
            projects.map(project => (
              <article
                key={project.id}
                class="project-card-admin project-card-admin--flat"
                data-width={project.width || 1}
                data-height={project.height || 1}
                onClick={() => openLayoutModal(project)}
              >
                <div class="project-preview" style={`background-image: url(${project.thumb})`}>
                  <div class="overlay"></div>
                  <h2 class="project-title">{project.title}</h2>
                </div>
              </article>
            ))
          )}
        </section>
      )}

      {/* Modal para editar propiedades de layout */}
      {modalOpen && (
        <div class="modal projects-layout-modal" onClick={closeModal}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h2>Configurar Layout - {currentProject?.title}</h2>
              <button onClick={closeModal} class="close-btn">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Anchura (columnas)</label>
                <div class="button-group">
                  {[1, 2, 3, 4].map(w => (
                    <button
                      key={w}
                      class={`width-btn ${layoutSettings.width === w ? 'active' : ''}`}
                      onClick={() => setLayoutSettings(prev => ({ ...prev, width: w }))}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              <div class="form-group">
                <label>Altura (filas)</label>
                <div class="button-group">
                  {[1, 2].map(h => (
                    <button
                      key={h}
                      class={`height-btn ${layoutSettings.height === h ? 'active' : ''}`}
                      onClick={() => setLayoutSettings(prev => ({ ...prev, height: h }))}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              <div class="modal-actions">
                <button onClick={updateLayout} class="btn btn-layout-light">
                  Guardar Layout
                </button>
                <button onClick={goToEdit} class="btn btn-layout-light">
                  Editar detalles del proyecto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
