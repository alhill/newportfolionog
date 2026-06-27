import { useState } from 'preact/hooks';
import { OG_TYPES, TWITTER_CARD_TYPES } from '../../lib/project-seo';

export default function ProjectSeoSection({ seo, onChange, onAutoFill }) {
  const [open, setOpen] = useState(false);

  const handleAutoFillClick = (e) => {
    e.stopPropagation();
    onAutoFill?.();
    setOpen(true);
  };

  return (
    <div class={`form-section seo-section ${open ? 'is-open' : ''}`}>
      <div class="seo-section-header">
        <button
          type="button"
          class="seo-section-toggle"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <svg
            class={`seo-chevron ${open ? 'is-open' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <h2>SEO</h2>
        </button>
        <button type="button" class="btn-secondary seo-auto-fill-btn" onClick={handleAutoFillClick}>
          Generar SEO automáticamente
        </button>
      </div>

      <div class={`seo-section-content ${open ? 'is-open' : ''}`}>
        <div class="seo-section-inner">
          <div class="form-group">
            <label for="seoMetaTitle">Meta title</label>
            <input
              type="text"
              id="seoMetaTitle"
              name="metaTitle"
              value={seo.metaTitle}
              onInput={onChange}
            />
          </div>

          <div class="form-group">
            <label for="seoMetaDescription">Meta description</label>
            <textarea
              id="seoMetaDescription"
              name="metaDescription"
              rows="3"
              value={seo.metaDescription}
              onInput={onChange}
            />
          </div>

          <div class="form-group">
            <label for="seoCanonicalPath">Canonical (ruta o URL)</label>
            <input
              type="text"
              id="seoCanonicalPath"
              name="canonicalPath"
              value={seo.canonicalPath}
              onInput={onChange}
              placeholder="/portfolio/mi-proyecto"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="seoOgTitle">OG title</label>
              <input
                type="text"
                id="seoOgTitle"
                name="ogTitle"
                value={seo.ogTitle}
                onInput={onChange}
              />
            </div>
            <div class="form-group">
              <label for="seoOgType">OG type</label>
              <select
                id="seoOgType"
                name="ogType"
                value={seo.ogType}
                onChange={onChange}
              >
                {OG_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="seoOgDescription">OG description</label>
            <textarea
              id="seoOgDescription"
              name="ogDescription"
              rows="3"
              value={seo.ogDescription}
              onInput={onChange}
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="seoOgImage">OG image</label>
              <input
                type="url"
                id="seoOgImage"
                name="ogImage"
                value={seo.ogImage}
                onInput={onChange}
                placeholder="https://..."
              />
            </div>
            <div class="form-group">
              <label for="seoTwitterCard">Twitter card</label>
              <select
                id="seoTwitterCard"
                name="twitterCard"
                value={seo.twitterCard}
                onChange={onChange}
              >
                {TWITTER_CARD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="noIndex"
                  checked={seo.noIndex}
                  onChange={onChange}
                />
                No index
              </label>
            </div>
            <div class="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="noFollow"
                  checked={seo.noFollow}
                  onChange={onChange}
                />
                No follow
              </label>
            </div>
          </div>

          <div class="form-group">
            <label for="seoJsonLd">JSON-LD</label>
            <textarea
              id="seoJsonLd"
              name="jsonLd"
              rows="6"
              value={seo.jsonLd}
              onInput={onChange}
              placeholder='{"@context":"https://schema.org","@type":"CreativeWork"}'
            />
          </div>
        </div>
      </div>
    </div>
  );
}
