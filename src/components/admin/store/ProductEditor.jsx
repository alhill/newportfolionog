import { useEffect, useState } from 'preact/hooks';
import MediaPicker from '../MediaPicker';
import { validateProductForm } from '../../../lib/store/product-form';
import { storeApi } from './api';
import ProductPicker from './ProductPicker';

const VALIDATION_MESSAGE = 'Revisa los campos marcados.';

function attributesToText(attributes = {}) {
  return Object.entries(attributes).map(([key, value]) => `${key}: ${value}`).join('\n');
}

function textToAttributes(text) {
  const attributes = {};
  for (const line of String(text || '').split('\n')) {
    const index = line.indexOf(':');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key && value) attributes[key] = value;
  }
  return attributes;
}

function blankVariant() {
  return {
    id: '',
    sku: '',
    attributesText: '',
    stock: 0,
    expectedStock: 0,
    priceInherited: false,
    priceEuros: '',
    isActive: true,
  };
}

function blankProduct() {
  return {
    name: '',
    slug: '',
    description: '',
    priceEuros: '',
    isActive: true,
    featured: false,
    categoryId: '',
    brandId: '',
    collectionIds: [],
    groupId: '',
    attributesText: '',
    seoTitle: '',
    seoDescription: '',
    images: [],
    hasVariants: false,
    sku: '',
    stock: 0,
    expectedStock: 0,
  };
}

function Field({ id, label, required = false, error = '', hint = '', action = null, children }) {
  return (
    <div class={`form-group${error ? ' has-error' : ''}`}>
      <div class="store-label-row">
        <label for={id}>
          {label}
          {required ? <span class="required"> *</span> : null}
        </label>
        {action}
      </div>
      {children}
      {error ? <small class="store-field-error">{error}</small> : hint ? <small>{hint}</small> : null}
    </div>
  );
}

function GalleryIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
  );
}

