import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';

const photoSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  role: z.enum(['hero', 'city', 'state', 'guide', 'generic']),
  alt: z.string().min(8),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  files: z.object({
    '640': z.string().min(4),
    '960': z.string().min(4),
    '1280': z.string().min(4),
  }),
  author: z.string().min(2),
  source_url: z.string().url(),
  license: z.string().min(2),
  license_url: z.string().url(),
  credit_required: z.boolean(),
});

export type Photo = z.infer<typeof photoSchema>;

function loadPhotos(): Photo[] {
  const file = path.join(process.cwd(), 'src/data/photos.yaml');
  const raw = yaml.load(fs.readFileSync(file, 'utf8'));
  const parsed = z.array(photoSchema).min(1).safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ');
    throw new Error(`src/data/photos.yaml: ${issues}`);
  }
  const ids = new Set<string>();
  for (const photo of parsed.data) {
    if (ids.has(photo.id)) throw new Error(`Duplicate photo id ${photo.id}`);
    ids.add(photo.id);
    for (const filePath of Object.values(photo.files)) {
      const disk = path.join(process.cwd(), 'public', filePath);
      if (!fs.existsSync(disk)) throw new Error(`Missing image file public/${filePath} for photo ${photo.id}`);
    }
  }
  return parsed.data;
}

const photos = loadPhotos();
const byId = new Map(photos.map((photo) => [photo.id, photo]));
const generics = photos.filter((photo) => photo.role === 'generic');

export function getPhotos(): Photo[] {
  return photos;
}

export function getPhoto(id: string): Photo {
  const photo = byId.get(id);
  if (!photo) throw new Error(`Unknown photo id "${id}". Add it to src/data/photos.yaml.`);
  return photo;
}

export function assertKnownPhoto(id: string): void {
  getPhoto(id);
}

export function assertCityPhoto(id: string): void {
  const photo = getPhoto(id);
  if (photo.role !== 'city') {
    throw new Error(`Photo "${id}" is role ${photo.role}. A city file needs a photo with role city.`);
  }
}

export function statePhoto(stateSlug: string): Photo {
  const photo = byId.get(stateSlug);
  if (!photo || photo.role !== 'state') {
    throw new Error(`No state photo for "${stateSlug}". Add a role: state entry with that id.`);
  }
  return photo;
}

export function heroPhoto(): Photo {
  const photo = photos.find((item) => item.role === 'hero');
  if (!photo) throw new Error('photos.yaml needs one role: hero image.');
  return photo;
}

export function guidePhoto(): Photo {
  const photo = photos.find((item) => item.role === 'guide');
  if (!photo) throw new Error('photos.yaml needs one role: guide image.');
  return photo;
}

export function genericPhoto(seed: string): Photo {
  if (!generics.length) throw new Error('photos.yaml needs at least one role: generic image.');
  const total = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return generics[total % generics.length]!;
}

export function listingPhoto(listing: { slug: string; photo: string | null }): Photo {
  if (listing.photo) return getPhoto(listing.photo);
  return genericPhoto(listing.slug);
}
