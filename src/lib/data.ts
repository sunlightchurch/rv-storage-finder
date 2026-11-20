import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import { formatDate } from './format';
import { BOAT_LENGTHS, getFitPages, RV_LENGTHS } from './fit';
import { getCostGuides } from './guides';
import { assertKnownPhoto, assertCityPhoto } from './photos';

const dataDir = path.join(process.cwd(), 'src/data');

function readYaml(file: string): unknown {
  return yaml.load(fs.readFileSync(file, 'utf8'));
}

function zodMessage(file: string, error: z.ZodError): string {
  const issues = error.issues
    .map((issue) => `${issue.path.join('.') || '(file)'}: ${issue.message}`)
    .join('; ');
  return `${path.relative(process.cwd(), file)}: ${issues}`;
}

const nullString = z.union([z.string(), z.null()]).transform((value) => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
});

const nullBool = z.union([z.boolean(), z.null()]);

const nullNumber = z.union([z.number(), z.null()]).refine(
  (value) => value == null || (Number.isFinite(value) && value > 0 && value <= 120),
  'must be a positive number up to 120, or null',
);

const publicUrl = z
  .string()
  .url()
  .refine((value) => {
    const host = new URL(value).hostname.toLowerCase();
    return (
      (value.startsWith('https://') || value.startsWith('http://')) &&
      host !== 'localhost' &&
      !/(^|\.)example\.(com|org|net)$/.test(host)
    );
  }, 'must be a public http(s) URL');

const listingSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().trim().min(2),
    street: z.string().trim().min(4),
    city: z.string().trim().min(2),
    state_code: z.string().regex(/^[A-Z]{2}$/),
    postal_code: z.union([z.string(), z.number(), z.null()]).transform((value) => {
      if (value == null) return null;
      return String(value).trim();
    }),
    lat: z.union([z.number().gte(-90).lte(90), z.null()]),
    lng: z.union([z.number().gte(-180).lte(180), z.null()]),
    phone: nullString.refine((value) => {
      if (value == null) return true;
      const digits = value.replace(/\D/g, '').length;
      return digits >= 10 && digits <= 15;
    }, 'phone must contain 10 to 15 digits, or be null'),
    website: z.union([publicUrl, z.null()]),
    vehicles: z.array(z.enum(['rv', 'boat'])).min(1),
    storage_types: z.array(z.enum(['covered', 'enclosed', 'open'])),
    max_length_ft: nullNumber,
    clearance_ft: nullNumber,
    power_hookups: nullBool,
    dump_station: nullBool,
    wash_station: nullBool,
    gated: nullBool,
    cameras: nullBool,
    access_24h: nullBool,
    access_hours: nullString.optional().transform((value) => value ?? null),
    price_notes: nullString,
    waitlist: nullString,
    featured: z.boolean().optional().default(false),
    billing_term: z
      .enum(['month-to-month', 'short-term'])
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    billing_detail: z
      .union([z.string(), z.null()])
      .optional()
      .transform((value) => {
        if (value == null) return null;
        const trimmed = value.trim();
        return trimmed.length ? trimmed : null;
      }),
    fees: z
      .object({
        admin: nullString.optional(),
        gate_card: nullString.optional(),
        deposit: nullString.optional(),
        access_24h: nullString.optional(),
        late: nullString.optional(),
        lock_or_insurance: nullString.optional(),
      })
      .partial()
      .optional()
      .transform((value) => ({
        admin: value?.admin ?? null,
        gate_card: value?.gate_card ?? null,
        deposit: value?.deposit ?? null,
        access_24h: value?.access_24h ?? null,
        late: value?.late ?? null,
        lock_or_insurance: value?.lock_or_insurance ?? null,
      })),
    notes: nullString,
    sources: z
      .array(
        z.object({
          url: publicUrl,
          title: z.string().trim().min(2),
        }),
      )
      .min(1),
    photo: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    last_verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .superRefine((listing, ctx) => {
    if ((listing.lat == null) !== (listing.lng == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lat'],
        message: 'lat and lng must both be numbers or both be null',
      });
    }
    const sourceUrls = listing.sources.map((source) => source.url);
    if (new Set(sourceUrls).size !== sourceUrls.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sources'],
        message: 'duplicate source URL',
      });
    }
  });

const citySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  state_code: z.string().regex(/^[A-Z]{2}$/),
  metro: z.string().trim().min(2),
  summary: z.string().trim().min(40),
  sparefoot_slug: z.string().regex(/^[A-Za-z0-9-]+$/),
  neighbor_path: z.string().regex(/^[a-z]+(?:-[a-z]+)*\/[a-z0-9-]+$/),
  sparefoot_note: nullString.optional().transform((value) => value ?? null),
  photo: z.string().regex(/^[a-z0-9-]+$/),
  listings: z.array(listingSchema).min(1),
});

const filterSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  slug_prefix: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().trim().min(2),
  vehicles: z.array(z.enum(['rv', 'boat'])).min(1),
  storage_types: z.array(z.enum(['covered', 'enclosed', 'open'])),
  require_power: z.boolean(),
  require_dump: z.boolean(),
  require_wash: z.boolean(),
  require_price: z.boolean(),
  require_24h: z
    .boolean()
    .optional()
    .transform((value) => value ?? false),
  require_gated: z
    .boolean()
    .optional()
    .transform((value) => value ?? false),
  require_cameras: z
    .boolean()
    .optional()
    .transform((value) => value ?? false),
  require_short_term: z
    .boolean()
    .optional()
    .transform((value) => value ?? false),
  min_matches: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .transform((value) => value ?? 1),
  title: z.string().min(8),
  description: z.string().min(20),
  h1: z.string().min(8),
  intro: z.string().min(20),
});

const affiliateSchema = z.object({
  name: z.string().min(2),
  homepage: publicUrl,
  search_template: z.string().min(8),
  affiliate_id: z.string(),
  affiliate_param: z.string(),
});

const siteSchema = z.object({
  name: z.string().min(2),
  tagline: z.string().min(2),
  url: z.string().url(),
  description: z.string().min(20),
  repo: publicUrl,
  corrections_email: z.string().email(),
  affiliates: z.object({
    neighbor: affiliateSchema,
    sparefoot: affiliateSchema,
  }),
});

export type Listing = z.infer<typeof listingSchema>;
export type City = z.infer<typeof citySchema>;
export type FilterDef = z.infer<typeof filterSchema>;
export type SiteConfig = z.infer<typeof siteSchema>;

function parseFile<T>(file: string, schema: z.ZodType<T>): T {
  const result = schema.safeParse(readYaml(file));
  if (!result.success) throw new Error(zodMessage(file, result.error));
  return result.data;
}

function loadSite(): SiteConfig {
  const site = parseFile(path.join(dataDir, 'site.yaml'), siteSchema);
  for (const [key, partner] of Object.entries(site.affiliates)) {
    const hasId = partner.affiliate_id.trim().length > 0;
    const hasParam = partner.affiliate_param.trim().length > 0;
    if (hasId !== hasParam) {
      throw new Error(`${key}: set both affiliate_id and affiliate_param, or leave both empty.`);
    }
  }
  if (!site.affiliates.neighbor.search_template.includes('{neighbor_path}')) {
    throw new Error('Neighbor search_template must include {neighbor_path}.');
  }
  if (!site.affiliates.sparefoot.search_template.includes('{sparefoot_slug}')) {
    throw new Error('SpareFoot search_template must include {sparefoot_slug}.');
  }
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
  const urlBase = new URL(site.url).pathname.replace(/\/$/, '');
  if (baseUrl !== urlBase) {
    throw new Error(`Astro base "${baseUrl}" does not match site.url path "${urlBase}".`);
  }
  return site;
}

function loadCities(): City[] {
  const dir = path.join(dataDir, 'cities');
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.yaml'))
    .sort();
  const cities = files.map((name) => {
    const file = path.join(dir, name);
    const city = parseFile(file, citySchema);
    const expected = name.replace(/\.yaml$/, '');
    if (city.id !== expected) {
      throw new Error(`${name}: id "${city.id}" must match the filename.`);
    }
    assertCityPhoto(city.photo);
    for (const listing of city.listings) {
      if (listing.photo) assertKnownPhoto(listing.photo);
    }
    return {
      ...city,
      listings: city.listings
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' })),
    };
  });

  const slugs = new Set<string>();
  const websites = new Map<string, string>();
  for (const city of cities) {
    for (const listing of city.listings) {
      if (slugs.has(listing.slug)) throw new Error(`Duplicate listing slug "${listing.slug}".`);
      slugs.add(listing.slug);
      if (listing.website) {
        const key = listing.website.replace(/\/$/, '');
        const prior = websites.get(key);
        if (prior) throw new Error(`Duplicate website ${key} on ${prior} and ${listing.slug}.`);
        websites.set(key, listing.slug);
      }
    }
  }

  return cities.sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city));
}