export default function ProductEditor({ productId = '' }) {
  const isNew = !productId;
  const [product, setProduct] = useState(blankProduct());
  const [variants, setVariants] = useState([blankVariant()]);
  const [related, setRelated] = useState([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [converting, setConverting] = useState(false);
  const [catalog, setCatalog] = useState({ categories: [], brands: [], collections: [] });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [picker, setPicker] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);

  const sellingVariants = isNew ? hasVariants : (hasVariants || converting);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [categories, brands, collections, current] = await Promise.all([
          storeApi('/api/store/resources/categories'),
          storeApi('/api/store/resources/brands'),
          storeApi('/api/store/resources/collections'),
          isNew ? Promise.resolve(null) : storeApi(`/api/store/products/${productId}`),
        ]);
        if (cancelled) return;
        setCatalog({
          categories: categories.data || [],
          brands: brands.data || [],
          collections: collections.data || [],
        });
        if (current?.data) {
          const data = current.data;
          setHasVariants(data.hasVariants);
          setProduct({
            name: data.name || '',
            slug: data.slug || '',
            description: data.description || '',
            priceEuros: data.priceEuros ?? '',
            isActive: data.isActive !== false,
            featured: data.featured === true,
            categoryId: data.categoryId || '',
            brandId: data.brandId || '',
            collectionIds: data.collectionIds || [],
            groupId: data.groupId || '',
            attributesText: attributesToText(data.attributes),
            seoTitle: data.seoTitle || '',
            seoDescription: data.seoDescription || '',
            images: data.images?.length ? data.images : [],
            hasVariants: data.hasVariants,
            sku: data.sku || '',
            stock: data.stock ?? 0,
            expectedStock: data.expectedStock ?? data.stock ?? 0,
          });
          setVariants((data.variants || []).map((variant) => ({
            id: variant.id,
            sku: variant.sku || '',
            attributesText: attributesToText(variant.attributes),
            stock: variant.stock ?? 0,
            expectedStock: variant.expectedStock ?? variant.stock ?? 0,
            priceInherited: variant.priceInherited === true,
            priceEuros: variant.priceEuros ?? '',
            isActive: variant.isActive !== false,
          })));
          const ids = data.relatedProductIds || [];
          const relatedItems = await Promise.all(ids.map(async (relatedId) => {
            try {
              const found = await storeApi(`/api/store/products/${relatedId}`);
              const item = found.data;
              return {
                id: relatedId,
                name: item?.name || relatedId,
                imageUrl: item?.images?.[0]?.url || '',
              };
            } catch {
              return { id: relatedId, name: relatedId, imageUrl: '' };
            }
          }));
          if (cancelled) return;
          setRelated(relatedItems);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [productId, isNew]);

  const clearError = (key) => {
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setError((current) => (current === VALIDATION_MESSAGE ? '' : current));
  };

  const setField = (name, value) => {
    setProduct((current) => ({ ...current, [name]: value }));
    clearError(name);
  };

  const updateVariant = (index, patch) => {
    setVariants((current) => {
      const next = current.slice();
      next[index] = { ...next[index], ...patch };
      return next;
    });
    Object.keys(patch).forEach((field) => clearError(`variants.${index}.${field}`));
  };

  const moveImage = (from, to) => {
    setProduct((current) => {
      if (to < 0 || to >= current.images.length || from === to) return current;
      const images = current.images.slice();
      const [moved] = images.splice(from, 1);
      images.splice(to, 0, moved);
      return { ...current, images };
    });
  };

  const selectImage = (uri, media) => {
    const alt = typeof media?.alt === 'string' ? media.alt : '';
    setProduct((current) => {
      if (!picker || picker.mode === 'add') {
        return { ...current, images: [...current.images, { url: uri, alt }] };
      }
      const images = current.images.slice();
      const existing = images[picker.index];
      if (!existing) return current;
      images[picker.index] = { url: uri, alt: existing.alt || alt };
      return { ...current, images };
    });
  };

  const payload = () => ({
    name: product.name,
    slug: product.slug,
    description: product.description,
    priceEuros: product.priceEuros === '' ? 0 : Number(product.priceEuros),
    isActive: product.isActive,
    featured: product.featured,
    categoryId: product.categoryId || null,
    brandId: product.brandId || null,
    collectionIds: product.collectionIds,
    groupId: product.groupId,
    relatedProductIds: related.map((item) => item.id),
    attributes: textToAttributes(product.attributesText),
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    images: product.images.filter((image) => image.url.trim()),
    hasVariants: isNew ? hasVariants : product.hasVariants,
    sku: product.sku,
    stock: Number(product.stock),
    expectedStock: Number(product.expectedStock),
    variants: sellingVariants
      ? variants.map((variant) => ({
        id: variant.id || undefined,
        sku: variant.sku,
        attributes: textToAttributes(variant.attributesText),
        stock: Number(variant.stock),
        expectedStock: Number(variant.expectedStock),
        priceInherited: variant.priceInherited,
        priceEuros: variant.priceInherited || variant.priceEuros === '' ? null : Number(variant.priceEuros),
        isActive: variant.isActive,
      }))
      : undefined,
  });

  const showFieldErrors = (fieldErrors) => {
    setErrors(fieldErrors);
    setError(VALIDATION_MESSAGE);
    setSaving(false);
    setTimeout(() => {
      document.querySelector('.form-group.has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const fieldErrors = validateProductForm({
      name: product.name,
      slug: product.slug,
      priceEuros: product.priceEuros,
      hasVariants: sellingVariants,
      sku: product.sku,
      stock: product.stock,
      variants: sellingVariants
        ? variants.map((variant) => ({
          sku: variant.sku,
          stock: variant.stock,
          priceInherited: variant.priceInherited,
          priceEuros: variant.priceEuros,
        }))
        : [],
    });

    const skuChecks = [];
    if (sellingVariants) {
      variants.forEach((variant, index) => {
        const key = `variants.${index}.sku`;
        if (!fieldErrors[key] && variant.sku.trim()) {
          skuChecks.push({ key, sku: variant.sku.trim(), variantId: variant.id || null });
        }
      });
    } else if (!fieldErrors.sku && String(product.sku).trim()) {
      skuChecks.push({ key: 'sku', sku: String(product.sku).trim(), variantId: null });
    }

    if ((product.slug.trim() && !fieldErrors.slug) || skuChecks.length) {
      try {
        const availability = await storeApi('/api/store/products/availability', {
          method: 'POST',
          body: {
            slug: product.slug.trim() && !fieldErrors.slug ? product.slug.trim() : '',
            excludeProductId: productId || '',
            skus: skuChecks.map(({ sku, variantId }) => ({ sku, variantId })),
          },
        });
        if (availability.data?.slug) fieldErrors.slug = availability.data.slug;
        (availability.data?.skus || []).forEach((item, index) => {
          if (item?.message) fieldErrors[skuChecks[index].key] = item.message;
        });
      } catch (checkError) {
        setErrors(fieldErrors);
        setError(checkError.message);
        setSaving(false);
        return;
      }
    }

    if (Object.keys(fieldErrors).length) {
      showFieldErrors(fieldErrors);
      return;
    }

    setErrors({});
    try {
      const body = payload();
      if (!isNew && converting) {
        await storeApi(`/api/store/products/${productId}/convert`, { method: 'POST', body: { variants: body.variants } });
        window.location.reload();
        return;
      }
      const result = isNew
        ? await storeApi('/api/store/products', { method: 'POST', body })
        : await storeApi(`/api/store/products/${productId}`, { method: 'PUT', body });
      const id = result.data?.id;
      if (isNew && id) {
        window.location.href = `/admin/tienda/productos/${id}`;
        return;
      }
      window.location.reload();
    } catch (saveError) {
      const message = saveError.message || 'No se ha podido guardar';
      if (/slug/i.test(message)) setErrors((current) => ({ ...current, slug: message }));
      else if (/^El SKU /i.test(message)) setErrors((current) => ({ ...current, sku: message }));
      setError(message);
      setSaving(false);
    }
  };

  const generateSlug = async () => {
    if (!product.name.trim()) {
      setErrors((current) => ({ ...current, slug: 'Escribe el nombre para poder generar el slug' }));
      return;
    }
    setGenerating('slug');
    try {
      const result = await storeApi('/api/store/products/suggest', {
        method: 'POST',
        body: { kind: 'slug', name: product.name, excludeProductId: productId || '' },
      });
      setField('slug', result.data.value);
    } catch (generateError) {
      setErrors((current) => ({ ...current, slug: generateError.message }));
    } finally {
      setGenerating('');
    }
  };

  const generateSku = async (target) => {
    const reserved = [];
    if (sellingVariants) {
      variants.forEach((variant, index) => {
        if (target.kind === 'variant' && index === target.index) return;
        if (variant.sku.trim()) reserved.push(variant.sku.trim());
      });
    }
    const token = target.kind === 'variant' ? `variant-${target.index}` : 'sku';
    setGenerating(token);
    try {
      const result = await storeApi('/api/store/products/suggest', {
        method: 'POST',
        body: {
          kind: 'sku',
          reserved,
          excludeProductId: productId || '',
          excludeVariantId: target.kind === 'variant' ? (variants[target.index].id || '') : '',
        },
      });
      if (target.kind === 'variant') updateVariant(target.index, { sku: result.data.value });
      else setField('sku', result.data.value);
    } catch (generateError) {
      const errorKey = target.kind === 'variant' ? `variants.${target.index}.sku` : 'sku';
      setErrors((current) => ({ ...current, [errorKey]: generateError.message }));
    } finally {
      setGenerating('');
    }
  };

  const remove = async () => {
    if (!confirm('¿Eliminar este producto? Los pedidos antiguos conservan su copia.')) return;
    setSaving(true);
    try {
      await storeApi(`/api/store/products/${productId}`, { method: 'DELETE' });
      window.location.href = '/admin/tienda/productos';
    } catch (removeError) {
      setError(removeError.message);
      setSaving(false);
    }
  };

  if (loading) {
    return <main class="main-content"><p>Cargando producto…</p></main>;
  }

  return (
    <main class="main-content">
      <div class="content-header">
        <div>
          <p class="store-kicker"><a href="/admin/tienda/productos">Catálogo</a></p>
          <h1>{isNew ? 'Nuevo producto' : product.name || 'Producto'}</h1>
        </div>
        {!isNew && <button type="button" class="btn btn-danger" onClick={remove} disabled={saving}>Eliminar</button>}
      </div>

      {error && <p class="store-error">{error}</p>}

      <form class="store-form" onSubmit={save} noValidate>
        <section class="store-panel">
          <Field id="product-name" label="Nombre" required error={errors.name}>
            <input id="product-name" type="text" value={product.name} onInput={(event) => setField('name', event.currentTarget.value)} />
          </Field>
          <Field id="product-slug" label="Slug" required error={errors.slug}>
            <div class="input-with-button">
              <input id="product-slug" type="text" value={product.slug} autoComplete="off" onInput={(event) => setField('slug', event.currentTarget.value)} />
              <button type="button" class="btn-secondary-small" onClick={generateSlug} disabled={generating === 'slug' || saving}>
                {generating === 'slug' ? 'Generando…' : 'Generar'}
              </button>
            </div>
          </Field>
          <Field id="product-description" label="Descripción" error={errors.description}>
            <textarea id="product-description" rows={5} value={product.description} onInput={(event) => setField('description', event.currentTarget.value)} />
          </Field>
          <div class="store-grid-2">
            <Field
              id="product-price"
              label="Precio base (€)"
              required
              error={errors.priceEuros}
              hint="En un producto con variantes es el precio heredado, solo si la variante lo indica."
            >
              <input id="product-price" type="number" min="0" step="0.01" value={product.priceEuros} onInput={(event) => setField('priceEuros', event.currentTarget.value)} />
            </Field>
            <Field id="product-category" label="Categoría">
              <select id="product-category" value={product.categoryId} onChange={(event) => setField('categoryId', event.currentTarget.value)}>
                <option value="">Sin categoría</option>
                {catalog.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
            </Field>
          </div>
          <div class="store-grid-2">
            <Field id="product-brand" label="Marca">
              <select id="product-brand" value={product.brandId} onChange={(event) => setField('brandId', event.currentTarget.value)}>
                <option value="">Sin marca</option>
                {catalog.brands.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field id="product-group" label="ID de grupo" hint="Opcional. Relaciona modelos distintos. No crea una colección de grupos ni convierte el producto en variantes.">
              <input id="product-group" type="text" value={product.groupId} onInput={(event) => setField('groupId', event.currentTarget.value)} />
            </Field>
          </div>
          <div class="form-group">
            <label>Colecciones</label>
            <div class="store-checks">
              {catalog.collections.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={product.collectionIds.includes(item.id)}
                    onChange={(event) => {
                      const next = new Set(product.collectionIds);
                      if (event.currentTarget.checked) next.add(item.id);
                      else next.delete(item.id);
                      setField('collectionIds', [...next]);
                    }}
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </div>
          <label class="store-checkline">
            <input type="checkbox" checked={product.isActive} onChange={(event) => setField('isActive', event.currentTarget.checked)} />
            Activo en el catálogo
          </label>
          <label class="store-checkline">
            <input type="checkbox" checked={product.featured} onChange={(event) => setField('featured', event.currentTarget.checked)} />
            Destacado
          </label>
        </section>

        <section class="store-panel">
          <h2>Imágenes</h2>
          <p class="store-note">La primera es la portada. Arrastra o usa las flechas para ordenar la galería.</p>
          {product.images.length === 0 && <p class="store-note">Todavía no hay imágenes.</p>}
          {product.images.length > 0 && (
            <div class="store-image-list">
              {product.images.map((image, index) => (
                <div
                  class={`store-image-row${dragIndex === index ? ' is-dragging' : ''}`}
                  key={`${image.url}-${index}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex == null) return;
                    moveImage(dragIndex, index);
                    setDragIndex(null);
                  }}
                >
                  <button
                    type="button"
                    class="store-drag-handle"
                    draggable
                    aria-label={`Arrastrar imagen ${index + 1}`}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', String(index));
                      setDragIndex(index);
                    }}
                    onDragEnd={() => setDragIndex(null)}
                  >
                    ⋮⋮
                  </button>
                  <div class="store-image-thumb-wrap">
                    <div class="store-image-thumb">
                      {image.url ? <img src={image.url} alt="" /> : null}
                    </div>
                    <small>{index === 0 ? 'Portada' : `Posición ${index + 1}`}</small>
                  </div>
                  <div class="form-group">
                    <label for={`product-image-alt-${index}`}>Texto alternativo</label>
                    <input
                      id={`product-image-alt-${index}`}
                      type="text"
                      value={image.alt}
                      onInput={(event) => {
                        const value = event.currentTarget.value;
                        setProduct((current) => {
                          const images = current.images.slice();
                          images[index] = { ...images[index], alt: value };
                          return { ...current, images };
                        });
                      }}
                    />
                  </div>
                  <div class="store-image-actions">
                    <button type="button" class="store-icon-btn" aria-label="Subir en la galería" disabled={index === 0} onClick={() => moveImage(index, index - 1)}>↑</button>
                    <button type="button" class="store-icon-btn" aria-label="Bajar en la galería" disabled={index === product.images.length - 1} onClick={() => moveImage(index, index + 1)}>↓</button>
                    <button type="button" class="btn-gallery-picker" title="Cambiar imagen" aria-label="Cambiar imagen" onClick={() => setPicker({ mode: 'replace', index })}>
                      <GalleryIcon />
                    </button>
                    <button
                      type="button"
                      class="btn-remove-small"
                      aria-label="Quitar imagen"
                      onClick={() => setProduct((current) => ({
                        ...current,
                        images: current.images.filter((_, imageIndex) => imageIndex !== index),
                      }))}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button type="button" class="btn btn-secondary" onClick={() => setPicker({ mode: 'add' })}>Añadir imagen</button>
        </section>

        <section class="store-panel">
          <h2>Unidades vendibles</h2>
          {isNew ? (
            <label class="store-checkline">
              <input type="checkbox" checked={hasVariants} onChange={(event) => setHasVariants(event.currentTarget.checked)} />
              Este producto tiene variantes
            </label>
          ) : (
            <p class="store-note">
              {hasVariants
                ? 'El SKU y el stock están en las variantes. El producto padre no se vende.'
                : 'Producto simple: el SKU y el stock están en esta ficha.'}
            </p>
          )}

          {!sellingVariants && (
            <div class="store-grid-2">
              <Field id="product-sku" label="SKU" required error={errors.sku}>
                <div class="input-with-button">
                  <input id="product-sku" type="text" value={product.sku} autoComplete="off" onInput={(event) => setField('sku', event.currentTarget.value)} />
                  <button type="button" class="btn-secondary-small" onClick={() => generateSku({ kind: 'product' })} disabled={generating === 'sku' || saving}>
                    {generating === 'sku' ? 'Generando…' : 'Generar'}
                  </button>
                </div>
              </Field>
              <Field id="product-stock" label="Stock" required error={errors.stock}>
                <input id="product-stock" type="number" min="0" step="1" value={product.stock} onInput={(event) => setField('stock', event.currentTarget.value)} />
              </Field>
            </div>
          )}

          {!isNew && !hasVariants && !converting && (
            <button type="button" class="btn btn-secondary" onClick={() => {
              setConverting(true);
              setVariants([{
                ...blankVariant(),
                sku: product.sku,
                stock: product.stock,
                expectedStock: product.expectedStock,
                priceEuros: product.priceEuros,
                priceInherited: false,
              }]);
            }}>
              Convertir en producto con variantes
            </button>
          )}

          {errors.variants && <p class="store-field-error">{errors.variants}</p>}

          {sellingVariants && variants.map((variant, index) => (
            <div class="store-variant" key={variant.id || index}>
              <div class="store-grid-2">
                <Field id={`variant-${index}-sku`} label="SKU" required error={errors[`variants.${index}.sku`]}>
                  <div class="input-with-button">
                    <input
                      id={`variant-${index}-sku`}
                      type="text"
                      value={variant.sku}
                      autoComplete="off"
                      onInput={(event) => updateVariant(index, { sku: event.currentTarget.value })}
                    />
                    <button type="button" class="btn-secondary-small" onClick={() => generateSku({ kind: 'variant', index })} disabled={generating === `variant-${index}` || saving}>
                      {generating === `variant-${index}` ? 'Generando…' : 'Generar'}
                    </button>
                  </div>
                </Field>
                <Field id={`variant-${index}-stock`} label="Stock" required error={errors[`variants.${index}.stock`]}>
                  <input
                    id={`variant-${index}-stock`}
                    type="number"
                    min="0"
                    step="1"
                    value={variant.stock}
                    onInput={(event) => updateVariant(index, { stock: event.currentTarget.value })}
                  />
                </Field>
              </div>
              <Field id={`variant-${index}-attributes`} label="Atributos">
                <textarea
                  id={`variant-${index}-attributes`}
                  rows={3}
                  value={variant.attributesText}
                  placeholder={'Color: Rojo\nTalla: M'}
                  onInput={(event) => updateVariant(index, { attributesText: event.currentTarget.value })}
                />
              </Field>
              <label class="store-checkline">
                <input type="checkbox" checked={variant.priceInherited} onChange={(event) => updateVariant(index, { priceInherited: event.currentTarget.checked })} />
                Heredar el precio base
              </label>
              {!variant.priceInherited && (
                <Field id={`variant-${index}-price`} label="Precio propio (€)" required error={errors[`variants.${index}.priceEuros`]}>
                  <input
                    id={`variant-${index}-price`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.priceEuros}
                    onInput={(event) => updateVariant(index, { priceEuros: event.currentTarget.value })}
                  />
                </Field>
              )}
              <label class="store-checkline">
                <input type="checkbox" checked={variant.isActive} onChange={(event) => updateVariant(index, { isActive: event.currentTarget.checked })} />
                Variante activa
              </label>
              {variants.length > 1 && (
                <button type="button" class="btn btn-secondary" onClick={() => setVariants(variants.filter((_, itemIndex) => itemIndex !== index))}>Quitar variante</button>
              )}
            </div>
          ))}

          {sellingVariants && (
            <button type="button" class="btn btn-secondary" onClick={() => setVariants([...variants, blankVariant()])}>Añadir variante</button>
          )}
          {converting && <p class="store-note">Al guardar se transfiere el inventario y el producto padre deja de ser vendible.</p>}
        </section>

        <section class="store-panel">
          <h2>Relacionados y SEO</h2>
          <Field id="product-attributes" label="Atributos comunes">
            <textarea id="product-attributes" rows={3} value={product.attributesText} placeholder={'Material: Algodón'} onInput={(event) => setField('attributesText', event.currentTarget.value)} />
          </Field>
          <ProductPicker label="Productos relacionados" products={related} onChange={setRelated} excludeId={productId} />
          <Field
            id="product-seo-title"
            label="SEO título"
            action={(
              <button type="button" class="btn-secondary-small" onClick={() => setField('seoTitle', product.name)} disabled={!product.name.trim()}>
                Copiar nombre
              </button>
            )}
          >
            <input id="product-seo-title" type="text" value={product.seoTitle} onInput={(event) => setField('seoTitle', event.currentTarget.value)} />
          </Field>
          <Field
            id="product-seo-description"
            label="SEO descripción"
            action={(
              <button type="button" class="btn-secondary-small" onClick={() => setField('seoDescription', product.description)} disabled={!product.description.trim()}>
                Copiar descripción
              </button>
            )}
          >
            <textarea id="product-seo-description" rows={3} value={product.seoDescription} onInput={(event) => setField('seoDescription', event.currentTarget.value)} />
          </Field>
        </section>

        <div class="form-actions">
          <a class="btn btn-secondary" href="/admin/tienda/productos">Cancelar</a>
          <button class="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>

      <MediaPicker
        isOpen={picker != null}
        onClose={() => setPicker(null)}
        onSelect={selectImage}
        allowedTypes={['image']}
      />
    </main>
  );
}
