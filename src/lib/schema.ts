import { absolute, site, type Listing } from './data';
import { formatTypes, formatVehicles } from './format';

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function pageGraph(nodes: Record<string, unknown>[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
}

export function webPageNode(opts: {
  title: string;
  description: string;
  path: string;
  dateModified?: string;
}): Record<string, unknown> {
  return {
    '@type': 'WebPage',
    name: opts.title,
    description: opts.description,
    url: absolute(opts.path),
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    isPartOf: {
      '@type': 'WebSite',
      name: site.name,
      url: absolute('/'),
    },
  };
}

export function breadcrumbNode(items: { label: string; path: string }[]): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: absolute(item.path),
    })),
  };
}

export function faqNode(faqs: { q: string; a: string }[]): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  };
}

export function listingNode(listing: Listing): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@type': ['LocalBusiness', 'SelfStorage'],
    name: listing.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: listing.street,
      addressLocality: listing.city,
      addressRegion: listing.state_code,
      addressCountry: 'US',
      ...(listing.postal_code ? { postalCode: listing.postal_code } : {}),
    },
  };
  if (listing.phone) node.telephone = listing.phone;
  if (listing.website) node.url = listing.website;
  if (listing.lat != null && listing.lng != null) {
    node.geo = {
      '@type': 'GeoCoordinates',
      latitude: listing.lat,
      longitude: listing.lng,
    };
  }
  const features: { name: string; value: boolean }[] = [];
  const flags: [string, boolean | null][] = [
    ['Power hookups', listing.power_hookups],
    ['Dump station', listing.dump_station],
    ['Wash station', listing.wash_station],
    ['Gated access', listing.gated],
    ['Security cameras', listing.cameras],
    ['24-hour access', listing.access_24h],
  ];
  for (const [name, value] of flags) {
    if (value == null) continue;
    features.push({ name, value });
  }
  if (features.length) {
    node.amenityFeature = features.map((feature) => ({
      '@type': 'LocationFeatureSpecification',
      name: feature.name,
      value: feature.value,
    }));
  }
  const description = [
    `Vehicles: ${formatVehicles(listing.vehicles)}`,
    listing.storage_types.length ? `Storage: ${formatTypes(listing.storage_types)}` : null,
    listing.max_length_ft != null ? `Longest length listed: ${listing.max_length_ft} ft` : null,
    listing.clearance_ft != null ? `Tallest clearance listed: ${listing.clearance_ft} ft` : null,
    listing.price_notes,
  ].filter(Boolean);
  node.description = description.join('. ');
  return node;
}

export function itemListNode(name: string, listings: Listing[]): Record<string, unknown> {
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: listings.length,
    itemListElement: listings.map((listing, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: listingNode(listing),
    })),
  };
}
