import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { lowestMonthlyAmounts } from '../src/lib/prices.ts';

const root = process.cwd();
const dist = path.join(root, 'dist');
const base = '';
const origin = 'https://rvstorageprices.com';
const failures = [];

function fail(message) {
  failures.push(message);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function decode(html) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function fileToUrl(file) {
  let rel = path.relative(dist, file).split(path.sep).join('/');
  if (rel === 'index.html') return `${base}/`;
  if (rel.endsWith('/index.html')) return `${base}/${rel.slice(0, -'index.html'.length)}`;
  return `${base}/${rel}`;
}

function urlToFile(urlPath) {
  let pathname = urlPath.split('#')[0].split('?')[0];
  if (!pathname.startsWith(base)) return null;
  pathname = pathname.slice(base.length);
  if (pathname === '' || pathname === '/') return path.join(dist, 'index.html');
  if (pathname.endsWith('/')) return path.join(dist, pathname, 'index.html');
  return path.join(dist, pathname);
}

if (!fs.existsSync(dist)) {
  console.error('dist/ is missing. Run npm run build first.');
  process.exit(1);
}

const htmlFiles = walk(dist).filter((file) => file.endsWith('.html'));
if (!htmlFiles.length) fail('No HTML files were built.');

const titles = new Map();
const descriptions = new Map();

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const decoded = decode(html);
  const pageUrl = fileToUrl(file);
  const is404 = file.endsWith(`${path.sep}404.html`);
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? '';
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? '';
  const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1] ?? '';
  const h1s = html.match(/<h1[\s>]/g) ?? [];

  if (!title) fail(`${pageUrl} is missing a title.`);
  if (title.length < 12 || title.length > 90) fail(`${pageUrl} title length is ${title.length}.`);
  if (titles.has(title)) fail(`Duplicate title "${title}" on ${pageUrl} and ${titles.get(title)}.`);
  titles.set(title, pageUrl);

  if (!description) fail(`${pageUrl} is missing a meta description.`);
  if (description.length < 40 || description.length > 220) {
    fail(`${pageUrl} description length is ${description.length}.`);
  }
  if (descriptions.has(description)) {
    fail(`Duplicate description on ${pageUrl} and ${descriptions.get(description)}.`);
  }
  descriptions.set(description, pageUrl);

  if (h1s.length !== 1) fail(`${pageUrl} has ${h1s.length} h1 elements.`);
  if (!html.includes('property="og:title"') || !html.includes('property="og:description"')) {
    fail(`${pageUrl} is missing Open Graph tags.`);
  }

  const noindex = /noindex/i.test(robots);
  if (is404 || noindex) {
    if (!noindex) fail(`${pageUrl} should be noindex.`);
  } else {
    if (!/index,\s*follow/i.test(robots)) fail(`${pageUrl} should be index,follow.`);
    const expected = `${origin}${pageUrl}`;
    if (canonical !== expected) fail(`${pageUrl} canonical is ${canonical || 'missing'}, expected ${expected}.`);
    if (!html.includes('property="og:url"')) fail(`${pageUrl} is missing og:url.`);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    if (!blocks.length) fail(`${pageUrl} is missing JSON-LD.`);
    for (const block of blocks) {
      try {
        const data = JSON.parse(block[1]);
        if (!data['@context']) fail(`${pageUrl} JSON-LD is missing @context.`);
      } catch (error) {
        fail(`${pageUrl} JSON-LD did not parse: ${error.message}`);
      }
    }
  }

  if (/lorem ipsum|example\.com|\bTODO\b|your-affiliate-id/i.test(decoded)) {
    fail(`${pageUrl} contains placeholder copy.`);
  }

  const anchors = [...html.matchAll(/<a\b([^>]*)>/g)];
  for (const anchor of anchors) {
    const tag = anchor[1];
    const raw = tag.match(/\bhref="([^"]+)"/)?.[1];
    if (!raw) continue;
    const rel = tag.match(/\brel="([^"]*)"/)?.[1] ?? '';
    if (/^(https?:|mailto:|tel:|data:)/.test(raw)) {
      const isMarketplace = /neighbor\.com|sparefoot\.com/.test(raw);
      const sponsored = /\bsponsored\b/.test(rel) && /\bnofollow\b/.test(rel);
      if (isMarketplace && !sponsored) fail(`${pageUrl} marketplace link is missing sponsored nofollow: ${raw}`);
      if (!isMarketplace && /\bsponsored\b/.test(rel)) {
        fail(`${pageUrl} marks a non-marketplace link sponsored: ${raw}`);
      }
      continue;
    }
    if (raw.startsWith('#')) {
      const id = raw.slice(1);
      if (id && !html.includes(`id="${id}"`)) fail(`${pageUrl} is missing #${id}.`);
      continue;
    }
    if (!raw.startsWith(`${base}/`) && raw !== base) {
      fail(`${pageUrl} has a local URL outside the project base: ${raw}`);
      continue;
    }
    const target = urlToFile(raw);
    if (!target || !fs.existsSync(target)) fail(`${pageUrl} links to missing ${raw}`);
    const hash = raw.split('#')[1];
    if (hash) {
      const targetHtml = fs.readFileSync(target, 'utf8');
      if (!targetHtml.includes(`id="${hash}"`)) fail(`${raw} target is missing id ${hash}.`);
    }
  }
}

