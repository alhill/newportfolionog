import { user, logout } from './store';

export default function Sidebar({ currentPath }) {
  const isActive = (path) => currentPath === path;

  return (
    <aside class="sidebar">
      <div class="sidebar-header">
        <a href="/admin" class="logo">
          <img src="https://srtanognog.com/wp-content/uploads/2019/08/srtanognogsolo.png" alt="Logo" />
        </a>
      </div>

      {/* Usuario */}
      <div class="user-section">
        <div class="user-avatar">
          <span>{user.value?.email?.[0].toUpperCase()}</span>
        </div>
        <div class="user-details">
          <p class="user-email">{user.value?.email}</p>
          <span class="user-role">Administrador</span>
        </div>
      </div>

      {/* Menú de navegación */}
      <nav class="sidebar-nav">
        <a href="/admin" class={`nav-item ${isActive('/admin') ? 'active' : ''}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Dashboard</span>
        </a>

        <a href="/admin/projects" class={`nav-item ${isActive('/admin/projects') ? 'active' : ''}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          <span>Proyectos</span>
        </a>

        <a href="/admin/media" class={`nav-item ${isActive('/admin/media') ? 'active' : ''}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span>Medios</span>
        </a>

        <a href="/admin/pages" class={`nav-item ${isActive('/admin/pages') ? 'active' : ''}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span>Páginas</span>
        </a>

        <a href="/admin/settings" class={`nav-item ${isActive('/admin/settings') ? 'active' : ''}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6m4.22-13c-.78.78-1.05 1.95-.65 2.93m0 0L21 3m-5.43-.57a4 4 0 0 1 0 5.66m0-5.66L21 3m-5.43 5.43a4 4 0 0 1-5.66 0m5.66 0L21 3M3 21l2.57-5.43m0 0a4 4 0 0 1 5.66 0m-5.66 0L3 21m5.43-5.43a4 4 0 0 1 0-5.66m0 5.66L3 21"></path>
          </svg>
          <span>Configuración</span>
        </a>

        <button onClick={logout} class="nav-item logout-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Cerrar sesión</span>
        </button>
      </nav>
    </aside>
  );
}
