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
  start: number;
  end: number;
  addon: boolean;
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
    const addon = isAddOn(before, after);
    if (kind === 'other' && sentenceMonthly && !ownYear && !sentencePerFoot) kind = 'month';
    if (kind === 'month' && addon) kind = 'other';
    found.push({
      value,
      kind,
      sentence,
      start: index,
      end: index + match[0].length,
      addon,
    });
  }
  return found;
}

export function lowestMonthlyAmounts(notes: (string | null)[]): number[] {
  const amounts: number[] = [];
  for (const note of notes) {
    const monthly = parsePriceNote(note).monthly;
    if (monthly.length) amounts.push(Math.min(...monthly));
  }
  return amounts;
}

export function pageIsThin(listings: { price_notes: string | null }[]): boolean {
  return listings.length < 2 && lowestMonthlyAmounts(listings.map((listing) => listing.price_notes)).length === 0;
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

export const coverLabel: Record<CoverKind, string> = {
  open: 'Open',
  covered: 'Covered',
  enclosed: 'Enclosed',
};

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

export function formatMonthlyRange(low: number, high: number): string {
  if (low === high) return `${formatMoney(low)}/mo`;
  return `${formatMoney(low)}–${formatMoney(high)}/mo`;
}

export function formatSpan(span: MonthlySpan): string {
  if (span.count === 0 || span.low == null || span.high == null) return 'Not listed';
  const facilities = span.count === 1 ? '1 facility' : `${span.count} facilities`;
  return `${formatMonthlyRange(span.low, span.high)} · ${facilities}`;
}

export type PriceUnit = 'mo' | 'ft-mo' | 'ft' | 'yr' | 'unstated';

export interface PriceLine {
  amount: number;
  unit: PriceUnit;
  cover: CoverKind | null;
  length: string | null;
}

const monthWords = /\b(?:per|a)\s+month\b|\/\s*(?:month|mo)\b|\bmonthly\b/i;
const footWords = /\b(?:per|a)\s+(?:linear\s+)?foot\b|\/\s*ft\b/i;
const yearWords = /\b(?:per|a)\s+year\b|\bannually\b/i;

function coversNamed(text: string, allowed: readonly CoverKind[]): CoverKind[] {
  return allowed.filter((type) => coverWord[type].test(text));
}

function lengthLabel(text: string): string | null {
  const upTo = text.match(/\bup to\s+(\d+(?:\.\d+)?)\s*(?:ft|feet)\b/i);
  if (upTo) return `up to ${trimLength(upTo[1])} ft`;
  const plus = text.match(/\b(\d+)\+\s*(?:ft|feet)\b/i);
  if (plus) return `${plus[1]}+ ft`;
  const range = text.match(
    /\b(\d+(?:\.\d+)?)\s*(?:ft|feet)?\s+to\s+(\d+(?:\.\d+)?)\s*(?:ft|feet)(?:\s+(\d+)\s*in)?\b/i,
  );
  if (range) {
    const endIn = range[3] ? ` ${range[3]} in` : '';
    return `${trimLength(range[1])} ft–${trimLength(range[2])} ft${endIn}`;
  }
  const single = text.match(/\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:ft|feet)\b/i);
  if (single && !/\bper\s+(?:linear\s+)?foot\b/i.test(single[0])) return `${trimLength(single[1])} ft`;
  return null;
}

function lengthForClause(clause: string): string | null {
  const dollar = clause.search(/\$\s*\d/);
  const before = dollar >= 0 ? clause.slice(0, dollar) : clause;
  const after = dollar >= 0 ? clause.slice(dollar) : '';
  const paren = after.match(/\$\s*\d[\d,]*(?:\.\d{2})?\s*(?:per\s+[a-z]+\s*)*\(([^)]*(?:ft|feet)[^)]*)\)/i);
  if (paren) return lengthLabel(paren[1]);
  const beforeLength = lengthLabel(before);
  if (beforeLength) return beforeLength;
  return lengthLabel(after.split(',')[0] ?? '');
}

function trimLength(raw: string): string {
  const value = Number(raw);
  if (!Number.isFinite(value)) return raw;
  return Number.isInteger(value) ? String(value) : String(value);
}

function unitFor(item: TaggedAmount): PriceUnit {
  if (item.kind === 'month') return 'mo';
  if (item.kind === 'foot') return monthWords.test(item.sentence) ? 'ft-mo' : 'ft';
  if (yearWords.test(item.sentence) && !monthWords.test(item.sentence)) return 'yr';
  return 'unstated';
}

