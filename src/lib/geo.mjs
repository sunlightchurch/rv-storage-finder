export const EARTH_MILES = 3958.8;
export const OUTSIDE_MILES = 50;

export function haversine(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_MILES * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatMiles(miles) {
  const shown = miles < 10 ? miles.toFixed(1) : String(Math.round(miles));
  return `${shown} mi`;
}

export function meanPoint(points) {
  const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lng = points.reduce((sum, point) => sum + point.lng, 0) / points.length;
  return { lat, lng };
}

export function normPlace(value) {
  return String(value)
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\bsaint\b/g, 'st')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function queryZip(value) {
  const match = String(value).trim().match(/^(\d{5})(?:-\d{4})?$/);
  return match ? match[1] : null;
}

export function parseZcta(text) {
  const map = new Map();
  for (const line of String(text).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [zip, lat, lng] = trimmed.split(',');
    const point = { lat: Number(lat), lng: Number(lng) };
    if (zip && Number.isFinite(point.lat) && Number.isFinite(point.lng)) map.set(zip, point);
  }
  return map;
}

export function zipOrigin(zcta, zip) {
  const exact = zcta.get(zip);
  if (exact) return { point: exact, how: 'exact' };
  const prefix = zip.slice(0, 3);
  const target = Number(zip);
  const siblings = [];
  for (const [key, point] of zcta) {
    if (!key.startsWith(prefix)) continue;
    siblings.push({ key, point, delta: Math.abs(Number(key) - target) });
  }
  if (!siblings.length) return null;
  siblings.sort((a, b) => a.delta - b.delta || a.key.localeCompare(b.key));
  return { point: meanPoint(siblings.slice(0, 5).map((item) => item.point)), how: 'prefix' };
}

export function bestCityMatch(query, cities) {
  const q = normPlace(query);
  if (!q || queryZip(query)) return null;
  const exact = cities.filter((city) => {
    const name = normPlace(city.name);
    const label = normPlace(city.label);
    return name === q || label === q || `${name} ${city.code.toLowerCase()}` === q;
  });
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  if (q.length < 4) return null;
  const prefix = cities.filter((city) => normPlace(city.name).startsWith(q) || normPlace(city.label).startsWith(q));
  return prefix.length === 1 ? prefix[0] : null;
}

export function matchingCities(query, cities) {
  const q = normPlace(query);
  if (q.length < 2) return [];
  return cities.filter((city) => {
    if (city.code.toLowerCase() === q) return true;
    if (q.length < 3) return false;
    return normPlace(city.name).includes(q) || normPlace(city.label).includes(q);
  });
}

export function rankByDistance(origin, items) {
  return items
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    .map((item) => ({ item, miles: haversine(origin, item) }))
    .sort((a, b) => a.miles - b.miles || (a.item.name || a.item.label).localeCompare(b.item.name || b.item.label));
}

export function runSearch(query, data, zcta) {
  const q = String(query ?? '').trim();
  const zip = queryZip(q);
  if (zip) {
    const origin = zipOrigin(zcta, zip);
    if (!origin) {
      return { kind: 'zip', query: q, zip, known: false, how: null, outside: false, facilities: [], cities: [] };
    }
    const facilities = rankByDistance(origin.point, data.facilities).slice(0, 15);
    const cities = rankByDistance(origin.point, data.cities).slice(0, 8);
    const nearest = cities[0]?.miles ?? Number.POSITIVE_INFINITY;
    return {
      kind: 'zip',
      query: q,
      zip,
      known: true,
      how: origin.how,
      outside: nearest > OUTSIDE_MILES,
      facilities,
      cities,
    };
  }
  const redirect = bestCityMatch(q, data.cities);
  if (redirect) return { kind: 'city', query: q, redirect, matches: [redirect], facilities: [] };
  const matches = matchingCities(q, data.cities);
  const matchIds = new Set(matches.map((city) => city.id));
  const facilities = data.facilities
    .filter((facility) => {
      if (matchIds.has(facility.cityId)) return true;
      const needle = normPlace(q);
      if (needle.length < 4) return false;
      return normPlace(facility.place).includes(needle) || normPlace(facility.name).includes(needle);
    })
    .slice(0, 15);
  return { kind: 'city', query: q, redirect: null, matches, facilities };
}