const cityDir = path.join(root, 'src/data/cities');
for (const name of fs.readdirSync(cityDir).filter((file) => file.endsWith('.yaml'))) {
  const city = yaml.load(fs.readFileSync(path.join(cityDir, name), 'utf8'));
  const page = path.join(dist, 'cities', city.id, 'index.html');
  if (!fs.existsSync(page)) {
    fail(`Missing built city page for ${city.id}.`);
    continue;
  }
  const html = decode(fs.readFileSync(page, 'utf8'));
  if (!html.includes('SelfStorage')) fail(`${city.id} JSON-LD is missing SelfStorage.`);
  if (!html.includes('BreadcrumbList')) fail(`${city.id} JSON-LD is missing BreadcrumbList.`);
  if (!html.includes('Not listed')) fail(`${city.id} does not show Not listed.`);
  for (const listing of city.listings) {
    if (!html.includes(`id="${listing.slug}"`)) fail(`${city.id} is missing listing ${listing.slug}.`);
    if (!html.includes(listing.name)) fail(`${city.id} is missing the name ${listing.name}.`);
    for (const source of listing.sources) {
      if (!html.includes(source.url)) fail(`${listing.slug} is missing source ${source.url}.`);
    }
  }
}

const sitemapPath = path.join(dist, 'sitemap.xml');
const robotsPath = path.join(dist, 'robots.txt');
if (!fs.existsSync(sitemapPath)) fail('dist/sitemap.xml is missing.');
if (!fs.existsSync(robotsPath)) fail('dist/robots.txt is missing.');
if (fs.existsSync(sitemapPath) && fs.existsSync(robotsPath)) {
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const robots = fs.readFileSync(robotsPath, 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const indexable = htmlFiles.filter((file) => {
    const html = fs.readFileSync(file, 'utf8');
    const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? '';
    return !/noindex/i.test(robots);
  });
  if (locs.length !== indexable.length) {
    fail(`Sitemap has ${locs.length} URLs and the build has ${indexable.length} indexable HTML pages.`);
  }
  const noindexUrls = new Set(
    htmlFiles
      .filter((file) => /noindex/i.test(fs.readFileSync(file, 'utf8')))
      .map((file) => `${origin}${fileToUrl(file)}`),
  );
  for (const loc of locs) {
    if (noindexUrls.has(loc)) fail(`Sitemap includes a noindex page: ${loc}`);
  }
  for (const loc of locs) {
    if (!loc.startsWith(`${origin}${base}/`)) fail(`Sitemap URL is outside the project: ${loc}`);
    if (!loc.endsWith('/') && !loc.endsWith('.xml')) fail(`Sitemap URL should end with a slash: ${loc}`);
  }
  const sitemapUrl = `${origin}${base}/sitemap.xml`;
  if (!robots.includes(sitemapUrl)) fail('robots.txt does not point at the sitemap.');
  if (!locs.some((loc) => loc.endsWith('/cities/tampa-fl/'))) fail('Sitemap is missing Tampa.');
  if (!locs.some((loc) => loc.endsWith('/guide/'))) fail('Sitemap is missing the guide.');
}

function checkPlacePhotos() {
  const dataRoot = path.join(root, 'src/data');
  const photos = yaml.load(fs.readFileSync(path.join(dataRoot, 'photos.yaml'), 'utf8'));
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const used = new Map();
  const fallbacks = [];

  function claim(place, photoId) {
    if (photoId == null) {
      fallbacks.push(place);
      return;
    }
    const photo = byId.get(photoId);
    if (!photo) {
      fail(`${place} points at missing photo ${photoId}.`);
      return;
    }
    const file = photo.files?.['1280'];
    if (!file) {
      fail(`${place} photo ${photoId} has no 1280 image.`);
      return;
    }
    const prior = used.get(file);
    if (prior) fail(`${place} and ${prior} share ${file}.`);
    else used.set(file, place);
  }

  for (const file of fs.readdirSync(path.join(dataRoot, 'cities')).filter((name) => name.endsWith('.yaml'))) {
    const city = yaml.load(fs.readFileSync(path.join(dataRoot, 'cities', file), 'utf8'));
    if (!Object.prototype.hasOwnProperty.call(city, 'photo')) fail(`${city.id} has no image record.`);
    else claim(`${city.city}, ${city.state_code}`, city.photo);
  }
  const stateIds = new Set();
  for (const file of fs.readdirSync(path.join(dataRoot, 'cities')).filter((name) => name.endsWith('.yaml'))) {
    const city = yaml.load(fs.readFileSync(path.join(dataRoot, 'cities', file), 'utf8'));
    stateIds.add(city.state);
  }
  for (const state of stateIds) {
    const slug = state.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const photo = byId.get(slug);
    if (!photo || photo.role !== 'state') fail(`${state} has no state image record.`);
    else claim(state, slug);
  }
  const countyRoot = path.join(dataRoot, 'counties');
  const walkCounties = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkCounties(full);
      else if (entry.name.endsWith('.yaml')) {
        const county = yaml.load(fs.readFileSync(full, 'utf8'));
        if (!Object.prototype.hasOwnProperty.call(county, 'photo')) fail(`${county.name}, ${county.state_code} has no image record.`);
        else claim(`${county.name}, ${county.state_code}`, county.photo);
      }
    }
  };
  if (fs.existsSync(countyRoot)) walkCounties(countyRoot);
  if (fallbacks.length) {
    console.log(`Place photos use a name block for ${fallbacks.length} place${fallbacks.length === 1 ? '' : 's'}: ${fallbacks.join('; ')}`);
  } else {
    console.log('Every state, city, and county has its own image.');
  }
}

