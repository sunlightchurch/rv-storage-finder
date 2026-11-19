export interface PriceNote {
  monthly: number[];
  perFoot: number[];
  sawDollar: boolean;
}

const amountPattern = /\$\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?/g;

function amountValue(match: RegExpExecArray): number {
  const dollars = Number(match[1].replace(/,/g, ''));
  const cents = match[2] ? Number(match[2]) / 100 : 0;
  return Math.round((dollars + cents) * 100) / 100;
}

function classify(after: string): 'month' | 'foot' | 'other' {
  const text = after.toLowerCase();
  const footAt = text.search(/\b(?:per|a)\s+(?:linear\s+)?foot\b|\/\s*ft\b/);
  const monthAt = text.search(/\b(?:per|a)\s+month\b|\/\s*(?:month|mo)\b/);
  const yearAt = text.search(/\b(?:per|a)\s+year\b|\bannually\b/);
  if (footAt >= 0 && (monthAt < 0 || footAt <= monthAt)) return 'foot';
  if (monthAt >= 0 && (yearAt < 0 || monthAt < yearAt)) return 'month';
  return 'other';
}

function isAddOn(before: string, after: string): boolean {
  const around = `${before} ${after}`;
  return /\b(?:extra|additional|fee|deposit|card)\b/i.test(around) || /\baccess is\s*$/i.test(before);
}

function previousBreak(text: string, from: number): number {
  for (let index = from - 1; index >= 0; index -= 1) {
    const char = text[index];
    if (char === ';' || (char === '.' && !/\d/.test(text[index + 1] ?? ''))) return index;
  }
  return -1;
}

function nextBreak(text: string, from: number): number {
  for (let index = from; index < text.length; index += 1) {
    const char = text[index];
    if (char === ';' || (char === '.' && !/\d/.test(text[index + 1] ?? ''))) return index;
  }
  return text.length;
}

export interface TaggedAmount {
  value: number;
  kind: 'month' | 'foot' | 'other';
  sentence: string;
}

export function taggedAmounts(note: string | null): TaggedAmount[] {
  if (!note) return [];
  const found: TaggedAmount[] = [];
  for (const match of note.matchAll(amountPattern)) {
    const value = amountValue(match);
    if (!Number.isFinite(value) || value <= 0 || value > 5000) continue;
    const index = match.index ?? 0;
    const after = note.slice(index + match[0].length, nextBreak(note, index + match[0].length));
    const before = note.slice(Math.max(0, index - 48), index);
    const sentence = note.slice(previousBreak(note, index) + 1, nextBreak(note, index + match[0].length));
    let kind = classify(after);
    const ownYear = /\b(?:per|a)\s+year\b|\bannually\b/i.test(after);
    const sentenceMonthly = /\b(?:per|a)\s+month\b|\/\s*(?:month|mo)\b|\bmonthly\b/i.test(sentence);
    const sentencePerFoot = /\b(?:per|a)\s+(?:linear\s+)?foot\b|\/\s*ft\b/i.test(sentence);
    if (kind === 'other' && sentenceMonthly && !ownYear && !sentencePerFoot) kind = 'month';
    if (kind === 'month' && isAddOn(before, after)) kind = 'other';
    found.push({ value, kind, sentence });
  }
  return found;
}

export function parsePriceNote(note: string | null): PriceNote {
  const found = taggedAmounts(note);
  const unique = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);
  return {
    monthly: unique(found.filter((item) => item.kind === 'month').map((item) => item.value)),
    perFoot: unique(found.filter((item) => item.kind === 'foot').map((item) => item.value)),
    sawDollar: Boolean(note?.includes('$')),
  };
}

export type CoverKind = 'open' | 'covered' | 'enclosed';

const coverWord: Record<CoverKind, RegExp> = {
  open: /\b(?:uncovered|outdoor|open(?:\s+(?:parking|storage|area|lot))?)\b/i,
  covered: /\b(?:covered|canopy|carport)\b/i,
  enclosed: /\b(?:enclosed|indoor|garage|warehouse)\b/i,
};

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

export function monthlyByCover(listing: {
  storage_types: readonly string[];
  price_notes: string | null;
}): Record<CoverKind, number[]> {
  const buckets: Record<CoverKind, number[]> = { open: [], covered: [], enclosed: [] };
  const monthly = taggedAmounts(listing.price_notes).filter((item) => item.kind === 'month');
  const types = (['open', 'covered', 'enclosed'] as const).filter((type) => listing.storage_types.includes(type));
  if (!monthly.length || !types.length) {
    return { open: [], covered: [], enclosed: [] };
  }
  if (types.length === 1) {
    buckets[types[0]] = uniqueNumbers(monthly.map((item) => item.value));
    return buckets;
  }
  for (const amount of monthly) {
    const named = types.filter((type) => coverWord[type].test(amount.sentence));
    if (named.length === 1) buckets[named[0]].push(amount.value);
  }
  return {
    open: uniqueNumbers(buckets.open),
    covered: uniqueNumbers(buckets.covered),
    enclosed: uniqueNumbers(buckets.enclosed),
  };
}

export function formatSpan(span: MonthlySpan): string {
  if (span.count === 0 || span.low == null || span.high == null) return 'Not listed';
  const range = span.low === span.high ? formatMoney(span.low) : `${formatMoney(span.low)}–${formatMoney(span.high)}`;
  const facilities = span.count === 1 ? '1 facility' : `${span.count} facilities`;
  return `${range} · ${facilities}`;
}

export function formatMoney(value: number): string {
  const digits = Number.isInteger(value) ? 0 : 2;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`;
}

export function formatMoneyList(values: number[]): string {
  return values.map((value) => formatMoney(value)).join(', ');
}

export interface MonthlySpan {
  count: number;
  low: number | null;
  high: number | null;
}

export function monthlySpan(groups: number[][]): MonthlySpan {
  const priced = groups.filter((values) => values.length > 0);
  const flat = priced.flat();
  if (!flat.length) return { count: 0, low: null, high: null };
  return { count: priced.length, low: Math.min(...flat), high: Math.max(...flat) };
}

export function cityCostDescription(input: {
  city: string;
  state: string;
  total: number;
  span: MonthlySpan;
}): string {
  const { city, state, total, span } = input;
  if (span.count === 0 || span.low == null || span.high == null) {
    return `None of the ${total} sourced facilities in ${city}, ${state} printed a monthly dollar amount. A note without a billing period stays off this page.`;
  }
  if (span.low === span.high) {
    return `${span.count} of ${total} facilities in ${city}, ${state} print a monthly amount. That published figure is ${formatMoney(span.low)}. These notes are copied, not averaged.`;
  }
  return `${span.count} of ${total} facilities in ${city}, ${state} print a monthly amount. Published figures run from ${formatMoney(span.low)} to ${formatMoney(span.high)}, and are not averaged.`;
}

export function stateCostDescription(input: {
  state: string;
  total: number;
  span: MonthlySpan;
}): string {
  const { state, total, span } = input;
  if (span.count === 0 || span.low == null || span.high == null) {
    return `None of the ${total} sourced facilities in ${state} printed a monthly dollar amount. Notes that skip the billing period are not turned into a rate.`;
  }
  if (span.low === span.high) {
    return `${span.count} of ${total} facilities in ${state} print a monthly amount. That published figure is ${formatMoney(span.low)}. City pages list the facility behind it.`;
  }
  return `${span.count} of ${total} facilities in ${state} print a monthly amount. Published figures run from ${formatMoney(span.low)} to ${formatMoney(span.high)}. Each city page names the facility.`;
}
