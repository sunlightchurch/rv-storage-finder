# Publishing a city or a filter

This site is a static Astro build. Listings live in YAML. City pages, state pages, and filter pages are generated from that data. Do not add a new `.astro` file for a city.

The build fails if a file breaks the schema, a listing has no source URL, a slug is duplicated, or an amenity is not `true`, `false`, or `null`.

## Add a city

1. Copy `src/data/cities/tampa-fl.yaml` to `src/data/cities/{city-slug}.yaml`.
2. The filename and the `id` must match. Use lowercase letters, numbers, and hyphens, and end with the state code: `austin-tx`.
3. Set `city`, `state`, `state_code`, `metro`, and a `summary` that only names places you are actually listing.
4. Set `sparefoot_slug` to SpareFoot's public city token, such as `Austin-TX`. The live page is `https://www.sparefoot.com/Austin-TX-self-storage/rv-storage.html`. Open it before you commit the slug.
5. Set `neighbor_path` to Neighbor's public path, such as `texas/austin`. The live page is `https://www.neighbor.com/rv-storage-near-me/texas/austin`. Open it before you commit the path.
6. Leave `sparefoot_note` as `null` unless those links need a caveat, as Dallas-Fort Worth does.
7. Set `photo` to an id from `src/data/photos.yaml` whose `role` is `city`. The build fails if the id is missing or is not a city photo. To add a photograph, put optimized WebP files in `public/photos/` (640, 960, and 1280 pixels wide, 3:2) and add a catalog row with author, source URL, license, and `credit_required`. Use Wikimedia Commons files that are CC0, CC BY, or CC BY-SA, or another license that allows reuse. Do not hotlink, and do not copy a facility, Google, or Yelp photo unless that source explicitly allows reuse.
8. Add listings. A new state appears on its own as soon as one city file uses that `state` name. A new state also needs a `role: state` photo whose id matches the state slug (`florida`, `georgia`).
9. Run `npm run build` and `npm run verify`.

Filter pages are created automatically for every filter in `src/data/filters.yaml` that matches at least one listing. A city with no covered RV listing does not get a covered-RV page.

## Listing fields

Every listing needs every key below. Use `null` when the source does not say. Use `[]` for storage types when the page never says covered, enclosed, or open.

| Field | Rule |
| --- | --- |
| `slug` | Unique across the whole site. Lowercase letters, numbers, hyphens. |
| `name`, `street`, `city`, `state_code` | Copied from the source. Keep the facility's own city, even when the directory city is the metro. |
| `postal_code` | Copied from the source, or `null`. Do not guess a ZIP. |
| `lat`, `lng` | Both numbers, or both `null`. Use coordinates only when the source page or a map URL on that page prints them. |
| `phone`, `website` | Copied from the source, or `null`. |
| `vehicles` | One or both of `rv` and `boat`. Include a type only when the page says that vehicle is stored. |
| `storage_types` | Any of `covered`, `enclosed`, `open`. Indoor, warehouse, garage, or enclosed building means `enclosed`. A roof, canopy, or carport means `covered`. Outdoor, uncovered, or open lot means `open`. |
| `max_length_ft`, `clearance_ft` | A number the page states, or `null`. If several lengths are listed, use the largest and describe the tiers in `notes` or `price_notes`. |
| `power_hookups`, `dump_station`, `wash_station`, `gated`, `cameras`, `access_24h` | `true` only when the page states it. `false` only when the page states the facility does not have it, including a printed gate window with no 24-hour option. `null` when the page is silent or two statements conflict. |
| `price_notes` | The published figure and what it buys, or `null`. Keep promo and in-store rates when both are printed. If the page does not say the billing period, do not add "per month". |
| `waitlist` | A short note if the page describes a waitlist, or `null`. |
| `notes` | One or two factual sentences. Paraphrase. Do not paste a marketing paragraph. |
| `sources` | At least one `url` and `title`. Prefer the facility's own page. |
| `photo` | A catalog id, or `null`. `null` shows a shared licensed photo of a typical RV, trailer, or boat. The card says that picture is not this facility. Set an id only when you have a photo that license allows you to store, and record it in `src/data/photos.yaml` first. |
| `last_verified` | The day you opened the source, `YYYY-MM-DD`, in quotes. |

Quote YAML values that contain `&`, `#`, or `:`.

## How to verify a listing

1. Open the facility's own website. If it will not load, use a SpareFoot, Neighbor, or other public listing you can actually open, and say which page you used.
2. Copy the address and phone from that page.
3. For each `true` or `false`, you should be able to point at a sentence on the page. If you cannot, leave the field `null`.
4. Do not copy amenities from a chain-wide sentence such as "most locations" unless this location's page states them.
5. Do not invent a facility to reach a count. Eight to fifteen listings is the launch target. Fewer is correct when fewer pages can be opened.
6. Set `last_verified` to the day you opened the page.
7. Run `npm run build`. Zod errors name the file and the field.

## Add a filter

Edit `src/data/filters.yaml`. Add one object. Do not create a page file.

- `id` and `slug_prefix` are lowercase hyphenated strings. The page URL is `/storage/{slug_prefix}-{city-id}/`.
- `vehicles` must intersect the listing.
- `storage_types` must all be present on the listing. An empty list matches any cover type.
- `require_power`, `require_dump`, `require_wash`, and `require_price` match only an explicit yes or a non-null price.
- `title`, `description`, `h1`, and `intro` may use `{city}`, `{state}`, `{state_code}`, `{metro}`, and `{count}`.

A page is emitted only when a city has at least one match. `npm run build` prints a Zod error if a placeholder is unknown.

## Deploy

`npm run build` writes `dist/`. `npm run verify` checks titles, descriptions, canonical URLs, the `/rv-storage-finder/` base path, JSON-LD, sitemap, robots, and that every source URL appears on its city page.

Merging to `main` runs `.github/workflows/pages.yml`, which builds and deploys to GitHub Pages. The repository Pages setting has to use **GitHub Actions** as the source. The site URL is `https://sunlightchurch.github.io/rv-storage-finder/`.

Marketplace links are configured in `src/data/site.yaml`. Leave `affiliate_id` and `affiliate_param` empty until the partner account is approved. Set both, or the build fails. While they are empty, the public Neighbor and SpareFoot URLs are used and still carry `rel="sponsored nofollow"`.