function checkMissingPricesCsv() {
  const dataRoot = path.join(root, 'src/data');
  const expected = [];
  const add = (state, stateCode, listings) => {
    for (const listing of listings) {
      if (lowestMonthlyAmounts([listing.price_notes]).length) continue;
      expected.push([state, stateCode, listing.city, listing.name].join('|'));
    }
  };
  for (const file of fs.readdirSync(path.join(dataRoot, 'cities')).filter((name) => name.endsWith('.yaml'))) {
    const city = yaml.load(fs.readFileSync(path.join(dataRoot, 'cities', file), 'utf8'));
    add(city.state, city.state_code, city.listings);
  }
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.yaml')) {
        const county = yaml.load(fs.readFileSync(full, 'utf8'));
        add(county.state, county.state_code, county.listings);
      }
    }
  };
  walk(path.join(dataRoot, 'counties'));
  const csvPath = path.join(root, 'data/missing-prices.csv');
  if (!fs.existsSync(csvPath)) {
    fail('data/missing-prices.csv is missing.');
    return;
  }
  const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n').slice(1);
  if (lines.length !== expected.length) {
    fail(`data/missing-prices.csv has ${lines.length} facilities and the directory has ${expected.length} without a monthly price.`);
  }
}

checkPlacePhotos();
checkMissingPricesCsv();

if (failures.length) {
  console.error(`Verification failed (${failures.length}):`);
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`Verified ${htmlFiles.length} HTML pages.`);
