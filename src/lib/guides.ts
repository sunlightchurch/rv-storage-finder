import { getCities, type City, type Listing } from './data';
import { formatMoney, priceLines, type CoverKind } from './prices';

const MIN_PRICED_FACILITIES = 3;

export const coverGuideLabel: Record<CoverKind, string> = {
  open: 'Uncovered',
  covered: 'Covered',
  enclosed: 'Indoor',
};

export interface PriceBand {
  cover: CoverKind | null;
  min: number;
  median: number;
  max: number;
  amounts: number;
  facilities: number;
}

export interface PricedFacility {
  listing: Listing;
  cityId: string;
  amounts: number[];
  covers: CoverKind[];
}

export interface CityCostGuide {
  kind: 'city';
  slug: string;
  path: string;
  city: City;
  sampled: PricedFacility[];
  overall: PriceBand;
  covers: PriceBand[];
  lastmod: string;
}

export interface CompareCostGuide {
  kind: 'compare';
  slug: string;
  path: string;
  covers: PriceBand[];
  sampledFacilities: number;
  lastmod: string;
}

export type CostGuide = CityCostGuide | CompareCostGuide;

export function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

function band(cover: CoverKind | null, values: number[], facilities: number): PriceBand | null {
  if (!values.length || !facilities) return null;
  return {
    cover,
    min: Math.min(...values),
    median: medianOf(values),
    max: Math.max(...values),
    amounts: values.length,
    facilities,
  };
}

function pricedFacilities(listings: Listing[], cityId: string): PricedFacility[] {
  const rows: PricedFacility[] = [];
  for (const listing of listings) {
    const monthly = priceLines(listing).filter((line) => line.unit === 'mo');
    if (!monthly.length) continue;
    rows.push({
      listing,
      cityId,
      amounts: monthly.map((line) => line.amount),
      covers: [...new Set(monthly.map((line) => line.cover).filter((cover): cover is CoverKind => cover != null))],
    });
  }
  return rows;
}

function coverBands(rows: PricedFacility[]): PriceBand[] {
  const bands: PriceBand[] = [];
  for (const cover of ['open', 'covered', 'enclosed'] as const) {
    const members = rows.filter((row) => row.covers.includes(cover));
    const values = members.flatMap((row) => {
      const lines = priceLines(row.listing).filter((line) => line.unit === 'mo' && line.cover === cover);
      return lines.map((line) => line.amount);
    });
    const next = band(cover, values, members.length);
    if (next) bands.push(next);
  }
  return bands;
}

export function getCityCostGuides(): CityCostGuide[] {
  const guides: CityCostGuide[] = [];
  for (const city of getCities()) {
    const sampled = pricedFacilities(city.listings, city.id);
    if (sampled.length < MIN_PRICED_FACILITIES) continue;
    const values = sampled.flatMap((row) => row.amounts);
    const overall = band(null, values, sampled.length);
    if (!overall) continue;
    const dates = sampled.map((row) => row.listing.last_verified).sort();
    guides.push({
      kind: 'city',
      slug: city.id,
      path: `/guides/${city.id}/`,
      city,
      sampled,
      overall,
      covers: coverBands(sampled),
      lastmod: dates.at(-1) ?? overall.min.toString(),
    });
  }
  return guides.sort(
    (a, b) => b.city.listings.length - a.city.listings.length || a.city.city.localeCompare(b.city.city),
  );
}

export function getCompareCostGuide(): CompareCostGuide {
  const rows = getCities().flatMap((city) => pricedFacilities(city.listings, city.id));
  const dates = rows.map((row) => row.listing.last_verified).sort();
  return {
    kind: 'compare',
    slug: 'covered-vs-uncovered-vs-indoor',
    path: '/guides/covered-vs-uncovered-vs-indoor/',
    covers: coverBands(rows),
    sampledFacilities: rows.length,
    lastmod: dates.at(-1) ?? '2026-11-19',
  };
}

export function getCostGuides(): CostGuide[] {
  return [getCompareCostGuide(), ...getCityCostGuides()];
}

export function formatBand(value: number): string {
  return `${formatMoney(value)}/mo`;
}
