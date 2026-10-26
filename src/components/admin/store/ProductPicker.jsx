import { useEffect, useState } from 'preact/hooks';
import { storeApi } from './api';

export default function ProductPicker({
  label = 'Productos',
  products,
  onChange,
  excludeId = '',
  max = 12,
  hint = 'Se guarda el enlace al producto, así que el nombre y la foto salen de su ficha.',
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

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

  const chosen = new Set(products.map((item) => item.id));
  const visible = results.filter((item) => item.id !== excludeId && !chosen.has(item.id));

  const add = (item) => {
    if (products.length >= max || chosen.has(item.id) || item.id === excludeId) return;
    onChange([...products, { id: item.id, name: item.name, imageUrl: item.imageUrl || '' }]);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div class="form-group">
      <label>{label}</label>
      <div class="store-related">
        <input
          type="text"
          value={query}
          placeholder="Busca un producto por nombre"
          autoComplete="off"
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setOpen(true);
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
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(item)}
              >
                {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span class="store-related-fallback" />}
                <span>
                  <strong>{item.name}</strong>
                  {item.sku ? <small>{item.sku}</small> : null}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {products.length > 0 && (
        <div class="store-related-chips">
          {products.map((item) => (
            <span class="store-chip" key={item.id}>
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
              <span>{item.name}</span>
              <button type="button" aria-label={`Quitar ${item.name}`} onClick={() => onChange(products.filter((entry) => entry.id !== item.id))}>×</button>
            </span>
          ))}
        </div>
      )}
      <small>{products.length >= max ? `Puedes elegir hasta ${max} productos.` : hint}</small>
    </div>
  );
}
