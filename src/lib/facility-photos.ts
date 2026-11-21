import fs from 'node:fs';
import path from 'node:path';

export interface FacilityPhoto {
  creator: string;
  captured_at: string;
  source_url: string;
  mapillary_image_id: string;
  license: string;
  width: number;
  height: number;
  files: {
    '640': string;
    '1024': string;
  };
}

let cache: Record<string, FacilityPhoto> | null = null;

function load(): Record<string, FacilityPhoto> {
  if (!cache) {
    const file = path.join(process.cwd(), 'src/data/facility-photos.json');
    cache = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, FacilityPhoto>;
  }
  return cache;
}

export function facilityPhoto(slug: string): FacilityPhoto | null {
  return load()[slug] ?? null;
}

export function facilityPhotos(): Record<string, FacilityPhoto> {
  return load();
}
