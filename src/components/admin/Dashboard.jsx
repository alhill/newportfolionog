import { useState, useEffect, useRef } from 'preact/hooks';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProjects: 0,
    featuredProjects: 0,
    totalCategories: 0,
  });
  const [recentProjects, setRecentProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    loadStats();
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadStats = async () => {
    try {
      // Cargar proyectos
      const projectsResponse = await fetch('/api/projects?limit=100');
      const projectsData = await projectsResponse.json();

      if (projectsData.success && mountedRef.current) {
        const projects = projectsData.data;
        const featured = projects.filter(p => p.featured).length;
        
        setStats(prev => ({
          ...prev,
          totalProjects: projects.length,
          featuredProjects: featured,
        }));
        
        setRecentProjects(projects.slice(0, 5));
      }

      // Cargar categorías
      const categoriesResponse = await fetch('/api/projects/categories');
      const categoriesData = await categoriesResponse.json();

      if (categoriesData.success && mountedRef.current) {
        setStats(prev => ({
          ...prev,
          totalCategories: categoriesData.data.length,
        }));
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <main class="main-content">
      <header class="content-header">
        <h1>Dashboard</h1>
      </header>

      <div class="dashboard-grid">
        {/* Tarjetas de estadísticas */}
        <div class="stat-card">
          <div class="stat-icon projects">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
          </div>
          <div class="stat-info">
            <p class="stat-label">Total Proyectos</p>
            <p class="stat-value">{stats.totalProjects}</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon featured">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </div>
          <div class="stat-info">
            <p class="stat-label">Destacados</p>
            <p class="stat-value">{stats.featuredProjects}</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon categories">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </div>
          <div class="stat-info">
            <p class="stat-label">Categorías</p>
            <p class="stat-value">{stats.totalCategories}</p>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div class="quick-actions-section">
          <h2>Acciones Rápidas</h2>
          <div class="action-buttons">
            <a href="/admin/projects/new" class="action-btn primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Nuevo Proyecto
            </a>
            <a href="/admin/projects" class="action-btn secondary">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              Gestión Visual
            </a>
          </div>
        </div>

        {/* Proyectos recientes */}
        <div class="recent-projects-section">
          <h2>Proyectos Recientes</h2>
          <div class="recent-projects-list">
            {loading ? (
              <p class="loading">Cargando...</p>
            ) : recentProjects.length === 0 ? (
              <p class="empty">No hay proyectos recientes</p>
            ) : (
              recentProjects.map(project => (
                <div key={project.id} class="recent-project-item">
                  <img src={project.thumb} alt={project.title} class="recent-thumb" />
                  <div class="recent-info">
                    <h3>{project.title}</h3>
                    <span class="recent-category">{project.category}</span>
                  </div>
                  <a href={`/admin/projects/${project.id}`} class="recent-action">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M5 12h14"></path>
                      <path d="m12 5 7 7-7 7"></path>
                    </svg>
                  </a>
                </div>
              ))
            )}
          </div>
          <a href="/admin/projects" class="view-all-link">Ver todos los proyectos →</a>
        </div>
      </div>
    </main>
  );
}
