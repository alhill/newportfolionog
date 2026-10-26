import { useState } from 'preact/hooks';
import { formatEuros } from '../../../lib/store/money';
import { shipmentBlocksRefund, shipmentStateLabel } from '../../../lib/store/packlink/model';
import { storeApi } from './api';

function isImage(url) {
  return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);
}

export default function ShipmentPanel({ order }) {
  const [parcel, setParcel] = useState({ width: '30', height: '20', length: '15', weight: '1' });
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState('');
  const [dropoffPointId, setDropoffPointId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const shipment = order.packlink;
  const selected = services.find((service) => String(service.id) === String(serviceId));
  const locked = shipmentBlocksRefund(shipment);
  const closed = order.paymentStatus === 'refunded' || order.paymentStatus === 'cancelled' || order.fulfillmentStatus === 'cancelled';

  const setDim = (name, value) => setParcel((current) => ({ ...current, [name]: value }));

  const quote = async () => {
    setBusy('quote');
    setError('');
    try {
      const result = await storeApi(`/api/store/orders/${order.id}/shipment`, {
        method: 'POST',
        body: { action: 'quote', package: parcel },
      });
      const next = result.data?.services || [];
      setServices(next);
      setServiceId(next[0] ? String(next[0].id) : '');
      setDropoffPointId('');
      if (next.length === 0) setError('Packlink no ha devuelto servicios');
    } catch (quoteError) {
      setError(quoteError.message);
    } finally {
      setBusy('');
    }
  };

  const create = async () => {
    setBusy('create');
    setError('');
    try {
      await storeApi(`/api/store/orders/${order.id}/shipment`, {
        method: 'POST',
        body: { action: 'create', package: parcel, serviceId: Number(serviceId), dropoffPointId },
      });
      window.location.reload();
    } catch (createError) {
      setError(createError.message);
      setBusy('');
    }
  };

  const refresh = async () => {
    setBusy('refresh');
    setError('');
    try {
      await storeApi(`/api/store/orders/${order.id}/shipment`);
      window.location.reload();
    } catch (refreshError) {
      setError(refreshError.message);
      setBusy('');
    }
  };

  const reject = async () => {
    const paid = order.paymentStatus === 'paid';
    const confirmed = window.confirm(paid
      ? 'Se devolverá el cobro en SumUp y se repondrá el stock.'
      : 'Se cancelará el pedido y se repondrá el stock.');
    if (!confirmed) return;
    setBusy('reject');
    setError('');
    try {
      await storeApi(`/api/store/orders/${order.id}/reject`, { method: 'POST', body: {} });
      window.location.reload();
    } catch (rejectError) {
      setError(rejectError.message);
      setBusy('');
    }
  };

  return (
    <section class="store-panel">
      <h2>Envío Packlink</h2>
      {error && <p class="store-error">{error}</p>}
      {order.paymentStatus !== 'paid' && !closed && (
        <p class="store-note">Cuando el pago quede confirmado podrás crear el envío.</p>
      )}
      {closed && <p class="store-note">Este pedido está cancelado o reembolsado.</p>}

      {order.paymentStatus === 'paid' && !shipment && (
        <>
          <p class="store-note">
            El cliente ya ha pagado la tarifa de la tienda. Indica el bulto real para ver lo que costará en Packlink.
            Crear el envío lo deja listo para pagar; el pago y el QR se completan en Packlink.
          </p>
          <div class="store-grid-2">
            <div class="form-group">
              <label>Largo (cm)</label>
              <input type="number" min="1" step="0.1" value={parcel.length} onInput={(event) => setDim('length', event.currentTarget.value)} />
            </div>
            <div class="form-group">
              <label>Ancho (cm)</label>
              <input type="number" min="1" step="0.1" value={parcel.width} onInput={(event) => setDim('width', event.currentTarget.value)} />
            </div>
            <div class="form-group">
              <label>Alto (cm)</label>
              <input type="number" min="1" step="0.1" value={parcel.height} onInput={(event) => setDim('height', event.currentTarget.value)} />
            </div>
            <div class="form-group">
              <label>Peso (kg)</label>
              <input type="number" min="0.01" step="0.01" value={parcel.weight} onInput={(event) => setDim('weight', event.currentTarget.value)} />
            </div>
          </div>
          <div class="form-group">
            <button class="btn btn-secondary" type="button" disabled={busy !== ''} onClick={quote}>
              {busy === 'quote' ? 'Consultando…' : 'Ver precios'}
            </button>
          </div>
          {services.length > 0 && (
            <div class="form-group">
              <label>Servicio</label>
              <select
                value={serviceId}
                onChange={(event) => {
                  setServiceId(event.currentTarget.value);
                  setDropoffPointId('');
                }}
              >
                {services.map((service) => (
                  <option value={String(service.id)} key={service.id}>
                    {formatEuros(service.totalCents)} · {service.carrierName} {service.name}
                    {service.transitTime ? ` · ${service.transitTime}` : ''}
                    {service.dropoff ? ' · Depósito' : ' · Recogida'}
                    {service.printInStore ? ' · QR' : ''}
                  </option>
                ))}
              </select>
              {selected && selected.baseCents !== selected.totalCents && (
                <small>Base {formatEuros(selected.baseCents)} · impuesto {formatEuros(selected.taxCents)}</small>
              )}
            </div>
          )}
          {selected?.dropoffs?.length > 0 && (
            <div class="form-group">
              <label>Punto de depósito</label>
              <select value={dropoffPointId} onChange={(event) => setDropoffPointId(event.currentTarget.value)}>
                <option value="">Elige un punto</option>
                {selected.dropoffs.map((point) => (
                  <option value={point.id} key={point.id}>{point.name}{point.address ? ` · ${point.address}` : ''}</option>
                ))}
              </select>
            </div>
          )}
          {selected?.dropoff && selected.dropoffs.length === 0 && (
            <p class="store-note">Packlink no ha devuelto puntos de depósito. El envío puede quedar como borrador y habrá que completarlo en su panel.</p>
          )}
          {selected && !selected.dropoff && selected.collectionDate && (
            <p class="store-note">Primera recogida disponible: {selected.collectionDate} {selected.collectionTime}</p>
          )}
          {selected && (
            <p>
              <button class="btn btn-primary" type="button" disabled={busy !== ''} onClick={create}>
                {busy === 'create' ? 'Creando…' : `Crear envío pendiente de pago · ${formatEuros(selected.totalCents)}`}
              </button>
            </p>
          )}
        </>
      )}

      {shipment && (
        <>
          <p>
            <strong>{shipment.carrierName}</strong> {shipment.serviceName}
            {' · '}
            {shipmentStateLabel(shipment.state)}
          </p>
          <p>Coste en Packlink: <strong>{formatEuros(shipment.totalCents)}</strong></p>
          {shipment.baseCents !== shipment.totalCents && (
            <p class="store-note">Base {formatEuros(shipment.baseCents)} · impuesto {formatEuros(shipment.taxCents)}. La protección extra, si la añades al pagar, no está incluida.</p>
          )}
          <p>Referencia {shipment.reference}</p>
          <p>
            <a href="https://pro.packlink.es/" target="_blank" rel="noreferrer">Pagar y ver el QR en Packlink</a>
          </p>
          {shipment.printInStore && (
            <p class="store-note">Este servicio puede entregarse con QR en la agencia. El código aparece en la etiqueta o en el correo de Packlink cuando el envío está pagado.</p>
          )}
          {shipment.labelUrls.length > 0 && (
            <div class="store-labels">
              {shipment.labelUrls.map((url) => (
                isImage(url)
                  ? <img key={url} class="store-label-preview" src={url} alt="Etiqueta de Packlink" />
                  : <p key={url}><a href={url} target="_blank" rel="noreferrer">Abrir etiqueta de Packlink</a></p>
              ))}
            </div>
          )}
          {shipment.trackingUrl && (
            <p><a href={shipment.trackingUrl} target="_blank" rel="noreferrer">Seguimiento</a></p>
          )}
          <p>
            <button class="btn btn-secondary" type="button" disabled={busy !== ''} onClick={refresh}>
              {busy === 'refresh' ? 'Actualizando…' : 'Actualizar estado y etiqueta'}
            </button>
          </p>
        </>
      )}

      {!closed && !locked && (
        <p>
          <button class="btn btn-secondary" type="button" disabled={busy !== ''} onClick={reject}>
            {busy === 'reject' ? 'Procesando…' : order.paymentStatus === 'paid' ? 'Rechazar y reembolsar' : 'Cancelar pedido'}
          </button>
        </p>
      )}
    </section>
  );
}
