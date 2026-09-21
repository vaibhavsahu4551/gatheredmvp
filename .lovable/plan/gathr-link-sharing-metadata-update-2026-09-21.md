# Gathr link-sharing metadata update

## Goal
Make shared Gathr links show consistent Gathr branding, with event links using event-specific titles, descriptions, and cover images where available.

## Changes
- Replace the stale default preview image with a new 1200×630 social image derived from the existing official Gathr artwork.
- Keep the homepage title and description aligned across Open Graph and Twitter/X metadata.
- Add complete event-page sharing metadata, including Gathr site name, event title and description, canonical URL, and event cover image when it can be served publicly.
- Refresh favicon and app-icon sizes from the existing official Gathr logo.
- Remove stale/default Lovable preview references from active metadata.
- Validate rendered page metadata, image dimensions, favicon links, and the app build.

## Technical details
- Use TanStack route `head()` metadata; no new router or UI changes.
- Use absolute `https://gathrmeet.in` URLs for crawler-facing images and pages.
- Keep one canonical per public page and preserve existing structured data.
