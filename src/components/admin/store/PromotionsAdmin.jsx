import { useEffect, useState } from 'preact/hooks';
import { formatEuros } from '../../../lib/store/money';
import { storeApi } from './api';

export default function PromotionsAdmin() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    storeApi('/api/store/products?limit=100')
      .then((result) => setProducts(result.data || []))
      .catch((loadError) => setError(loadError.message));
  }, []);

  const toggle = async (product) => {
    setError('');
    try {
      await storeApi(`/api/store/products/${product.id}`, {
        method: 'PUT',
        body: { featured: !product.featured },
      });
      setProducts((current) => current.map((item) => (
        item.id === product.id ? { ...item, featured: !item.featured } : item
      )));
    } catch (toggleError) {
      setError(toggleError.message);
    }
  };

  return (
    <section class="store-panel">
      <h2>Productos destacados</h2>
      <p class="store-note">El destacado es un campo del producto. No se duplica en otra colección.</p>
      {error && <p class="store-error">{error}</p>}
      <div class="store-table-wrap">
        <table class="store-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio</th>
              <th>Destacado</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td><a href={`/admin/tienda/productos/${product.id}`}>{product.name}</a></td>
                <td>{formatEuros(product.price)}</td>
                <td>
                  <button type="button" class="btn btn-secondary" onClick={() => toggle(product)}>
                    {product.featured ? 'Quitar' : 'Destacar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