function loadFilters(): FilterDef[] {
  const file = path.join(dataDir, 'filters.yaml');
  const result = z.array(filterSchema).min(1).safeParse(readYaml(file));
  if (!result.success) throw new Error(zodMessage(file, result.error));
  const ids = new Set<string>();
  for (const filter of result.data) {
    if (ids.has(filter.id)) throw new Error(`Duplicate filter id "${filter.id}".`);
    ids.add(filter.id);
  }
  return result.data;
}

export const site = loadSite();
const cities = loadCities();
const filters = loadFilters();

export interface StateGroup {
  slug: string;
  name: string;
  code: string;
  cities: City[];
}

export interface FilterPage {
  slug: string;
  path: string;
  city: City;
  filter: FilterDef;
  matches: Listing[];
  title: string;
  description: string;
  h1: string;
  intro: string;
}

export function stateSlug(state: string): string {
  return state
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function getCities(): City[] {
  return cities;
}

export function getCity(id: string): City {
  const city = cities.find((item) => item.id === id);
  if (!city) throw new Error(`Unknown city ${id}`);
  return city;
}

export function getStates(): StateGroup[] {
  const groups = new Map<string, StateGroup>();
  for (const city of cities) {
    const slug = stateSlug(city.state);
    const existing = groups.get(slug);
    if (!existing) {
      groups.set(slug, { slug, name: city.state, code: city.state_code, cities: [city] });
      continue;
    }
    if (existing.code !== city.state_code) {
      throw new Error(`State code mismatch for ${city.state}.`);
    }
    existing.cities.push(city);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getState(slug: string): StateGroup {
  const state = getStates().find((item) => item.slug === slug);
  if (!state) throw new Error(`Unknown state ${slug}`);
  return state;
}

export function siblingCities(city: City): City[] {
  return cities.filter((item) => item.state_code === city.state_code && item.id !== city.id);
}

export function searchIndex(): {
  id: string;
  city: string;
  state: string;
  code: string;
  metro: string;
  zips: string[];
}[] {
  return cities.map((city) => ({
    id: city.id,
    city: city.city,
    state: city.state,
    code: city.state_code,
    metro: city.metro,
    zips: [...new Set(city.listings.map((listing) => listing.postal_code).filter((zip): zip is string => Boolean(zip)))],
  }));
}

export function listingMatches(listing: Listing, filter: FilterDef): boolean {
  if (!filter.vehicles.some((vehicle) => listing.vehicles.includes(vehicle))) return false;
  if (!filter.storage_types.every((type) => listing.storage_types.includes(type))) return false;
  if (filter.require_power && listing.power_hookups !== true) return false;
  if (filter.require_dump && listing.dump_station !== true) return false;
  if (filter.require_wash && listing.wash_station !== true) return false;
  if (filter.require_price && !listing.price_notes) return false;
  if (filter.require_24h && listing.access_24h !== true) return false;
  if (filter.require_gated && listing.gated !== true) return false;
  if (filter.require_cameras && listing.cameras !== true) return false;
  if (filter.require_short_term && listing.billing_term == null) return false;
  return true;
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z_]+)\}/g, (match, key: string) => {
    if (!(key in vars)) throw new Error(`Unknown placeholder ${key} in "${template}".`);
    return vars[key];
  });
}

let filterPageCache: FilterPage[] | null = null;

