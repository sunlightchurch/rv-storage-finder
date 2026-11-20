import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { meanPoint, parseZcta } from './geo.mjs';

function normalizeZip(value) {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 5) return null;
  return digits.slice(0, 5);
}

export function loadZcta() {
  const file = path.join(process.cwd(), 'public/zcta.csv');
  return parseZcta(fs.readFileSync(file, 'utf8'));
}

function cityCentroid(city, zcta) {
  const plotted = city.listings
    .filter((listing) => Number.isFinite(listing.lat) && Number.isFinite(listing.lng))
    .map((listing) => ({ lat: listing.lat, lng: listing.lng }));
  if (plotted.length) return meanPoint(plotted);
  const fromZips = [];
  for (const listing of city.listings) {
    const zip = normalizeZip(listing.postal_code);
    const point = zip ? zcta.get(zip) : null;
    if (point) fromZips.push(point);
  }
  return fromZips.length ? meanPoint(fromZips) : null;
}

function addPlace(cities, facilities, place, zcta) {
  const center = cityCentroid(place, zcta);
  cities.push({
    id: place.id,
    name: place.name,
    code: place.code,
    label: `${place.name}, ${place.code}`,
    path: place.path,
    lat: center?.lat ?? null,
    lng: center?.lng ?? null,
  });
  for (const listing of place.listings) {
    const own = Number.isFinite(listing.lat) && Number.isFinite(listing.lng);
    const zip = normalizeZip(listing.postal_code);
    const zipPoint = zip ? zcta.get(zip) : null;
    const point = own ? { lat: listing.lat, lng: listing.lng } : zipPoint || center;
    if (!point) continue;
    facilities.push({
      slug: listing.slug,
      name: listing.name,
      place: `${listing.city}, ${listing.state_code}`,
      cityId: place.id,
      path: place.path,
      directory: `${place.name}, ${place.code}`,
      lat: point.lat,
      lng: point.lng,
      approx: own ? null : zipPoint ? 'zip' : 'city',
    });
  }
}

function countyFiles() {
  const dir = path.join(process.cwd(), 'src/data/counties');
  if (!fs.existsSync(dir)) return [];
  const found = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.yaml')) found.push(full);
    }
  };
  walk(dir);
  return found.sort();
}

export function buildSearchData(zcta = loadZcta()) {
  const dir = path.join(process.cwd(), 'src/data/cities');
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.yaml')).sort();
  const cities = [];
  const facilities = [];
  for (const file of files) {
    const city = yaml.load(fs.readFileSync(path.join(dir, file), 'utf8'));
    addPlace(
      cities,
      facilities,
      {
        id: city.id,
        name: city.city,
        code: city.state_code,
        path: `/cities/${city.id}/`,
        listings: city.listings,
      },
      zcta,
    );
  }
  for (const file of countyFiles()) {
    const county = yaml.load(fs.readFileSync(file, 'utf8'));
    const state = String(county.state).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    addPlace(
      cities,
      facilities,
      {
        id: county.id,
        name: county.name,
        code: county.state_code,
        path: `/states/${state}/${county.id}/`,
        listings: county.listings,
      },
      zcta,
    );
  }
  return { cities, facilities };
}
