import type { City, Listing } from './data';
import { medianOf } from './guides';
import { formatMoney, lowestMonthlyAmounts } from './prices';

export function boatCount(listings: Listing[]): number {
  return listings.filter((listing) => listing.vehicles.includes('boat')).length;
}

export function cityTitle(city: Pick<City, 'city' | 'state_code' | 'listings'>): string {
  const boats = boatCount(city.listings);
  const count = city.listings.length;
  const places = count === 1 ? '1 Location' : `${count} Locations`;
  const priced = boats
    ? `RV & Boat Storage in ${city.city}, ${city.state_code}: Prices for ${places}`
    : `RV Storage in ${city.city}, ${city.state_code}: Prices for ${places}`;
  if (priced.length <= 60) return priced;
  const named = boats
    ? `RV & Boat Storage in ${city.city}, ${city.state_code}`
    : `RV Storage in ${city.city}, ${city.state_code}`;
  if (named.length <= 60) return named;
  return boats
    ? `Boat & RV Storage, ${city.city}, ${city.state_code}`
    : `RV Storage, ${city.city}, ${city.state_code}`;
}

export function placeDescription(place: string, listings: Listing[]): string {
  const count = listings.length;
  const boats = boatCount(listings);
  const monthly = lowestMonthlyAmounts(listings.map((listing) => listing.price_notes));
  const median = monthly.length ? medianOf(monthly) : null;
  const locations = count === 1 ? '1 location' : `${count} locations`;
  const boatLine =
    boats === 0
      ? 'None of these sources list boat storage.'
      : boats === 1
        ? '1 location lists boat storage.'
        : `${boats} locations list boat storage.`;
  const priceLine =
    median == null
      ? 'No monthly price is published.'
      : `The median of the lowest published monthly price is ${formatMoney(median)}.`;
  return `${locations} in ${place}. ${boatLine} ${priceLine} A price is shown only when the facility printed it.`;
}