export function getFilterPages(): FilterPage[] {
  if (filterPageCache) return filterPageCache;
  const pages: FilterPage[] = [];
  const slugs = new Set<string>();
  for (const city of cities) {
    for (const filter of filters) {
      const matches = city.listings.filter((listing) => listingMatches(listing, filter));
      if (matches.length < filter.min_matches) continue;
      const slug = `${filter.slug_prefix}-${city.id}`;
      if (slugs.has(slug)) throw new Error(`Duplicate filter slug ${slug}.`);
      slugs.add(slug);
      const vars = {
        city: city.city,
        state: city.state,
        state_code: city.state_code,
        metro: city.metro,
        count: String(matches.length),
      };
      pages.push({
        slug,
        path: `/storage/${slug}/`,
        city,
        filter,
        matches,
        title: `${fill(filter.title, vars)} | ${site.name}`,
        description: fill(filter.description, vars),
        h1: fill(filter.h1, vars),
        intro: fill(filter.intro, vars),
      });
    }
  }
  filterPageCache = pages;
  return pages;
}

export function getFilterPage(slug: string): FilterPage {
  const page = getFilterPages().find((item) => item.slug === slug);
  if (!page) throw new Error(`Unknown filter page ${slug}`);
  return page;
}

export function filtersForCity(cityId: string): FilterPage[] {
  return getFilterPages().filter((page) => page.city.id === cityId);
}

export function filterGroups(): { filter: FilterDef; pages: FilterPage[] }[] {
  const pages = getFilterPages();
  return filters
    .map((filter) => ({
      filter,
      pages: pages.filter((page) => page.filter.id === filter.id),
    }))
    .filter((group) => group.pages.length > 0);
}

export function cityStats(city: City): {
  total: number;
  priced: number;
  covered: number;
  boat: number;
  power: number;
} {
  return {
    total: city.listings.length,
    priced: city.listings.filter((listing) => listing.price_notes).length,
    covered: city.listings.filter((listing) => listing.storage_types.includes('covered')).length,
    boat: city.listings.filter((listing) => listing.vehicles.includes('boat')).length,
    power: city.listings.filter((listing) => listing.power_hookups === true).length,
  };
}

export function directoryStats(): {
  facilities: number;
  cities: number;
  states: number;
  priced: number;
  earliest: string;
  latest: string;
} {
  const listings = cities.flatMap((city) => city.listings);
  const dates = listings.map((listing) => listing.last_verified).sort();
  return {
    facilities: listings.length,
    cities: cities.length,
    states: new Set(cities.map((city) => city.state_code)).size,
    priced: listings.filter((listing) => listing.price_notes).length,
    earliest: dates[0] ?? '',
    latest: dates[dates.length - 1] ?? '',
  };
}

export function checkedLabel(): string {
  const stats = directoryStats();
  if (stats.earliest === stats.latest) return `Source pages checked ${formatDate(stats.latest)}.`;
  return `Source pages checked ${formatDate(stats.earliest)} to ${formatDate(stats.latest)}.`;
}

export function href(urlPath: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const hashAt = urlPath.indexOf('#');
  const hash = hashAt >= 0 ? urlPath.slice(hashAt) : '';
  let pathname = hashAt >= 0 ? urlPath.slice(0, hashAt) : urlPath;
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  const isFile = /\.[a-z0-9]+$/i.test(pathname);
  if (!isFile && !pathname.endsWith('/')) pathname = `${pathname}/`;
  return `${base}${pathname}${hash}`;
}

export function absolute(urlPath: string): string {
  return new URL(href(urlPath), new URL(site.url).origin).href;
}

