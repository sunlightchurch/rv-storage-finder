import { defineConfig } from 'astro/config';

// Custom domain at the site root. Canonical URLs, the sitemap, and assets use it.
export default defineConfig({
  site: 'https://rvstorageprices.com',
  base: '/',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
