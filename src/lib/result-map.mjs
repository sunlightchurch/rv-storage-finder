import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
}

function money(amount) {
  const rounded = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(rounded)) return null;
  return Number.isInteger(rounded) ? `$${rounded}` : `$${rounded.toFixed(2)}`;
}

function groupPoints(points) {
  const groups = new Map();
  for (const point of points) {
    const key = `${Number(point.lat).toFixed(5)},${Number(point.lng).toFixed(5)}`;
    const list = groups.get(key) || [];
    list.push(point);
    groups.set(key, list);
  }
  return [...groups.values()];
}

export function mountResultMap(frame, points, onSelect) {
  const map = L.map(frame, {
    scrollWheelZoom: false,
    zoomControl: true,
  });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const bounds = [];
  for (const group of groupPoints(points)) {
    const first = group[0];
    const prices = group.map((point) => point.price).filter((price) => price != null);
    const label = prices.length ? money(Math.min(...prices)) : null;
    const icon = L.divIcon({
      className: label ? 'price-pin' : 'dot-pin',
      html: `<span>${label ? escapeHtml(label) : ''}</span>`,
      iconSize: label ? [64, 28] : [16, 16],
      iconAnchor: label ? [32, 14] : [8, 8],
    });
    const marker = L.marker([first.lat, first.lng], { icon, keyboard: true, title: first.name });
    const rows = group.map((point) => {
      const price = point.price != null ? `${money(point.price)}/mo` : 'Price not posted';
      const where = point.approx === 'zip' ? ' ZIP center.' : '';
      return `<button type="button" class="pin-jump" data-pin-jump="${escapeHtml(point.id)}">${escapeHtml(point.name)} — ${escapeHtml(price)}${escapeHtml(where)}</button>`;
    });
    marker.bindPopup(`<div class="pin-popup">${rows.join('')}</div>`);
    if (group.length === 1) marker.on('click', () => onSelect(first.id));
    marker.setZIndexOffset(label ? 200 : 0);
    marker.addTo(map);
    const pin = marker.getElement();
    if (pin) pin.dataset.pins = group.map((point) => point.id).join(' ');
    bounds.push([first.lat, first.lng]);
  }

  if (bounds.length === 1) map.setView(bounds[0], 12);
  else if (bounds.length) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
  return map;
}
