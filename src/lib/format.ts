export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatFeet(value: number | null): string {
  if (value == null) return 'Not listed';
  return `${value} ft`;
}

export function formatBool(value: boolean | null): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Not listed';
}

export function factClass(value: boolean | null): string {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return 'unknown';
}

const typeLabels: Record<string, string> = {
  covered: 'Covered',
  enclosed: 'Enclosed',
  open: 'Open / uncovered',
};

const typeOrder = ['covered', 'enclosed', 'open'];

export function formatTypes(types: readonly string[]): string {
  if (!types.length) return 'Not listed';
  return [...types]
    .sort((a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b))
    .map((type) => typeLabels[type] ?? type)
    .join(', ');
}

const vehicleLabels: Record<string, string> = {
  rv: 'RV',
  boat: 'Boat',
};

export function formatVehicles(vehicles: readonly string[]): string {
  return [...vehicles]
    .sort((a, b) => a.localeCompare(b))
    .reverse()
    .map((vehicle) => vehicleLabels[vehicle] ?? vehicle)
    .join(', ');
}

export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return `tel:+1${national}`;
}

export function mapUrl(listing: {
  street: string;
  city: string;
  state_code: string;
  postal_code: string | null;
}): string {
  const query = [listing.street, listing.city, listing.state_code, listing.postal_code]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
