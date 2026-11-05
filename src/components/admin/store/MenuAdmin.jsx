import { useEffect, useRef, useState } from 'preact/hooks';
import { storeApi } from './api';

const TYPES = [
  { id: 'category', label: 'Categoría' },
  { id: 'landing', label: 'Landing' },
  { id: 'product', label: 'Producto' },
  { id: 'link', label: 'Enlace' },
];

const HINTS = {
  category: 'Busca una categoría. En la tienda se verá su nombre y abrirá su filtro.',
  landing: 'Busca una página de Inicio y páginas. La de slug "inicio" abre /tienda; el resto, /tienda/pagina/su-slug.',
  product: 'Busca un producto por nombre. El enlace abre su ficha.',
  link: 'Escribe el texto visible y una ruta (/tienda) o una dirección http(s).',
};

const STATUS = {
  hidden: 'Oculta: no se muestra en la tienda',
  missing: 'Ya no existe',
};

function fold(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanItem(item) {
  return {
    id: item.id,
    type: item.type,
    refId: item.type === 'link' ? '' : item.refId || '',
    label: item.label || '',
    href: item.type === 'link' ? item.href || '' : '',
  };
}

function blankDraft(zone) {
  return { zone, id: '', type: 'category', refId: '', label: '', href: '', name: '', slug: '', destination: '', status: 'ok' };
}

function destinationFor(type, slug, href) {
  if (type === 'link') return href;
  if (!slug) return '';
  if (type === 'category') return `/tienda?categoria=${slug}`;
  if (type === 'landing') return slug === 'inicio' ? '/tienda' : `/tienda/pagina/${slug}`;
  return `/tienda/${slug}`;
}

function cloneMenu(menu) {
  return {
    top: (menu.top || []).map((item) => ({ ...item })),
    bottom: (menu.bottom || []).map((item) => ({ ...item })),
  };
}

function menuSignature(menu) {
  return JSON.stringify({
    top: menu.top.map(cleanItem),
    bottom: menu.bottom.map(cleanItem),
  });
}

function TargetSearch({ type, categories, landings, selected, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (type === 'product') return undefined;
    const source = type === 'landing' ? landings : categories;
    const term = fold(query.trim());
    const matches = source
      .filter((item) => {
        const name = type === 'landing' ? item.title : item.name;
        return !term || fold(name).includes(term) || fold(item.slug).includes(term);
      })
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        name: type === 'landing' ? item.title : item.name,
        slug: item.slug || '',
        imageUrl: '',
      }));
    setResults(matches);
    setSearching(false);
    return undefined;
  }, [type, query, categories, landings]);

  useEffect(() => {
    if (type !== 'product') return undefined;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await storeApi(`/api/store/products?q=${encodeURIComponent(term)}&limit=8`);
        if (!cancelled) {
          setResults((data.data || []).map((item) => ({
            id: item.id,
            name: item.name,
            slug: item.slug || '',
            imageUrl: item.imageUrl || '',
          })));
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [type, query]);

  const choose = (item) => {
    onSelect(item);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const label = type === 'landing' ? 'Landing' : type === 'product' ? 'Producto' : 'Categoría';
  const showingSelection = Boolean(selected?.id) && query === '';

  return (
    <div class="form-group">
      <label for="menu-target">{label}</label>
      <div class={`menu-target${open ? ' is-open' : ''}`}>
        <input
          id="menu-target"
          type="text"
          value={showingSelection ? selected.name : query}
          placeholder={type === 'product' ? 'Busca un producto' : 'Busca por nombre'}
          autoComplete="off"
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setOpen(true);
            if (selected) onSelect(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
        />
        {showingSelection && (
          <button type="button" class="menu-target-clear" aria-label="Quitar selección" onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(null)}>×</button>
        )}
        {open && (
          <div class="menu-target-list">
            {type === 'product' && query.trim().length < 2 && <p>Escribe al menos dos letras</p>}
            {searching && <p>Buscando…</p>}
            {!searching && results.length === 0 && (type !== 'product' || query.trim().length >= 2) && <p>Ningún resultado</p>}
            {!searching && results.map((item) => (
              <button
                type="button"
                key={item.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
              >
                {item.name}
                {item.slug ? <small>{item.slug}</small> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuList({ zone, items, dragRef, over, setOver, onDrop, onEdit, onRemove }) {
  return (
    <div
      class={`menu-list${over === zone ? ' is-over' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(zone);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(zone, items.length);
      }}
    >
      {items.map((item, index) => (
        <article
          class={`menu-row${dragRef.current?.id === item.id ? ' is-dragging' : ''}`}
          key={item.id}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOver(`${zone}:${index}`);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDrop(zone, index);
          }}
        >
          <button
            type="button"
            class="store-drag-handle menu-drag-handle"
            draggable
            aria-label="Reordenar"
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', item.id);
              dragRef.current = { zone, index, id: item.id };
            }}
            onDragEnd={() => {
              dragRef.current = null;
              setOver('');
            }}
          >
            <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
              <circle cx="2" cy="2" r="1.15" />
              <circle cx="8" cy="2" r="1.15" />
              <circle cx="2" cy="8" r="1.15" />
              <circle cx="8" cy="8" r="1.15" />
              <circle cx="2" cy="14" r="1.15" />
              <circle cx="8" cy="14" r="1.15" />
            </svg>
          </button>
          <div class="menu-row-copy">
            <strong>{item.name || item.label}</strong>
            <small>
              {TYPES.find((entry) => entry.id === item.type)?.label}
              {item.destination ? ` · ${item.destination}` : ''}
              {item.status && item.status !== 'ok' ? ` · ${STATUS[item.status]}` : ''}
            </small>
          </div>
          <div class="menu-row-actions">
            <button type="button" class="store-icon-btn" aria-label={`Editar ${item.name || item.label}`} onClick={() => onEdit(zone, item)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <button type="button" class="store-icon-btn menu-icon-delete" aria-label={`Eliminar ${item.name || item.label}`} onClick={() => onRemove(zone, item.id)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          </div>
        </article>
      ))}
      {items.length === 0 && <p class="empty">No hay enlaces en esta parte.</p>}
    </div>
  );
}

export default function MenuAdmin() {
  const [menu, setMenu] = useState({ top: [], bottom: [] });
  const [savedMenu, setSavedMenu] = useState({ top: [], bottom: [] });
  const [categories, setCategories] = useState([]);
  const [landings, setLandings] = useState([]);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [over, setOver] = useState('');
  const dragRef = useRef(null);
  const dirty = menuSignature(menu) !== menuSignature(savedMenu);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [menuResult, categoryResult, landingResult] = await Promise.all([
          storeApi('/api/store/menu'),
          storeApi('/api/store/resources/categories'),
          storeApi('/api/store/resources/pages'),
        ]);
        if (cancelled) return;
        const loaded = cloneMenu({ top: menuResult.data.top || [], bottom: menuResult.data.bottom || [] });
        setMenu(loaded);
        setSavedMenu(cloneMenu(loaded));
        setCategories(categoryResult.data || []);
        setLandings(landingResult.data || []);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!draft) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setDraft(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [draft]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onLeave = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await storeApi('/api/store/menu', {
        method: 'PUT',
        body: {
          top: menu.top.map(cleanItem),
          bottom: menu.bottom.map(cleanItem),
        },
      });
      const next = cloneMenu({ top: result.data.top || [], bottom: result.data.bottom || [] });
      setMenu(next);
      setSavedMenu(cloneMenu(next));
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setMenu(cloneMenu(savedMenu));
    setDraft(null);
    setFormError('');
    setError('');
  };

  const place = (fromZone, fromIndex, toZone, toIndex, adjust) => {
    const next = { top: [...menu.top], bottom: [...menu.bottom] };
    const [item] = next[fromZone].splice(fromIndex, 1);
    if (!item) return;
    let index = toIndex == null ? next[toZone].length : toIndex;
    if (adjust && fromZone === toZone && fromIndex < index) index -= 1;
    index = Math.max(0, Math.min(index, next[toZone].length));
    next[toZone].splice(index, 0, item);
    const same = next.top.every((entry, i) => entry.id === menu.top[i]?.id)
      && next.bottom.every((entry, i) => entry.id === menu.bottom[i]?.id)
      && next.top.length === menu.top.length
      && next.bottom.length === menu.bottom.length;
    if (!same) setMenu(next);
  };

  const relocate = (toZone, toIndex) => {
    const from = dragRef.current;
    dragRef.current = null;
    setOver('');
    if (!from) return;
    place(from.zone, from.index, toZone, toIndex, true);
  };

  const commit = (event) => {
    event.preventDefault();
    if (!draft) return;
    if (draft.type === 'link') {
      if (!draft.label.trim() || !draft.href.trim()) {
        setFormError('El enlace necesita texto y URL.');
        return;
      }
    } else if (!draft.refId) {
      setFormError('Elige un elemento de la lista.');
      return;
    }

    const href = draft.type === 'link' ? draft.href.trim() : '';
    const item = {
      id: draft.id || newId(),
      type: draft.type,
      refId: draft.type === 'link' ? '' : draft.refId,
      label: (draft.type === 'link' ? draft.label : draft.name || draft.label).trim(),
      href,
      name: draft.type === 'link' ? draft.label.trim() : draft.name,
      destination: draft.slug ? destinationFor(draft.type, draft.slug, href) : (draft.type === 'link' ? href : draft.destination || ''),
      status: draft.status || 'ok',
    };
    const next = { top: [...menu.top], bottom: [...menu.bottom] };
    const zoneItems = next[draft.zone];
    if (!draft.id && zoneItems.length >= 40) {
      setFormError('Cada parte del menú admite hasta 40 enlaces.');
      return;
    }
    const index = zoneItems.findIndex((entry) => entry.id === item.id);
    if (index >= 0) zoneItems[index] = { ...zoneItems[index], ...item };
    else zoneItems.push(item);
    setDraft(null);
    setFormError('');
    setMenu(next);
  };

  const remove = (zone, id) => {
    if (draft?.id === id) setDraft(null);
    setMenu({
      top: zone === 'top' ? menu.top.filter((entry) => entry.id !== id) : menu.top,
      bottom: zone === 'bottom' ? menu.bottom.filter((entry) => entry.id !== id) : menu.bottom,
    });
  };

  const edit = (zone, item) => {
    setFormError('');
    setDraft({
      zone,
      id: item.id,
      type: item.type,
      refId: item.refId || '',
      label: item.type === 'link' ? item.label : '',
      href: item.href || '',
      name: item.type === 'link' ? '' : item.name || item.label,
      slug: '',
      destination: item.destination || '',
      status: item.status || 'ok',
    });
  };

  return (
    <div class="main-content">
      <div class="content-header">
        <h1>Menú</h1>
        {dirty && (
          <div class="content-header-actions">
            <button type="button" class="btn btn-secondary" disabled={saving} onClick={discard}>Descartar cambios</button>
            <button type="button" class="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        )}
      </div>
      {error && <p class="store-error">{error}</p>}
      {loading ? <p>Cargando…</p> : (
        <>
          <div class="menu-zones">
            <section class="store-panel">
              <div class="menu-zone-head">
                <h2>Arriba</h2>
                <button type="button" class="btn btn-primary" onClick={() => { setFormError(''); setDraft(blankDraft('top')); }}>+ Añadir</button>
              </div>
              <MenuList
                zone="top"
                items={menu.top}
                dragRef={dragRef}
                over={over}
                setOver={setOver}
                onDrop={relocate}
                onEdit={edit}
                onRemove={remove}
              />
            </section>
            <section class="store-panel">
              <div class="menu-zone-head">
                <h2>Abajo</h2>
                <button type="button" class="btn btn-primary" onClick={() => { setFormError(''); setDraft(blankDraft('bottom')); }}>+ Añadir</button>
              </div>
              <MenuList
                zone="bottom"
                items={menu.bottom}
                dragRef={dragRef}
                over={over}
                setOver={setOver}
                onDrop={relocate}
                onEdit={edit}
                onRemove={remove}
              />
            </section>
          </div>

          {draft && (
            <div class="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) setDraft(null); }}>
              <div class="modal-content menu-modal" role="dialog" aria-modal="true" aria-labelledby="menu-dialog-title">
                <div class="modal-header">
                  <h2 id="menu-dialog-title">{draft.id ? 'Editar enlace' : draft.zone === 'bottom' ? 'Nuevo enlace abajo' : 'Nuevo enlace arriba'}</h2>
                  <button type="button" class="btn-close" aria-label="Cerrar" onClick={() => setDraft(null)}>×</button>
                </div>
                <form class="store-form" onSubmit={commit} noValidate>
                  <div class="modal-body">
                    {formError && <p class="store-error">{formError}</p>}
                    <div class="form-group">
                      <label for="menu-type">Tipo</label>
                      <select
                        id="menu-type"
                        value={draft.type}
                        onChange={(event) => setDraft({
                          ...draft,
                          type: event.currentTarget.value,
                          refId: '',
                          label: '',
                          href: '',
                          name: '',
                          slug: '',
                          destination: '',
                          status: 'ok',
                        })}
                      >
                        {TYPES.map((type) => <option value={type.id} key={type.id}>{type.label}</option>)}
                      </select>
                      <small>{HINTS[draft.type]}</small>
                    </div>
                    {draft.type === 'link' ? (
                      <>
                        <div class="form-group">
                          <label for="menu-label">Texto</label>
                          <input id="menu-label" type="text" value={draft.label} maxLength={80} onInput={(event) => setDraft({ ...draft, label: event.currentTarget.value })} />
                        </div>
                        <div class="form-group">
                          <label for="menu-href">URL</label>
                          <input id="menu-href" type="text" value={draft.href} placeholder="/tienda o https://" onInput={(event) => setDraft({ ...draft, href: event.currentTarget.value })} />
                        </div>
                      </>
                    ) : (
                      <TargetSearch
                        type={draft.type}
                        categories={categories}
                        landings={landings}
                        selected={draft.refId ? { id: draft.refId, name: draft.name } : null}
                        onSelect={(item) => setDraft({
                          ...draft,
                          refId: item?.id || '',
                          name: item?.name || '',
                          label: item?.name || '',
                          slug: item?.slug || '',
                          status: 'ok',
                        })}
                      />
                    )}
                    <div class="form-actions">
                      <button type="button" class="btn btn-secondary" onClick={() => setDraft(null)}>Cancelar</button>
                      <button class="btn btn-primary">{draft.id ? 'Aceptar' : 'Añadir'}</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
