import { useState, useEffect, useRef } from 'preact/hooks';

export default function MediaPicker({ isOpen, onClose, onSelect, allowedTypes = ['image', 'video', 'pdf', 'audio'] }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [previewAlt, setPreviewAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('gallery'); // 'gallery' or 'upload'
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadMedia();
    }
  }, [page, isOpen]);

  const loadMedia = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/media?page=${page}&limit=20`);
      const data = await response.json();

      if (data.success) {
        setMedia(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('El archivo es demasiado grande (máx 50MB)');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadPreview({
        file,
        preview: reader.result,
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
        const data = await response.json();
        setUploadPreview(null);
        setPreviewAlt('');
        
        // Seleccionar automáticamente el medio recién subido
        if (data.data) {
          onSelect(data.data.uri, data.data);
          onClose();
        }
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

  const selectMedia = (mediaItem) => {
    onSelect(mediaItem.uri, mediaItem);
    onClose();
  };

  const filteredMedia = media.filter(item => allowedTypes.includes(item.type));

  if (!isOpen) return null;

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal-content media-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Seleccionar Medio</h2>
          <button onClick={onClose} class="btn-close">✕</button>
        </div>

        <div class="modal-tabs">
          <button 
            class={`tab ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            Galería
          </button>
          <button 
            class={`tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Subir Nuevo
          </button>
        </div>

        <div class="modal-body">
          {activeTab === 'gallery' && (
            <>
              {loading ? (
                <p>Cargando medios...</p>
              ) : filteredMedia.length === 0 ? (
                <p class="empty">No hay medios disponibles. Sube uno nuevo en la pestaña "Subir Nuevo".</p>
              ) : (
                <div class="media-picker-grid">
                  {filteredMedia.map((item) => (
                    <div 
                      key={item.id} 
                      class="media-picker-item"
                      onClick={() => selectMedia(item)}
                    >
                      {item.type === 'image' && (
                        <img src={item.uri} alt={item.alt || ''} />
                      )}
                      {item.type === 'video' && (
                        <div class="media-icon">🎬</div>
                      )}
                      {item.type === 'pdf' && (
                        <div class="media-icon">📄</div>
                      )}
                      {item.type === 'audio' && (
                        <div class="media-icon">🎵</div>
                      )}
                      <div class="media-picker-overlay">
                        <span>Seleccionar</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {pagination && pagination.totalPages > 1 && (
                <div class="pagination">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={!pagination.hasPrev}
                    class="btn-secondary"
                  >
                    ← Anterior
                  </button>
                  <span class="page-info">
                    Página {pagination.page} de {pagination.totalPages}
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
            </>
          )}

          {activeTab === 'upload' && (
            <div class="upload-section">
              {!uploadPreview ? (
                <div class="upload-area">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,video/*,audio/*,.pdf"
                    style={{ display: 'none' }}
                    id="mediaPickerFileInput"
                  />
                  <label for="mediaPickerFileInput" class="upload-trigger">
                    <div class="upload-icon">📁</div>
                    <p>Haz clic para seleccionar un archivo</p>
                    <small>Máx. 50MB - Imágenes, videos, audio o PDF</small>
                  </label>
                </div>
              ) : (
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
                      {uploading ? 'Subiendo...' : 'Subir y Seleccionar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
