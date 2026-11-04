import { useEffect, useState } from 'preact/hooks';
import { resolveGroupJoin } from '../../../lib/store/groups';
import { storeApi } from './api';

export default function ProductGroupField({ productId = '', groupId = '', onChange }) {
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [pendingLinks, setPendingLinks] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async (id) => {
    if (!id) {
      setMembers([]);
      return;
    }
    try {
      const result = await storeApi(`/api/store/products?groupId=${encodeURIComponent(id)}&limit=100`);
      setMembers(result.data || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    setError('');
    load(groupId);
  }, [groupId]);

  useEffect(() => {
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
        if (!cancelled) setResults(data.data || []);
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
  }, [query]);

  const others = members.filter((item) => item.id !== productId);
  const visible = results.filter((item) => item.id !== productId && !others.some((member) => member.id === item.id));

  const assign = async (id, nextGroupId) => {
    if (!id) return;
    await storeApi(`/api/store/products/${id}`, {
      method: 'PUT',
      body: { groupId: nextGroupId },
    });
  };

  const link = async (item) => {
    const decision = resolveGroupJoin(groupId, item.groupId || '', () => crypto.randomUUID());
    if (decision.already) {
      setNotice('Ese producto ya está en este modelo.');
      setQuery('');
      setOpen(false);
      return;
    }

    if (decision.updatePicked && item.groupId && item.groupId !== decision.groupId) {
      const confirmed = confirm(`${item.name} ya pertenece a otro modelo. Pasará a este.`);
      if (!confirmed) return;
    }

    setLinking(true);
    setError('');
    setNotice('');
    let pickedUpdated = false;
    try {
      if (decision.updatePicked) {
        await assign(item.id, decision.groupId);
        pickedUpdated = true;
      }
      if (decision.updateCurrent && productId) await assign(productId, decision.groupId);
      onChange(decision.groupId);
      setQuery('');
      setResults([]);
      setOpen(false);
      if (!productId && decision.updatePicked) {
        setPendingLinks((current) => [...current, { id: item.id, previousGroupId: item.groupId || null }]);
        setNotice('Al guardar, este producto quedará enlazado.');
      }
      await load(decision.groupId);
    } catch (linkError) {
      if (pickedUpdated) {
        try {
          await assign(item.id, item.groupId || null);
        } catch {
          // Se conserva el error principal.
        }
      }
      setError(linkError.message);
    } finally {
      setLinking(false);
    }
  };

  const unlink = async () => {
    if (!groupId) return;
    setLinking(true);
    setError('');
    setNotice('');
    const previous = groupId;
    const reverting = productId ? [] : pendingLinks;
    onChange('');
    try {
      if (productId) await assign(productId, null);
      else await Promise.all(reverting.map((link) => assign(link.id, link.previousGroupId)));
      setPendingLinks([]);
      setMembers([]);
    } catch (unlinkError) {
      onChange(previous);
      setError(unlinkError.message);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div>
      <p class="store-note">
        Los otros colores de este modelo. Cada color es un producto, sale en el listado y se abre desde aquí.
        Las tallas no se añaden en este apartado.
      </p>
      {error && <p class="store-error">{error}</p>}
      {notice && <p class="store-note">{notice}</p>}

      {groupId && others.length === 0 && (
        <p class="store-note">Todavía no hay otros colores enlazados.</p>
      )}

      {others.length > 0 && (
        <ul class="catalog-members">
          {others.map((item) => (
            <li key={item.id}>
              <a href={`/admin/tienda/productos/${item.id}`}>
                {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span class="store-related-fallback" />}
                <span>
                  {item.name}
                  {item.isActive === false ? <small>Oculto</small> : null}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <div class="form-group">
        <label for="product-group-search">Añadir un color del mismo modelo</label>
        <div class="store-related">
          <input
            id="product-group-search"
            type="text"
            value={query}
            placeholder="Busca el producto por nombre"
            autoComplete="off"
            disabled={linking}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault();
            }}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setOpen(true);
              setNotice('');
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              setTimeout(() => setOpen(false), 180);
            }}
          />
          {open && query.trim().length >= 2 && (
            <div class="store-related-menu">
              {searching && <p class="store-related-empty">Buscando…</p>}
              {!searching && visible.length === 0 && <p class="store-related-empty">Ningún producto coincide</p>}
              {!searching && visible.map((item) => (
                <button
                  type="button"
                  class="store-related-option"
                  key={item.id}
                  disabled={linking}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => link(item)}
                >
                  {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span class="store-related-fallback" />}
                  <span>
                    <strong>{item.name}</strong>
                    {item.groupId ? <small>Ya está en un modelo</small> : null}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {groupId && (
        <button type="button" class="btn btn-secondary" onClick={unlink} disabled={linking}>
          Quitar de este modelo
        </button>
      )}
    </div>
  );
}
