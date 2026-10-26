import { Resend } from 'resend';
import type { Order } from '../../types/store';
import { formatEuros } from './money';
import { getServerEnvTrimmed } from '../server-env';
import { getStoreSettings } from './settings';

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char] || char));
}

export async function notifyOrderPaid(order: Order) {
  const settings = await getStoreSettings();
  const to = settings.notificationEmail;
  const apiKey = getServerEnvTrimmed('RESEND_API_KEY');
  if (!to || !apiKey) return;

  const domain = settings.domain.replace(/\/$/, '');
  const href = /^https?:\/\//i.test(domain) ? `${domain}/admin/tienda/pedidos/${order.id}` : '';
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: getServerEnvTrimmed('RESEND_FROM_EMAIL') || 'noreply@srtanognog.com',
    to,
    subject: `Pedido pagado ${order.number}`,
    html: `
      <p>Hay un pedido pagado pendiente de revisión.</p>
      <p><strong>${escapeHtml(order.number)}</strong> · ${escapeHtml(order.customerName)} · ${escapeHtml(formatEuros(order.total))}</p>
      ${href ? `<p><a href="${escapeHtml(href)}">Abrir el pedido</a></p>` : ''}
    `,
  });
  if (result.error) {
    console.error('No se pudo avisar del pedido pagado', result.error);
  }
}
