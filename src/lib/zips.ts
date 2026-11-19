import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export interface ZipCentroid {
  lat: number;
  lng: number;
}

let cache: Record<string, ZipCentroid> | null = null;

export function zipCentroids(): Record<string, ZipCentroid> {
  if (cache) return cache;
  const file = path.join(process.cwd(), 'src/data/zip-centroids.yaml');
  const raw = yaml.load(fs.readFileSync(file, 'utf8')) as { centroids?: Record<string, ZipCentroid> };
  cache = raw.centroids ?? {};
  return cache;
}

export function normalizeZip(value: string | null): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 5) return null;
  return digits.slice(0, 5);
}
