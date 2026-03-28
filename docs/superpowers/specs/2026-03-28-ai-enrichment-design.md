# AI Enrichment for Gallery Categorisation

**Date:** 2026-03-28
**Status:** Approved

## Problem

The gallery currently clusters liked songs by track name, date added, and release year. Genre, country of origin, and BPM are not available from the Spotify liked-songs endpoint. The Spotify audio-features endpoint is blocked for new apps (deprecated Nov 2024). No single Spotify endpoint covers all three fields.

## Solution

Use Gemini 2.0 Flash (free tier) to enrich each track with genre, country, and BPM label in a single AI call. Results are stored in the existing `facetsByKey` structure under a new `ai` source key and cached in localStorage alongside Spotify data. Three new layout modes expose the enriched facets in the gallery.

## Data Shape

### New type in `src/types/types.ts`

```ts
export type GalleryItemAiFacets = {
  genre?: string;     // e.g. "Hip-Hop", "Electronic", "Pop"
  country?: string;   // ISO 3166-1 alpha-2, e.g. "US", "GB", "NG"
  bpm?: "slow" | "mid" | "fast" | "energetic";
};
```

BPM label thresholds (Gemini uses these definitions in the prompt):
- `slow` — under 80 BPM (ballads, ambient)
- `mid` — 80–110 BPM (R&B, moderate pop)
- `fast` — 110–135 BPM (uptempo pop, rock)
- `energetic` — 135+ BPM (EDM, fast hip-hop)

### Extended `GalleryItemFacets`

```ts
export type GalleryItemFacets = {
  spotify?: GalleryItemSpotifyFacets;
  ai?: GalleryItemAiFacets;          // new
  [source: string]: Record<string, unknown> | undefined;
};
```

### Extended `LayoutMode`

In `src/components/gallery-scene/helper/gallerySceneLayout.ts`:

```ts
export type LayoutMode =
  | "trackName" | "addedAt" | "releaseYear" | "initial"
  | "genre" | "country" | "bpm";   // new
```

## New File: `src/api/gemini.ts`

Exports a single function:

```ts
enrichTracksWithAi(
  tracks: Array<{ id: string; title: string; artist: string }>,
  apiKey: string
): Promise<Record<string, GalleryItemAiFacets>>
```

**Implementation details:**
- Batches input into groups of 50
- One `fetch` call per batch to the Gemini REST API (`generativelanguage.googleapis.com`)
- Prompt instructs the model to return a JSON array: `[{ id, genre, country, bpm }, ...]`
- Uses Gemini's `responseMimeType: "application/json"` for reliable structured output
- Model: `gemini-2.0-flash`
- Returns a flat `Record<trackId, GalleryItemAiFacets>` merged across all batches
- Tracks where the model returns no data are silently skipped (no crash)

API key comes from `import.meta.env.VITE_GEMINI_API_KEY`.

## Loading & Caching Flow

### Where enrichment runs

Inside `useSpotifyGallery` (`src/hooks/useSpotifyGallery.ts`), after the Spotify gallery payload is ready (either from cache or fresh fetch).

### Cache carry-over

When the Spotify cache expires and a fresh fetch runs, the hook reads any existing AI facets from the previous cache entry and merges them into the new `facetsByKey` before saving. This prevents re-enriching tracks that were already processed.

### Enrichment trigger

After the gallery state is set, the hook checks how many track facets are missing an `ai` field:
- **Zero missing** → skip entirely, no Gemini calls made
- **Some missing** → enrich in batches of 50 in the background

### State updates

A new `isAiEnriching: boolean` is added to `useSpotifyGallery`'s return value. It is `true` while any Gemini batch is in flight. `facetsByKey` state is updated after each batch completes (not just at the end), so layout modes unlock progressively for large libraries.

### Cache save

After all batches complete, `saveCachedSpotifyGallery` is called once with the fully enriched `facetsByKey`.

### Error handling

If a batch fails (network error, quota exceeded), the hook logs the error and continues with remaining batches. The gallery remains usable with partial AI data. No error is surfaced to the user — the new filter buttons simply stay in a loading state or remain disabled.

## Layout Modes

Three new cases added to `createSceneLayout` in `gallerySceneLayout.ts`:

| Mode | `groupKey` | Sort order | Label |
|---|---|---|---|
| `"genre"` | `ai.genre ?? "Unknown Genre"` | Alphabetical by genre | Genre string |
| `"country"` | `ai.country ?? "Unknown Country"` | Alphabetical by country code | Full country name via `Intl.DisplayNames` |
| `"bpm"` | `ai.bpm ?? "Unknown"` | `slow → mid → fast → energetic` | Label string |

All three reuse the existing `createClusterLayout` function — no new rendering code needed.

## UI Changes

### `GalleryFilters`

New prop: `isAiEnriching: boolean`

Three new buttons added — Genre, Country, Speed — after the existing Release Year button. While `isAiEnriching` is `true`, these three buttons render with a disabled state and a CSS loading indicator (e.g. pulsing opacity or spinner). Once enrichment finishes they behave identically to existing buttons.

### `App.tsx`

- Passes `isAiEnriching` from `useSpotifyGallery` down to `GalleryFilters`
- No other changes

## Environment

Add to `.env`:

```
VITE_GEMINI_API_KEY=<your_key>
```

## Out of Scope

- Re-enriching tracks after the initial enrichment (genres/countries don't change)
- Showing AI confidence or handling disagreements between model batches
- Supporting multiple genres per track (single genre label only)
- Any UI to manually override AI-assigned values
