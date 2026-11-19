# RV Storage Prices

Sourced directory of RV and boat storage. Unknown amenities stay **Not listed**. Prices are copied from the facility page that states them.

The public site is [https://rvstorageprices.com/](https://rvstorageprices.com/). Astro is configured with `site` `https://rvstorageprices.com` and `base` `/`, so canonical URLs, the sitemap, and built assets are at the domain root.

## Develop

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4321/`.

```bash
npm run build
npm run verify
```

## Add a city or a filter

Follow [PUBLISHING.md](PUBLISHING.md). A new city is one YAML file in `src/data/cities/`. State pages and filter pages are generated. Affiliate URLs and the empty partner ids live in `src/data/site.yaml`.

## Deploy

Pushing to `main` runs `.github/workflows/pages.yml`, which builds the site and deploys it with GitHub Actions. In the repository settings, **Pages → Build and deployment → Source** must be **GitHub Actions**. If that control still says "Deploy from a branch", switch it once. The workflow cannot change that setting by itself when the token is not allowed to.
