import { getCities, type City, type Listing } from './data';
import { priceHeadline, priceLines } from './prices';
import { feeFields, termLabel, type FeeKey } from './terms';

export interface TermRow {
  city: City;
  listing: Listing;
  term: string;
  price: string;
}

export interface FeeExample {
  city: City;
  listing: Listing;
  label: string;
  value: string;
}

export function termRows(stateCode?: string): TermRow[] {
  const rows: TermRow[] = [];
  for (const city of getCities()) {
    if (stateCode && city.state_code !== stateCode) continue;
    for (const listing of city.listings) {
      if (!listing.billing_term) continue;
      const headline = priceHeadline(priceLines(listing));
      rows.push({
        city,
        listing,
        term: listing.billing_detail
          ? `${termLabel(listing.billing_term)}. ${listing.billing_detail}`
          : termLabel(listing.billing_term),
        price: headline ?? 'Price not posted, call for rates',
      });
    }
  }
  return rows.sort(
    (a, b) => a.city.city.localeCompare(b.city.city) || a.listing.name.localeCompare(b.listing.name),
  );
}

export function feeExamples(): FeeExample[] {
  const rows: FeeExample[] = [];
  for (const city of getCities()) {
    for (const listing of city.listings) {
      for (const [key, label] of feeFields) {
        const value = listing.fees[key as FeeKey];
        if (!value) continue;
        rows.push({ city, listing, label, value });
      }
    }
  }
  return rows.sort(
    (a, b) => a.label.localeCompare(b.label) || a.listing.name.localeCompare(b.listing.name),
  );
}
