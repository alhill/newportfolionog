import { AggregateField } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { isIndexError } from './http';
import { listInventory } from './inventory';
import { listOrders } from './orders';

async function safeCount(query: FirebaseFirestore.Query) {
  try {
    const snapshot = await query.count().get();
    return snapshot.data().count;
  } catch (error) {
    if (!isIndexError(error)) console.error(error);
    return null;
  }
}

async function paidRevenue() {
  try {
    const snapshot = await adminDb.collection('orders')
      .where('paymentStatus', '==', 'paid')
      .aggregate({ revenue: AggregateField.sum('total'), sales: AggregateField.count() })
      .get();
    return {
      revenue: Number(snapshot.data().revenue || 0),
      sales: Number(snapshot.data().sales || 0),
    };
  } catch (error) {
    if (!isIndexError(error)) console.error(error);
    return { revenue: null, sales: null };
  }
}

/**
 * El resumen no guarda contadores derivados.
 * Ingresos y número de ventas salen de una agregación en vivo de pedidos pagados.
 * El stock bajo sale de los documentos vendibles, no de una suma guardada en el padre.
 */
export async function getStoreDashboard() {
  const [revenue, pendingOrders, productCount, recentOrders, lowStock] = await Promise.all([
    paidRevenue(),
    safeCount(adminDb.collection('orders').where('paymentStatus', '==', 'pending')),
    safeCount(adminDb.collection('products')),
    listOrders(8).catch((error) => {
      console.error(error);
      return [];
    }),
    listInventory({ lowStock: true, limit: 8 }).catch((error) => {
      console.error(error);
      return { items: [], threshold: null, truncated: false, warning: error instanceof Error ? error.message : '' };
    }),
  ]);

  return {
    revenue: revenue.revenue,
    sales: revenue.sales,
    pendingOrders,
    productCount,
    recentOrders,
    lowStock: lowStock.items,
    lowStockThreshold: 'threshold' in lowStock ? lowStock.threshold : null,
    lowStockTruncated: Boolean(lowStock.truncated),
    lowStockWarning: lowStock.warning || '',
  };
}
