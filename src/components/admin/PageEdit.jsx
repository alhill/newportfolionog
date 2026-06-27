import { useEffect, useRef, useState } from 'preact/hooks';

const emptySeo = {
  metaTitle: '',
  metaDescription: '',
  canonicalPath: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  noIndex: false,
  noFollow: false,
  jsonLd: '',
};

const emptyPageForm = {
  title: '',
  subtitle: '',
  content: '',
  ctaText: '',
  ctaUrl: '',
  published: false,
  seo: emptySeo,
};

function buildSeoData(rawSeo = {}) {
  return {
    ...emptySeo,
    ...rawSeo,
    noIndex: Boolean(rawSeo.noIndex),
    noFollow: Boolean(rawSeo.noFollow),
  };
}

function SeoFields({ seo, onChange }) {
  return (
    <div class="form-section">
      <h2>SEO</h2>

      <div class="form-group">
        <label for="seo-meta-title">Meta title</label>
        <input
          id="seo-meta-title"
          name="metaTitle"
          value={seo.metaTitle}
          onInput={onChange}
          placeholder="Título SEO específico"
        />
      </div>

      <div class="form-group">
        <label for="seo-meta-description">Meta description</label>
        <textarea
          id="seo-meta-description"
          name="metaDescription"
          rows="3"
          value={seo.metaDescription}
          onInput={onChange}
          placeholder="Descripción para buscadores"
        />
      </div>

      <div class="form-group">
        <label for="seo-canonical">Canonical (ruta o URL completa)</label>
        <input
          id="seo-canonical"
          name="canonicalPath"
          value={seo.canonicalPath}
          onInput={onChange}
          placeholder="/sobre-mi"
        />
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label for="seo-og-title">OG title</label>
          <input
            id="seo-og-title"
            name="ogTitle"
            value={seo.ogTitle}
            onInput={onChange}
          />
        </div>
        <div class="form-group">
          <label for="seo-og-type">OG type</label>
          <input
            id="seo-og-type"
            name="ogType"
            value={seo.ogType}
            onInput={onChange}
            placeholder="website"
          />
        </div>
      </div>

      <div class="form-group">
        <label for="seo-og-description">OG description</label>
        <textarea
          id="seo-og-description"
          name="ogDescription"
          rows="3"
          value={seo.ogDescription}
          onInput={onChange}
        />
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label for="seo-og-image">OG image (URL)</label>
          <input
            id="seo-og-image"
            name="ogImage"
            value={seo.ogImage}
            onInput={onChange}
            placeholder="https://..."
          />
        </div>
        <div class="form-group">
          <label for="seo-twitter-card">Twitter card</label>
          <input
            id="seo-twitter-card"
            name="twitterCard"
            value={seo.twitterCard}
            onInput={onChange}
            placeholder="summary_large_image"
          />
        </div>
      </div>

      <div class="form-group checkbox-group">
        <label>
          <input type="checkbox" name="noIndex" checked={seo.noIndex} onChange={onChange} />
          No index
        </label>
        <label>
          <input type="checkbox" name="noFollow" checked={seo.noFollow} onChange={onChange} />
          No follow
        </label>
      </div>

      <div class="form-group">
        <label for="seo-jsonld">JSON-LD</label>
        <textarea
          id="seo-jsonld"
          name="jsonLd"
          rows="6"
          value={seo.jsonLd}
          onInput={onChange}
          placeholder='{"@context":"https://schema.org","@type":"WebPage"}'
        />
        <small>Introduce JSON valido. Se inyecta como script application/ld+json.</small>
      </div>
    </div>
  );
}

