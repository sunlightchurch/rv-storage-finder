import { getCities, type City, type Listing } from './data';

export type FitKind = 'rv' | 'boat';

export const RV_LENGTHS = [30, 35, 40, 45] as const;
export const BOAT_LENGTHS = [30, 40] as const;

export interface FitPage {
  city: City;
  kind: FitKind;
  feet: number;
  slug: string;
  path: string;
  matches: Listing[];
}

export function fitSlug(kind: FitKind, feet: number): string {
  return `${feet}-foot-${kind}-storage`;
}

export function listingFits(listing: Listing, kind: FitKind, feet: number): boolean {
  if (!listing.vehicles.includes(kind)) return false;
  return listing.max_length_ft != null && listing.max_length_ft >= feet;
}

const specs: { kind: FitKind; feet: number }[] = [
  ...RV_LENGTHS.map((feet) => ({ kind: 'rv' as const, feet })),
  ...BOAT_LENGTHS.map((feet) => ({ kind: 'boat' as const, feet })),
];

let cache: FitPage[] | null = null;

export function getFitPages(): FitPage[] {
  if (cache) return cache;
  const pages: FitPage[] = [];
  for (const city of getCities()) {
    for (const spec of specs) {
      const matches = city.listings.filter((listing) => listingFits(listing, spec.kind, spec.feet));
      if (matches.length < 3) continue;
      const slug = fitSlug(spec.kind, spec.feet);
      pages.push({
        city,
        kind: spec.kind,
        feet: spec.feet,
        slug,
        path: `/cities/${city.id}/${slug}/`,
        matches,
      });
    }
  }
  cache = pages;
  return pages;
}

export function fitPagesForCity(cityId: string): FitPage[] {
  return getFitPages().filter((page) => page.city.id === cityId);
}

export function classARows(): { city: City; listing: Listing }[] {
  const rows: { city: City; listing: Listing }[] = [];
  for (const city of getCities()) {
    for (const listing of city.listings) {
      const blob = `${listing.notes ?? ''} ${listing.price_notes ?? ''}`;
      if (/class a/i.test(blob)) rows.push({ city, listing });
    }
  }
  return rows.sort((a, b) => a.listing.name.localeCompare(b.listing.name));
}
