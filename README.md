# RV Storage Finder

Sourced directory of RV and boat storage for Tampa, Orlando, Phoenix, Houston, and Dallas-Fort Worth. Unknown amenities stay **Not listed**. Prices are copied from the facility page that states them.

The public site is [https://sunlightchurch.github.io/rv-storage-finder/](https://sunlightchurch.github.io/rv-storage-finder/). Astro is configured with `site` `https://sunlightchurch.github.io` and `base` `/rv-storage-finder`, so canonical URLs, the sitemap, and built assets include that project subpath.

## Develop

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4321/rv-storage-finder/`.

```bash
npm run build
npm run verify
```

## Add a city or a filter

Follow [PUBLISHING.md](PUBLISHING.md). A new city is one YAML file in `src/data/cities/`. State pages and filter pages are generated. Affiliate URLs and the empty partner ids live in `src/data/site.yaml`.

## Deploy

Pushing to `main` runs `.github/workflows/pages.yml`, which builds the site and deploys it with GitHub Actions. In the repository settings, **Pages → Build and deployment → Source** must be **GitHub Actions**. If that control still says "Deploy from a branch", switch it once. The workflow cannot change that setting by itself when the token is not allowed to.
