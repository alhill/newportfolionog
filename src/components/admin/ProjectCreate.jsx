import { useState, useEffect } from 'preact/hooks';
import { marked } from 'marked';
import MediaPicker from './MediaPicker';

export default function ProjectCreate() {
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    cliente: '',
    campaña: '',
    agencia: '',
    papel: '',
    copy: '',
    arte: '',
    description: '',
    thumb: '',
  });
  const [mediaItems, setMediaItems] = useState([]);
  const [preview, setPreview] = useState('');
  const [galleryUrls, setGalleryUrls] = useState(['']);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState(null);
  const [mediaPickerGalleryIndex, setMediaPickerGalleryIndex] = useState(null);
  const [mediaForm, setMediaForm] = useState({
    type: '',
    width: 'full',
    uri: '',
    caption: '',
  });
  const [editingMediaIndex, setEditingMediaIndex] = useState(null);
  const [draggedMediaIndex, setDraggedMediaIndex] = useState(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2200);
    });
  };

  useEffect(() => {
    setPreview(marked.parse(formData.description));
  }, [formData.description]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: newValue,
      };
      
      // Auto-generate slug when title changes (only if slug is empty or matches old title)
      if (name === 'title' && (!prev.slug || prev.slug === generateSlugFromTitle(prev.title))) {
        updated.slug = generateSlugFromTitle(value);
      }
      
      return updated;
    });
  };

  const generateSlugFromTitle = (title) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const addMedia = () => {
    const { type, width, caption, uri } = mediaForm;

    if (!type || !width) {
      alert('Selecciona el tipo y el ancho');
      return;
    }

    if (type === 'gallery') {
      const validUrls = galleryUrls.filter(url => url.trim() !== '');
      if (validUrls.length === 0) {
        alert('Añade al menos una imagen a la galería');
        return;
      }
      const newItem = { type, images: validUrls, width, caption: caption || undefined };
      if (editingMediaIndex !== null) {
        setMediaItems(prev => prev.map((item, index) => (index === editingMediaIndex ? newItem : item)));
      } else {
        setMediaItems(prev => [...prev, newItem]);
      }
      setEditingMediaIndex(null);
      setGalleryUrls(['']);
    } else {
      const cleanUri = uri.trim();
      if (!cleanUri) {
        alert(type === 'markdown' ? 'Introduce el contenido markdown' : 'Introduce la URL del elemento');
        return;
      }
      const newItem = { type, uri: cleanUri, width, caption: caption || undefined };
      if (editingMediaIndex !== null) {
        setMediaItems(prev => prev.map((item, index) => (index === editingMediaIndex ? newItem : item)));
      } else {
        setMediaItems(prev => [...prev, newItem]);
      }
      setEditingMediaIndex(null);
    }

    setMediaForm({ type: '', width: 'full', uri: '', caption: '' });
    setMediaModalOpen(false);
  };

  const addGalleryUrl = () => {
    setGalleryUrls(prev => [...prev, '']);
  };

  const removeGalleryUrl = (index) => {
    setGalleryUrls(prev => prev.filter((_, i) => i !== index));
  };

  const updateGalleryUrl = (index, value) => {
    setGalleryUrls(prev => {
      const newUrls = [...prev];
      newUrls[index] = value;
      return newUrls;
    });
  };

  const openMediaPicker = (target, galleryIndex = null) => {
    setMediaPickerTarget(target);
    setMediaPickerGalleryIndex(galleryIndex);
    setMediaPickerOpen(true);
  };

  const handleMediaSelect = (uri, mediaData) => {
    if (mediaPickerTarget === 'thumb') {
      setFormData(prev => ({ ...prev, thumb: uri }));
    } else if (mediaPickerTarget === 'mediaUri') {
      setMediaForm(prev => ({ ...prev, uri }));
    } else if (mediaPickerTarget === 'gallery' && mediaPickerGalleryIndex !== null) {
      updateGalleryUrl(mediaPickerGalleryIndex, uri);
    }
    setMediaPickerOpen(false);
    setMediaPickerTarget(null);
    setMediaPickerGalleryIndex(null);
  };

  const removeMedia = (index) => {
    setMediaItems(prev => prev.filter((_, i) => i !== index));
    if (editingMediaIndex === index) {
      setEditingMediaIndex(null);
      setMediaForm({ type: '', width: 'full', uri: '', caption: '' });
      setGalleryUrls(['']);
      setMediaModalOpen(false);
    }
  };

  const reorderMedia = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex === null || toIndex === null) return;

    setMediaItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

    if (editingMediaIndex === fromIndex) {
      setEditingMediaIndex(toIndex);
    } else if (
      editingMediaIndex !== null &&
      fromIndex < editingMediaIndex &&
      toIndex >= editingMediaIndex
    ) {
      setEditingMediaIndex(editingMediaIndex - 1);
    } else if (
      editingMediaIndex !== null &&
      fromIndex > editingMediaIndex &&
      toIndex <= editingMediaIndex
    ) {
      setEditingMediaIndex(editingMediaIndex + 1);
    }
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDraggedMediaIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (index) => {
    reorderMedia(draggedMediaIndex, index);
    setDraggedMediaIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedMediaIndex(null);
  };

  const editMedia = (index) => {
    const item = mediaItems[index];
    if (!item) return;

    setEditingMediaIndex(index);
    setMediaForm({
      type: item.type,
      width: item.width || 'full',
      uri: item.uri || '',
      caption: item.caption || '',
    });

    if (item.type === 'gallery') {
      setGalleryUrls(item.images?.length ? [...item.images] : ['']);
    } else {
      setGalleryUrls(['']);
    }
    setMediaModalOpen(true);
  };

  const openNewMediaModal = () => {
    setEditingMediaIndex(null);
    setMediaForm({ type: '', width: 'full', uri: '', caption: '' });
    setGalleryUrls(['']);
    setMediaModalOpen(true);
  };

  const cancelEditMedia = () => {
    setEditingMediaIndex(null);
    setMediaForm({ type: '', width: 'full', uri: '', caption: '' });
    setGalleryUrls(['']);
    setMediaModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const projectData = {
      ...formData,
      media: mediaItems,
      headerImg: formData.thumb,
      category: 'General',
      order: 0,
      featured: false,
    };

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });

      if (response.ok) {
        window.location.href = '/admin/projects';
      } else {
        alert('Error al crear el proyecto');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al crear el proyecto');
    }
  };

  return (
    <main class="main-content">
      <div class="content-header">
        <div class="content-title-row">
          <a href="/admin/projects" class="title-back-link" aria-label="Volver a proyectos" title="Volver">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </a>
          <h1>Crear Nuevo Proyecto</h1>
        </div>
        <div class="header-actions">
          <button type="submit" form="project-create-form" class="btn-primary">Crear Proyecto</button>
        </div>
      </div>

      <form id="project-create-form" onSubmit={handleSubmit} class="project-form">
        <div class="form-section">
          <h2>Información Básica</h2>
          
          <div class="form-group">
            <label for="title">Título <span class="required">*</span></label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onInput={handleChange}
              required
            />
          </div>

          <div class="form-group">
            <label for="slug">Slug (URL) <span class="required">*</span></label>
            <input
              type="text"
              id="slug"
              name="slug"
              value={formData.slug}
              onInput={handleChange}
              required
              pattern="[a-z0-9-]+"
              placeholder="se-genera-automaticamente"
            />
            <small>URL amigable del proyecto. Se genera automáticamente del título pero puedes editarla. Solo minúsculas, números y guiones.</small>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="cliente">Cliente</label>
              <input
                type="text"
                id="cliente"
                name="cliente"
                value={formData.cliente}
                onInput={handleChange}
              />
            </div>

            <div class="form-group">
              <label for="campaña">Campaña</label>
              <input
                type="text"
                id="campaña"
                name="campaña"
                value={formData.campaña}
                onInput={handleChange}
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="agencia">Agencia</label>
              <input
                type="text"
                id="agencia"
                name="agencia"
                value={formData.agencia}
                onInput={handleChange}
              />
            </div>

            <div class="form-group">
              <label for="papel">Papel</label>
              <input
                type="text"
                id="papel"
                name="papel"
                value={formData.papel}
                onInput={handleChange}
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="copy">Copy</label>
              <input
                type="text"
                id="copy"
                name="copy"
                value={formData.copy}
                onInput={handleChange}
              />
            </div>

            <div class="form-group">
              <label for="arte">Arte</label>
              <input
                type="text"
                id="arte"
                name="arte"
                value={formData.arte}
                onInput={handleChange}
              />
            </div>
          </div>
        </div>

        <div class="form-section">
          <h2>Descripción</h2>
          
          <div class="form-group">
            <label for="description">Descripción (Markdown)</label>
            <textarea
              id="description"
              name="description"
              rows="10"
              value={formData.description}
              onInput={handleChange}
              placeholder="Usa markdown: **negrita**, *cursiva*, # títulos, etc."
            />
            <small>Soporta markdown básico: **negrita**, *cursiva*, [links](url), etc.</small>
          </div>

          <div class="markdown-preview">
            <button
              type="button"
              class="markdown-preview-toggle"
              onClick={() => setPreviewOpen(prev => !prev)}
              aria-expanded={previewOpen}
            >
              <span class="markdown-preview-title">Vista previa</span>
              <svg class={`markdown-chevron ${previewOpen ? 'is-open' : ''}`} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class={`markdown-preview-content ${previewOpen ? 'is-open' : ''}`}>
              <div dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          </div>
        </div>

        <div class="form-section">
          <h2>Imágenes</h2>
          
          <div class="form-group">
            <label for="thumb">Thumbnail URL</label>
            <div class="input-with-button">
              <input
                type="url"
                id="thumb"
                name="thumb"
                value={formData.thumb}
                onInput={handleChange}
                placeholder="https://..."
              />
              <button
                type="button"
                class="btn-gallery-picker"
                title="Galería"
                aria-label="Galería"
                onClick={() => openMediaPicker('thumb')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </button>
            </div>
            <small>Imagen pequeña para listados</small>
          </div>
        </div>

        <div class="form-section">
          <div class="section-header-row">
            <div>
              <h2>Contenido del Proyecto</h2>
              <p class="section-description">Añade elementos que aparecerán debajo de la descripción. Pueden ser imágenes, galerías, videos, embeds, PDFs o bloques markdown.</p>
            </div>
            <button type="button" class="btn-icon" onClick={openNewMediaModal} title="Nuevo elemento">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>

          <div id="mediaList" class="media-list">
            {mediaItems.length === 0 ? (
              <p class="empty">No hay contenido añadido</p>
            ) : (
              mediaItems.map((item, index) => (
                <div
                  key={index}
                  class={`media-item media-item--${item.width || 'full'} ${draggedMediaIndex === index ? 'is-dragging' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  title="Arrastra para reordenar"
                >
                  <div class="media-leading">
                    {(item.type === 'image' || item.type === 'gallery') && (
                      <div class="media-thumbnail">
                        <img 
                          src={item.type === 'image' ? item.uri : item.images[0]} 
                          alt="Miniatura" 
                          loading="lazy"
                        />
                      </div>
                    )}
                    <span class="media-type-badge">{item.type}</span>
                  </div>
                  <div class="media-info">
                    {item.type === 'gallery' ? (
                      <div class="media-details">
                        <span class="media-label">Galería con {item.images.length} imágenes</span>
                      </div>
                    ) : item.type === 'markdown' ? (
                      <span class="media-uri media-uri--text">{(item.uri || '').slice(0, 80)}{(item.uri || '').length > 80 ? '…' : ''}</span>
                    ) : (
                      <button type="button" class="media-uri media-uri--link" onClick={() => copyToClipboard(item.uri)} title="Copiar enlace">{item.uri}</button>
                    )}
                    {item.caption && <span class="media-caption">"{item.caption}"</span>}
                  </div>
                  <button type="button" onClick={() => editMedia(index)} class="btn-icon-edit" title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </div>
              ))
            )}
          </div>

          <div class="media-list-footer">
            <button type="button" class="btn-secondary" onClick={openNewMediaModal}>
              + Nuevo elemento
            </button>
          </div>
        </div>

        <div class="form-actions">
          <a href="/admin/projects" class="btn-secondary">Cancelar</a>
          <button type="submit" class="btn-primary">Crear Proyecto</button>
        </div>
      </form>

      <MediaPicker 
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        allowedTypes={['image', 'video', 'pdf', 'audio']}
      />

      {copyToast && (
        <div class="copy-toast">Enlace copiado en el portapapeles</div>
      )}

      {mediaModalOpen && (
        <div class="media-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) cancelEditMedia(); }}>
          <div class="media-modal">
            <div class="media-modal-header">
              <h3>{editingMediaIndex !== null ? 'Editar elemento' : 'Nuevo elemento'}</h3>
              <button type="button" class="btn-icon" onClick={cancelEditMedia} title="Cerrar">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div class="media-modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label for="mediaType">Tipo de contenido <span class="required">*</span></label>
                  <select
                    id="mediaType"
                    value={mediaForm.type}
                    onChange={(e) => setMediaForm(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="">Selecciona tipo</option>
                    <option value="image">Imagen</option>
                    <option value="gallery">Galería de imágenes</option>
                    <option value="video">Video (iframe embed)</option>
                    <option value="embed">Embed (TikTok, YouTube, etc.)</option>
                    <option value="pdf">PDF</option>
                    <option value="markdown">Markdown</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="mediaWidth">Ancho <span class="required">*</span></label>
                  <select
                    id="mediaWidth"
                    value={mediaForm.width}
                    onChange={(e) => setMediaForm(prev => ({ ...prev, width: e.target.value }))}
                  >
                    <option value="full">Ancho completo</option>
                    <option value="half">Media anchura</option>
                  </select>
                </div>
              </div>

              {mediaForm.type !== 'gallery' && mediaForm.type !== 'markdown' && (
                <div class="form-group">
                  <label for="mediaUriInput">URL <span class="required">*</span></label>
                  <div class="input-with-button">
                    <input
                      type="text"
                      id="mediaUriInput"
                      value={mediaForm.uri}
                      onInput={(e) => setMediaForm(prev => ({ ...prev, uri: e.target.value }))}
                      placeholder="https://..."
                    />
                    {mediaForm.type !== 'video' && mediaForm.type !== 'embed' && mediaForm.type !== '' && (
                      <button
                        type="button"
                        class="btn-gallery-picker"
                        title="Galería"
                        aria-label="Galería"
                        onClick={() => openMediaPicker('mediaUri')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      </button>
                    )}
                  </div>
                  <small>Para videos y embeds, usa el código iframe completo o la URL</small>
                </div>
              )}

              {mediaForm.type === 'markdown' && (
                <div class="form-group">
                  <label for="mediaMarkdownInput">Contenido Markdown <span class="required">*</span></label>
                  <textarea
                    id="mediaMarkdownInput"
                    rows="6"
                    value={mediaForm.uri}
                    onInput={(e) => setMediaForm(prev => ({ ...prev, uri: e.target.value }))}
                    placeholder="Escribe markdown para este bloque..."
                  />
                </div>
              )}

              {mediaForm.type === 'gallery' && (
                <div id="gallerySection" class="gallery-section">
                  <label>URLs de la galería <span class="required">*</span></label>
                  {galleryUrls.map((url, index) => (
                    <div key={index} class="gallery-url-row">
                      <div class="gallery-url-thumb">
                        {url ? (
                          <img src={url} alt={`Miniatura ${index + 1}`} loading="lazy" />
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <input
                        class="gallery-url-input"
                        type="url"
                        value={url}
                        onInput={(e) => updateGalleryUrl(index, e.target.value)}
                        placeholder="https://..."
                      />
                      <button
                        type="button"
                        class="btn-gallery-picker gallery-row-action"
                        title="Galería"
                        aria-label="Galería"
                        onClick={() => openMediaPicker('gallery', index)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      </button>
                      {galleryUrls.length > 1 && (
                        <button type="button" onClick={() => removeGalleryUrl(index)} class="btn-remove-small gallery-row-action">
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addGalleryUrl} class="btn-secondary-small">
                    + Añadir imagen
                  </button>
                </div>
              )}

              <div class="form-group">
                <label for="mediaCaption">Descripción (opcional)</label>
                <input
                  type="text"
                  id="mediaCaption"
                  value={mediaForm.caption}
                  onInput={(e) => setMediaForm(prev => ({ ...prev, caption: e.target.value }))}
                  placeholder="Descripción del elemento"
                />
              </div>
            </div>

            <div class="media-modal-footer">
              {editingMediaIndex !== null && (
                <button type="button" onClick={() => removeMedia(editingMediaIndex)} class="btn-danger">
                  Eliminar
                </button>
              )}
              <div class="modal-footer-actions">
                <button type="button" onClick={cancelEditMedia} class="btn-secondary">
                  Cancelar
                </button>
                <button type="button" onClick={addMedia} class="btn-primary">
                  {editingMediaIndex !== null ? 'Guardar cambios' : '+ Añadir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
