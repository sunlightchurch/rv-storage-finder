export const vehicleTypes = ['rv', 'boat', 'trailer', 'car'];

export function isVehicleType(value) {
  return vehicleTypes.includes(value);
}

export function vehicleFlags(listing) {
  const text = [listing.name, listing.notes, listing.price_notes].filter(Boolean).join('\n');
  return {
    rv: Array.isArray(listing.vehicles) && listing.vehicles.includes('rv'),
    boat: Array.isArray(listing.vehicles) && listing.vehicles.includes('boat'),
    trailer: /\btrailers?\b/i.test(text),
    car: /\b(?:cars?|automobiles?)\b/i.test(text) || /\bvehicle storage\b/i.test(text),
  };
}
