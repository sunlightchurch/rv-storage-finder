import { defineConfig } from 'astro/config';

// Project-site base. Pages, canonical URLs, and built asset paths all use it.
export default defineConfig({
  site: 'https://sunlightchurch.github.io',
  base: '/rv-storage-finder',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
