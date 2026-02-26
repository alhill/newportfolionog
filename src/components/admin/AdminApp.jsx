import { Router } from 'preact-router';
import { useState } from 'preact/hooks';
import { initAuth } from './store';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import ProjectsList from './ProjectsList';
import ProjectCreate from './ProjectCreate';
import ProjectEdit from './ProjectEdit';

export default function AdminApp({ userData }) {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Inicializar auth con los datos del usuario
  initAuth(userData);

  const handleRoute = (e) => {
    setCurrentPath(e.url);
  };

  return (
    <div class="admin-layout">
      <Sidebar currentPath={currentPath} />
      
      <Router onChange={handleRoute}>
        <Dashboard path="/admin" />
        <ProjectsList path="/admin/projects" />
        <ProjectCreate path="/admin/projects/new" />
        <ProjectEdit path="/admin/projects/:id" />
        {/* Placeholder para futuras rutas */}
        <div path="/admin/media" default>
          <main class="main-content">
            <div class="content-header">
              <h1>Medios</h1>
            </div>
            <p>Sección en desarrollo</p>
          </main>
        </div>
        <div path="/admin/pages">
          <main class="main-content">
            <div class="content-header">
              <h1>Páginas</h1>
            </div>
            <p>Sección en desarrollo</p>
          </main>
        </div>
        <div path="/admin/settings">
          <main class="main-content">
            <div class="content-header">
              <h1>Configuración</h1>
            </div>
            <p>Sección en desarrollo</p>
          </main>
        </div>
      </Router>
    </div>
  );
}
