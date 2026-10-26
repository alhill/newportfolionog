import { useEffect, useState } from 'preact/hooks';
import { formatEuros } from '../../../lib/store/money';
import { storeApi } from './api';

function attributeLabel(attributes) {
  const entries = Object.entries(attributes || {});
  if (entries.length === 0) return '—';
  return entries.map(([key, value]) => `${key}: ${value}`).join(' · ');
}

export default function InventoryAdmin({ source = 'all', title = 'Inventario', lowStock = false }) {
  const [state, setState] = useState({ items: [], hasMore: false, productCursor: null, variantCursor: null, warning: '', paginationMode: '' });
  const [active, setActive] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});

  const load = async (cursors, append) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ source, limit: '40' });
      if (lowStock) params.set('lowStock', 'true');
      if (active) params.set('active', active);
      if (cursors?.productCursor) params.set('productCursor', cursors.productCursor);
      if (cursors?.variantCursor) params.set('variantCursor', cursors.variantCursor);
      const result = await storeApi(`/api/store/inventory?${params.toString()}`);
      setState((current) => ({
        items: append ? [...current.items, ...(result.items || [])] : (result.items || []),
        hasMore: Boolean(result.hasMore),
        productCursor: result.productCursor,
        variantCursor: result.variantCursor,
        warning: result.warning || '',
        paginationMode: result.paginationMode || '',
        truncated: result.truncated,
      }));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(null, false);
  }, [source, active, lowStock]);

  const saveStock = async (item) => {
    const key = `${item.productId}:${item.variantId || ''}`;
    const stock = Number(drafts[key] ?? item.stock);
    setError('');
    try {
      await storeApi('/api/store/inventory', {
        method: 'PUT',
        body: {
          productId: item.productId,
          variantId: item.variantId,
          stock,
          expectedStock: item.stock,
        },
      });
      setState((current) => ({
        ...current,
        items: current.items.map((row) => (
          row.productId === item.productId && row.variantId === item.variantId
            ? { ...row, stock, sellable: row.isActive && stock > 0 }
            : row
        )),
      }));
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  return (
    <main class="main-content">
      <div class="content-header">
        <div>
          <p class="store-kicker">Catálogo</p>
          <h1>{title}</h1>
        </div>
      </div>
      <p class="store-note">
        {source === 'variant'
          ? 'Lista obtenida con collectionGroup(\'variants\'). Cada fila es una unidad vendible.'
          : 'Los productos simples salen de products con hasVariants = false. Las variantes salen de la subcolección. No hay una colección global de inventario.'}
      </p>
      {state.warning && <p class="store-error">{state.warning} Mientras tanto se muestra una muestra, no el inventario completo.</p>}
      {error && <p class="store-error">{error}</p>}
      {!lowStock && (
        <div class="store-filters">
          <label>
            Estado
            <select value={active} onChange={(event) => setActive(event.currentTarget.value)}>
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </label>
        </div>
      )}
      <div class="store-table-wrap">
        <table class="store-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>SKU</th>
              <th>Atributos</th>
              <th>Precio</th>
              <th>Stock</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((item) => {
              const key = `${item.productId}:${item.variantId || ''}`;
              return (
                <tr key={key}>
                  <td>
                    <a href={`/admin/tienda/productos/${item.productId}`}>{item.productName || 'Producto'}</a>
                    <small>{item.source === 'variant' ? 'Variante' : 'Producto simple'}</small>
                  </td>
                  <td>{item.sku}</td>
                  <td>{attributeLabel(item.attributes)}</td>
                  <td>
                    {formatEuros(item.price)}
                    {item.priceInherited ? <small>Heredado</small> : null}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={drafts[key] ?? item.stock}
                      onInput={(event) => setDrafts({ ...drafts, [key]: event.currentTarget.value })}
                    />
                  </td>
                  <td><button type="button" class="btn btn-secondary" onClick={() => saveStock(item)}>Guardar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {loading && <p>Cargando…</p>}
      {!loading && state.items.length === 0 && <p class="empty">No hay unidades con este filtro.</p>}
      {state.hasMore && (
        <button type="button" class="btn btn-secondary" onClick={() => load(state, true)}>Cargar más</button>
      )}
    </main>
  );
}
