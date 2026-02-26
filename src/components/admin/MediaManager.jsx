import { useState, useEffect, useRef } from 'preact/hooks';

export default function MediaManager() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [previewAlt, setPreviewAlt] = useState('');
  const [editedAlt, setEditedAlt] = useState('');
  const [relatedProjects, setRelatedProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const fileInputRef = useRef(null);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(false);
  const initialLoadRef = useRef(false);

  // Cargar medios al montar el componente
  useEffect(() => {
    mountedRef.current = true;
    initialLoadRef.current = true;
    loadMedia();
    
    return () => {
      mountedRef.current = false;
      initialLoadRef.current = false;
    };
  }, []);

  // Recargar cuando cambia página o filtro (después de la carga inicial)
  useEffect(() => {
    if (mountedRef.current && !initialLoadRef.current) {
      loadMedia();
    }
    initialLoadRef.current = false;
  }, [page, typeFilter]);

  const loadMedia = async () => {
    if (!mountedRef.current && media.length > 0) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '24',
      });

      if (typeFilter) {
        params.append('type', typeFilter);
      }

      const response = await fetch(`/api/media?${params}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.success) {
        if (mountedRef.current) {
          setMedia(data.data);
          setPagination(data.pagination);
          retryCountRef.current = 0;
        }
      } else {
        throw new Error(data.error || 'Error al cargar medios');
      }
    } catch (error) {
      console.error('Error loading media:', error);
      if (mountedRef.current) {
        setError(error.message);
        
        // Auto-retry una vez si es el primer intento
        if (retryCountRef.current === 0) {
          retryCountRef.current++;
          setTimeout(() => {
            if (mountedRef.current) {
              loadMedia();
            }
          }, 1000);
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('El archivo es demasiado grande (máximo 50MB)');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Crear preview del archivo
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadPreview({
        file,
        preview: event.target.result,
        name: file.name,
        size: file.size,
        type: file.type,
      });
      setPreviewAlt('');
    };
    reader.readAsDataURL(file);
  };

  const cancelUpload = () => {
    setUploadPreview(null);
    setPreviewAlt('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const confirmUpload = async () => {
    if (!uploadPreview) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadPreview.file);
      if (previewAlt) formData.append('alt', previewAlt);

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert('Archivo subido correctamente');
        setUploadPreview(null);
        setPreviewAlt('');
        loadMedia();
      } else {
        const data = await response.json();
        const errorMsg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Error al subir archivo');
        alert(errorMsg);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al subir archivo: ' + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const showMediaDetails = async (mediaId) => {
    try {
      const response = await fetch(`/api/media/${mediaId}`);
      const data = await response.json();

      if (data.success) {
        setSelectedMedia(data.data);
        setEditedAlt(data.data.alt || '');
        
        // Cargar detalles de proyectos relacionados
        if (data.data.related && data.data.related.length > 0) {
          setLoadingProjects(true);
          try {
            const projectDetails = await Promise.all(
              data.data.related.map(projectId =>
                fetch(`/api/projects/${projectId}`)
                  .then(res => res.json())
                  .then(jsonData => jsonData.data)
                  .catch(() => ({ id: projectId, title: 'Proyecto desconocido' }))
              )
            );
            setRelatedProjects(projectDetails);
          } finally {
            setLoadingProjects(false);
          }
        } else {
          setRelatedProjects([]);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDelete = async (mediaId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este medio?')) {
      return;
    }

    try {
      const response = await fetch(`/api/media/${mediaId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        alert('Medio eliminado correctamente');
        setSelectedMedia(null);
        setRelatedProjects([]);
        loadMedia();
      } else {
        if (data.relatedProjects) {
          alert(`${data.error}\n\nProyectos: ${data.relatedProjects.join(', ')}`);
        } else {
          alert(data.error || 'Error al eliminar medio');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar medio');
    }
  };

  const saveAltText = async () => {
    if (!selectedMedia) return;

    try {
      const response = await fetch(`/api/media/${selectedMedia.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt: editedAlt }),
      });

      if (response.ok) {
        alert('Texto alternativo actualizado');
        loadMedia();
        setSelectedMedia({ ...selectedMedia, alt: editedAlt });
      } else {
        alert('Error al actualizar');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar');
    }
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    alert('URL copiada al portapapeles');
  };

  if (loading && media.length === 0) {
    return (
      <main class="main-content">
        <div class="loading-container">
          <p class="loading">Cargando medios...</p>
        </div>
      </main>
    );
  }

  if (error && media.length === 0) {
    return (
      <main class="main-content">
        <div class="error-container">
          <p class="error-message">⚠️ Error al cargar medios: {error}</p>
          <button onClick={() => {
            retryCountRef.current = 0;
            loadMedia();
          }} class="btn-primary">
            🔄 Reintentar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main class="main-content">
      <div class="content-header">
        <h1>Gestión de Medios</h1>
        <div class="header-actions">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            class="type-filter"
          >
            <option value="">Todos los tipos</option>
            <option value="image">Imágenes</option>
            <option value="video">Videos</option>
            <option value="pdf">PDFs</option>
            <option value="audio">Audio</option>
          </select>
          <button
            onClick={handleFileSelect}
            disabled={uploading}
            class="btn-primary"
          >
            {uploading ? 'Subiendo...' : '+ Subir Medio'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept="image/*,video/*,audio/*,.pdf"
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div class="media-container">
        <div class="media-grid">
          {media.map((item) => (
            <div
              key={item.id}
              class={`media-card media-card-${item.type}`}
              onClick={() => showMediaDetails(item.id)}
            >
              <div class="media-preview">
                {item.type === 'image' && (
                  <img src={item.uri} alt={item.alt || ''} loading="lazy" />
                )}
                {item.type === 'video' && (
                  <div class="media-icon">
                    <span>🎬</span>
                    <p>Video</p>
                  </div>
                )}
                {item.type === 'pdf' && (
                  <div class="media-icon">
                    <span>📄</span>
                    <p>PDF</p>
                  </div>
                )}
                {item.type === 'audio' && (
                  <div class="media-icon">
                    <span>🎵</span>
                    <p>Audio</p>
                  </div>
                )}
              </div>
              <div class="media-info">
                <span class="media-type-badge">{item.type}</span>
                {item.relatedCount > 0 && (
                  <span class="related-count">{item.relatedCount} uso(s)</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {pagination && (
          <div class="pagination">
            <button
              onClick={() => setPage(page - 1)}
              disabled={!pagination.hasPrev}
              class="btn-secondary"
            >
              ← Anterior
            </button>
            <span class="page-info">
              Página {pagination.page} de {pagination.totalPages} ({pagination.total} medios)
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!pagination.hasNext}
              class="btn-secondary"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {uploadPreview && (
        <div class="modal-overlay" onClick={cancelUpload}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h2>Vista previa de subida</h2>
              <button onClick={cancelUpload} class="btn-close">
                ✕
              </button>
            </div>

            <div class="modal-body">
              <div class="upload-preview-container">
                {uploadPreview.type.startsWith('image/') && (
                  <img src={uploadPreview.preview} alt="Preview" class="upload-preview-img" />
                )}
                {uploadPreview.type.startsWith('video/') && (
                  <video src={uploadPreview.preview} controls class="upload-preview-video"></video>
                )}
                {uploadPreview.type === 'application/pdf' && (
                  <div class="upload-preview-icon">
                    <span>📄</span>
                    <p>PDF</p>
                  </div>
                )}
                {uploadPreview.type.startsWith('audio/') && (
                  <div class="upload-preview-icon">
                    <span>🎵</span>
                    <p>Audio</p>
                    <audio src={uploadPreview.preview} controls class="upload-preview-audio"></audio>
                  </div>
                )}
              </div>

              <div class="upload-details">
                <div class="detail-group">
                  <label>Archivo:</label>
                  <span class="file-name">{uploadPreview.name}</span>
                </div>

                <div class="detail-group">
                  <label>Tamaño:</label>
                  <span class="file-size">
                    {(uploadPreview.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>

                <div class="detail-group">
                  <label>Tipo:</label>
                  <span>{uploadPreview.type}</span>
                </div>

                <div class="detail-group">
                  <label>Texto alternativo (opcional):</label>
                  <input
                    type="text"
                    value={previewAlt}
                    onInput={(e) => setPreviewAlt(e.target.value)}
                    placeholder="Descripción del medio"
                  />
                </div>

                <div class="upload-actions">
                  <button onClick={cancelUpload} class="btn-secondary">
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmUpload} 
                    disabled={uploading}
                    class="btn-primary"
                  >
                    {uploading ? 'Subiendo...' : 'Subir Archivo'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedMedia && (
        <div class="modal-overlay" onClick={() => {
          setSelectedMedia(null);
          setRelatedProjects([]);
        }}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h2>Detalles del Medio</h2>
              <button onClick={() => {
                setSelectedMedia(null);
                setRelatedProjects([]);
              }} class="btn-close">
                ✕
              </button>
            </div>

            <div class="modal-body">
              <div class="media-preview-large">
                {selectedMedia.type === 'image' && (
                  <img src={selectedMedia.uri} alt={selectedMedia.alt || ''} />
                )}
                {selectedMedia.type === 'video' && (
                  <video src={selectedMedia.uri} controls></video>
                )}
                {selectedMedia.type === 'pdf' && (
                  <iframe src={selectedMedia.uri} frameborder="0"></iframe>
                )}
                {selectedMedia.type === 'audio' && (
                  <audio src={selectedMedia.uri} controls></audio>
                )}
              </div>

              <div class="media-details">
                <div class="detail-group">
                  <label>Tipo:</label>
                  <span>{selectedMedia.type}</span>
                </div>

                <div class="detail-group">
                  <label>URL:</label>
                  <div class="url-group">
                    <input
                      type="text"
                      value={selectedMedia.uri}
                      readOnly
                      class="url-input"
                    />
                    <button onClick={() => copyUrl(selectedMedia.uri)} class="btn-secondary-small">
                      Copiar
                    </button>
                  </div>
                </div>

                <div class="detail-group">
                  <label>Texto alternativo:</label>
                  <input
                    type="text"
                    value={editedAlt}
                    onInput={(e) => setEditedAlt(e.target.value)}
                    placeholder="Sin texto alternativo"
                  />
                </div>

                <div class="detail-group">
                  <label>Usado en:</label>
                  {loadingProjects ? (
                    <span>Cargando proyectos...</span>
                  ) : relatedProjects.length > 0 ? (
                    <div class="related-projects-list">
                      {relatedProjects.map((project) => (
                        <div key={project.id} class="related-project-item">
                          <span class="project-title">{project.title}</span>
                          {project.cliente && <span class="project-client">{project.cliente}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span>No está siendo usado en ningún proyecto</span>
                  )}
                </div>

                <div class="modal-actions">
                  <button
                    onClick={saveAltText}
                    class="btn-primary"
                  >
                    Guardar Cambios
                  </button>
                  <button
                    onClick={() => handleDelete(selectedMedia.id)}
                    class="btn-danger"
                  >
                    Eliminar Medio
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
