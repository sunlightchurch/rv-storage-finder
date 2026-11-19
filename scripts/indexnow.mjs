import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const keyName = fs.readdirSync(path.join(root, 'public')).find((name) => /^[0-9a-f]{32}\.txt$/.test(name));
if (!keyName) {
  console.error('IndexNow key file is missing from public/.');
  process.exit(1);
}
const key = keyName.slice(0, -4);
const keyText = fs.readFileSync(path.join(root, 'public', keyName), 'utf8').trim();
if (keyText !== key) {
  console.error('IndexNow key file does not match its filename.');
  process.exit(1);
}

const sitemapPath = path.join(root, 'dist', 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) {
  console.error('dist/sitemap.xml is missing.');
  process.exit(1);
}
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (!urlList.length) {
  console.error('Sitemap has no URLs.');
  process.exit(1);
}

const body = {
  host: 'rvstorageprices.com',
  key,
  keyLocation: `https://rvstorageprices.com/${key}.txt`,
  urlList,
};

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});
const text = await response.text();
console.log(`IndexNow ${response.status} for ${urlList.length} URLs`);
if (text) console.log(text.slice(0, 500));
if (!response.ok) process.exit(1);