export default function PageEdit({ id }) {
  const isGlobalSeo = id === 'global-seo';
  const contentEditorRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formData, setFormData] = useState(emptyPageForm);

  useEffect(() => {
    loadPage();
  }, [id]);

  const loadPage = async () => {
    try {
      const response = await fetch(`/api/pages/${id}`);
      const data = await response.json();

      if (data.success) {
        const seoData = buildSeoData(data.data.seo);

        if (isGlobalSeo) {
          setFormData({ ...emptyPageForm, seo: seoData });
        } else {
          const nextFormData = {
            title: data.data.title || '',
            subtitle: data.data.subtitle || '',
            content: data.data.content || '',
            ctaText: data.data.ctaText || '',
            ctaUrl: data.data.ctaUrl || '',
            published: Boolean(data.data.published),
            seo: seoData,
          };
          setFormData(nextFormData);

          if (contentEditorRef.current) {
            contentEditorRef.current.innerHTML = nextFormData.content;
          }
        }
      } else {
        setError(data.error || 'No se ha podido cargar la página');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSeoChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      seo: {
        ...prev.seo,
        [name]: type === 'checkbox' ? checked : value,
      },
    }));
  };

  const syncEditorToState = () => {
    if (!contentEditorRef.current) return;
    const html = contentEditorRef.current.innerHTML;
    setFormData((prev) => ({
      ...prev,
      content: html,
    }));
  };

  const execEditorCommand = (command, value = null) => {
    if (!contentEditorRef.current) return;
    contentEditorRef.current.focus();
    document.execCommand(command, false, value);
    syncEditorToState();
  };

  const addLink = () => {
    const url = window.prompt('Introduce la URL del enlace (https://...)');
    if (!url) return;
    execEditorCommand('createLink', url);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = isGlobalSeo
      ? { seo: formData.seo }
      : {
          title: formData.title,
          subtitle: formData.subtitle,
          content: formData.content,
          ctaText: formData.ctaText,
          ctaUrl: formData.ctaUrl,
          published: formData.published,
          seo: formData.seo,
        };

    try {
      const response = await fetch(`/api/pages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'No se ha podido guardar la página');
      }

      setSuccess(isGlobalSeo ? 'SEO global guardado correctamente' : 'Página guardada correctamente');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main class="main-content">
        <p class="loading">Cargando página...</p>
      </main>
    );
  }

  return (
    <main class="main-content">
      <div class="content-header">
        <div>
          <h1>{isGlobalSeo ? 'SEO global' : 'Editar página'}</h1>
          <p class="section-description">
            {isGlobalSeo
              ? 'Valores por defecto de SEO para todo el sitio. Las páginas y proyectos pueden sobreescribirlos.'
              : `Edita los textos y enlaces de la página ${id}.`}
          </p>
        </div>
        <a href="/admin/pages" class="btn btn-primary">Volver</a>
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
        {!isGlobalSeo && (
          <>
            <div class="form-group">
              <label for="page-title">Título</label>
              <input id="page-title" name="title" value={formData.title} onInput={handleChange} />
            </div>

            <div class="form-group">
              <label for="page-subtitle">Subtítulo</label>
              <input id="page-subtitle" name="subtitle" value={formData.subtitle} onInput={handleChange} />
            </div>

            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" name="published" checked={formData.published} onChange={handleChange} />
                Publicada
              </label>
            </div>

            <div class="form-group">
              <label for="page-content">Contenido (WYSIWYG)</label>
              <div class="wysiwyg-toolbar" role="toolbar" aria-label="Herramientas de formato">
                <button type="button" class="btn btn-sm" onClick={() => execEditorCommand('bold')}><strong>B</strong></button>
                <button type="button" class="btn btn-sm" onClick={() => execEditorCommand('italic')}><em>I</em></button>
                <button type="button" class="btn btn-sm" onClick={addLink}>Enlace</button>
                <button type="button" class="btn btn-sm" onClick={() => execEditorCommand('unlink')}>Quitar enlace</button>
                <button type="button" class="btn btn-sm" onClick={() => execEditorCommand('insertUnorderedList')}>Lista</button>
              </div>
              <div
                id="page-content"
                ref={contentEditorRef}
                class="wysiwyg-editor"
                contentEditable
                suppressContentEditableWarning
                onInput={syncEditorToState}
                dangerouslySetInnerHTML={{ __html: formData.content }}
              />
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label for="page-cta-text">Texto CTA</label>
                <input id="page-cta-text" name="ctaText" value={formData.ctaText} onInput={handleChange} />
              </div>
              <div class="form-group">
                <label for="page-cta-url">URL CTA</label>
                <input id="page-cta-url" name="ctaUrl" value={formData.ctaUrl} onInput={handleChange} />
              </div>
            </div>
          </>
        )}

        <SeoFields seo={formData.seo} onChange={handleSeoChange} />

        <div class="modal-actions">
          <button type="submit" class="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </main>
  );
}