export function priceLines(listing: {
  storage_types: readonly string[];
  price_notes: string | null;
}): PriceLine[] {
  const note = listing.price_notes;
  if (!note) return [];
  const amounts = taggedAmounts(note).filter((item) => !item.addon);
  const types = (['open', 'covered', 'enclosed'] as const).filter((type) => listing.storage_types.includes(type));
  const lines: PriceLine[] = [];
  for (const [index, item] of amounts.entries()) {
    const sentenceStart = Math.max(0, note.lastIndexOf(item.sentence, item.start));
    const sentenceEnd = sentenceStart + item.sentence.length;
    const previous = amounts[index - 1];
    const next = amounts[index + 1];
    const clauseStart = previous && previous.start >= sentenceStart ? previous.end : sentenceStart;
    const clauseEnd = next && next.start < sentenceEnd ? next.start : sentenceEnd;
    const clause = note.slice(clauseStart, clauseEnd);
    const dollar = clause.search(/\$\s*\d/);
    const before = dollar >= 0 ? clause.slice(0, dollar) : clause;
    const afterHead = (dollar >= 0 ? clause.slice(dollar) : '').split(/,|\band\b/i)[0] ?? '';
    const near = coversNamed(`${before} ${afterHead}`, ['open', 'covered', 'enclosed']);
    const sentenceCovers = coversNamed(item.sentence, ['open', 'covered', 'enclosed']);
    let leadIn: CoverKind | null = null;
    if (sentenceCovers.length === 1) {
      const match = item.sentence.match(coverWord[sentenceCovers[0]]);
      const firstAmount = amounts.find((amount) => amount.start >= sentenceStart && amount.start < sentenceEnd);
      if (match?.index != null && firstAmount && sentenceStart + match.index < firstAmount.start) {
        leadIn = sentenceCovers[0];
      }
    }
    const previousLine = lines.at(-1);
    let cover: CoverKind | null = null;
    if (near.length === 1) cover = near[0];
    else if (previousLine && previous && previous.start >= sentenceStart && /\bto\s*$/i.test(before.trim())) {
      cover = previousLine.cover;
    } else if (leadIn) cover = leadIn;
    else if (types.length === 1) cover = types[0];
    lines.push({
      amount: item.value,
      unit: unitFor(item),
      cover,
      length: lengthForClause(clause),
    });
  }
  return lines;
}

export function priceAmount(line: PriceLine): string {
  const money = formatMoney(line.amount);
  if (line.unit === 'mo') return `${money}/mo`;
  if (line.unit === 'ft-mo') return `${money}/ft/mo`;
  if (line.unit === 'ft') return `${money}/ft · period not stated`;
  if (line.unit === 'yr') return `${money}/yr`;
  return `${money} · period not stated`;
}

export function priceLineText(line: PriceLine, includeCover = true): string {
  const parts = [priceAmount(line)];
  if (includeCover && line.cover) parts.push(coverLabel[line.cover]);
  if (line.length) parts.push(line.length);
  return parts.join(' · ');
}

export function priceHeadline(lines: PriceLine[]): string | null {
  const monthly = lines.filter((line) => line.unit === 'mo');
  if (monthly.length) return `From ${formatMoney(Math.min(...monthly.map((line) => line.amount)))}/mo`;
  const perFoot = lines.filter((line) => line.unit === 'ft-mo');
  if (perFoot.length) return `From ${formatMoney(Math.min(...perFoot.map((line) => line.amount)))}/ft/mo`;
  return null;
}

export function priceSortRank(lines: PriceLine[]): [number, number] {
  const monthly = lines.filter((line) => line.unit === 'mo').map((line) => line.amount);
  if (monthly.length) return [0, Math.min(...monthly)];
  const perFoot = lines.filter((line) => line.unit === 'ft-mo').map((line) => line.amount);
  if (perFoot.length) return [1, Math.min(...perFoot)];
  const rest = lines
    .filter((line) => line.unit === 'ft' || line.unit === 'yr' || line.unit === 'unstated')
    .map((line) => line.amount);
  if (rest.length) return [2, Math.min(...rest)];
  return [3, Number.POSITIVE_INFINITY];
}

export function formatPriceBlock(listing: {
  storage_types: readonly string[];
  price_notes: string | null;
}): string {
  const lines = priceLines(listing);
  if (!lines.length) return 'Price not posted, call for rates';
  const head = priceHeadline(lines);
  const body = lines.map((line) => priceLineText(line, true)).join('\n');
  return head ? `${head}\n${body}` : body;
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
    return `None of the ${total} sourced facilities in ${city}, ${state} printed a monthly dollar amount. A dollar amount with no billing period is marked “period not stated.”`;
  }
  if (span.low === span.high) {
    return `${span.count} of ${total} facilities in ${city}, ${state} print a monthly amount. That published figure is ${formatMoney(span.low)}/mo. These notes are copied, not averaged.`;
  }
  return `${span.count} of ${total} facilities in ${city}, ${state} print a monthly amount. Published figures run from ${formatMoney(span.low)}/mo to ${formatMoney(span.high)}/mo, and are not averaged.`;
}

export function stateCostDescription(input: {
  state: string;
  total: number;
  span: MonthlySpan;
}): string {
  const { state, total, span } = input;
  if (span.count === 0 || span.low == null || span.high == null) {
    return `None of the ${total} sourced facilities in ${state} printed a monthly dollar amount. A dollar amount with no billing period is marked “period not stated.”`;
  }
  if (span.low === span.high) {
    return `${span.count} of ${total} facilities in ${state} print a monthly amount. That published figure is ${formatMoney(span.low)}/mo. City pages list the facility behind it.`;
  }
  return `${span.count} of ${total} facilities in ${state} print a monthly amount. Published figures run from ${formatMoney(span.low)}/mo to ${formatMoney(span.high)}/mo. Each city page names the facility.`;
}