export function correctionMailto(cityName?: string): string {
  const subject = cityName ? `RV storage correction: ${cityName}` : 'RV storage correction';
  const body = 'Facility name, city, and what changed:';
  return `mailto:${site.corrections_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function partnerUrl(which: 'neighbor' | 'sparefoot', city?: City): string {
  const partner = site.affiliates[which];
  let url = partner.homepage;
  if (city && which === 'neighbor') {
    url = fill(partner.search_template, { neighbor_path: city.neighbor_path });
  } else if (city && which === 'sparefoot') {
    url = fill(partner.search_template, { sparefoot_slug: city.sparefoot_slug });
  }
  const built = new URL(url);
  if (partner.affiliate_id.trim() && partner.affiliate_param.trim()) {
    built.searchParams.set(partner.affiliate_param.trim(), partner.affiliate_id.trim());
  }
  return built.toString();
}

export function allPublicPaths(): { path: string; lastmod: string }[] {
  const latest = directoryStats().latest;
  const maxDate = (dates: string[]) => dates.slice().sort().at(-1) ?? latest;
  const paths: { path: string; lastmod: string }[] = [
    { path: '/', lastmod: latest },
    { path: '/storage/', lastmod: latest },
    { path: '/states/', lastmod: latest },
    { path: '/guide/', lastmod: latest },
    { path: '/guides/', lastmod: latest },
    { path: '/guides/snowbird-rv-storage-florida/', lastmod: '2026-11-20' },
    { path: '/guides/snowbird-rv-storage-arizona/', lastmod: '2026-11-20' },
    { path: '/guides/short-term-rv-storage/', lastmod: '2026-11-20' },
    { path: '/guides/rv-storage-fees-move-in-costs/', lastmod: '2026-11-20' },
    { path: '/guides/can-hoa-ban-rv-parking-florida/', lastmod: '2026-11-20' },
    { path: '/guides/can-hoa-ban-rv-parking-arizona/', lastmod: '2026-11-20' },
    { path: '/guides/can-hoa-ban-rv-parking-texas/', lastmod: '2026-11-20' },
    { path: '/guides/can-hoa-ban-rv-parking-georgia/', lastmod: '2026-11-20' },
    { path: '/guides/can-hoa-ban-rv-parking-nevada/', lastmod: '2026-11-20' },
    { path: '/guides/can-hoa-ban-rv-parking-north-carolina/', lastmod: '2026-11-20' },
    { path: '/guides/class-a-rv-storage/', lastmod: '2026-11-20' },
    { path: '/guides/boat-storage-by-length/', lastmod: '2026-11-20' },
    ...RV_LENGTHS.map((feet) => ({ path: `/guides/${feet}-foot-rv-storage/`, lastmod: '2026-11-20' })),
    ...BOAT_LENGTHS.map((feet) => ({ path: `/guides/${feet}-foot-boat-storage/`, lastmod: '2026-11-20' })),
    { path: '/checklists/seasonal/', lastmod: latest },
    { path: '/checklists/security/', lastmod: latest },
    { path: '/insurance/', lastmod: '2026-11-19' },
    { path: '/advertise/', lastmod: '2026-11-20' },
    { path: '/advertise/thanks/', lastmod: '2026-11-20' },
    { path: '/costs/', lastmod: latest },
    { path: '/about/', lastmod: latest },
    { path: '/contact/', lastmod: '2026-11-19' },
    { path: '/privacy/', lastmod: '2026-11-19' },
    { path: '/terms/', lastmod: '2026-11-19' },
    { path: '/rules/', lastmod: '2026-11-19' },
    { path: '/rules/florida/', lastmod: '2026-11-19' },
    { path: '/rules/nevada/', lastmod: '2026-11-19' },
    { path: '/rules/arizona/', lastmod: '2026-11-19' },
    { path: '/rules/texas/', lastmod: '2026-11-19' },
    { path: '/rules/georgia/', lastmod: '2026-11-19' },
    { path: '/rules/north-carolina/', lastmod: '2026-11-19' },
    { path: '/disclosure/', lastmod: latest },
    { path: '/credits/', lastmod: latest },
  ];
  for (const state of getStates()) {
    const dates = state.cities.flatMap((city) => city.listings.map((listing) => listing.last_verified));
    paths.push({
      path: `/states/${state.slug}/`,
      lastmod: maxDate(dates),
    });
    paths.push({
      path: `/costs/${state.slug}/`,
      lastmod: maxDate(dates),
    });
  }
  for (const city of cities) {
    const dates = city.listings.map((listing) => listing.last_verified);
    paths.push({
      path: `/cities/${city.id}/`,
      lastmod: maxDate(dates),
    });
    paths.push({
      path: `/costs/${city.id}/`,
      lastmod: maxDate(dates),
    });
  }
  for (const guide of getCostGuides()) {
    paths.push({ path: guide.path, lastmod: guide.lastmod });
  }
  for (const page of getFitPages()) {
    paths.push({
      path: page.path,
      lastmod: maxDate(page.matches.map((listing) => listing.last_verified)),
    });
  }
  for (const page of getFilterPages()) {
    paths.push({
      path: page.path,
      lastmod: maxDate(page.matches.map((listing) => listing.last_verified)),
    });
  }
  return paths;
}
