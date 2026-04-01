# AI Track Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich each liked song with genre, country, and BPM label via Gemini 2.0 Flash in the background, then expose three new gallery layout modes (Genre, Country, Speed) that cluster album art by those values.

**Architecture:** After the Spotify gallery loads, a background effect detects tracks missing AI facets and enriches them in batches of 50 via `src/api/gemini.ts`. Results merge into the existing `facetsByKey` structure under an `ai` key, update state progressively, and write back to the same localStorage cache entry. Three new `LayoutMode` values (`"genre"`, `"country"`, `"bpm"`) use the existing `createClusterLayout` machinery; the filter sidebar disables those buttons with a pulsing style while enrichment runs.

**Tech Stack:** Gemini 2.0 Flash REST API (no SDK), React state/effects, TypeScript, Vite env vars (`VITE_GEMINI_API_KEY`)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/types/types.ts` | Add `GalleryItemAiFacets`; fix index signature conflict; expose `ai` on `GalleryItemFacets` |
| Modify | `src/components/gallery-scene/helper/gallerySceneLayout.ts` | Extend `LayoutMode`; add genre / country / bpm cluster cases |
| Create | `src/api/gemini.ts` | Gemini REST client — single function `enrichTracksWithAi` |
| Modify | `src/hooks/useSpotifyGallery.ts` | Background enrichment effect; cache carry-over; expose `isAiEnriching` |
| Modify | `src/components/gallery-scene/filters/GalleryFilters.tsx` | Three new buttons with `isAiEnriching` disabled/loading state |
| Modify | `src/components/gallery-scene/filters/gallery_filters.css` | `is-loading` pulse animation |
| Modify | `src/App.tsx` | Pass `isAiEnriching` to `GalleryFilters` |
| Modify | `.env` | Add `VITE_GEMINI_API_KEY` |

---

### Task 1: Extend types and LayoutMode

**Files:**
- Modify: `src/types/types.ts`
- Modify: `src/components/gallery-scene/helper/gallerySceneLayout.ts`

The current `GalleryItemFacets` index signature is `[source: string]: Record<string, unknown> | undefined`. Adding a named `ai` property with a typed value conflicts with that. Fix: widen index signature to `unknown`.

- [ ] **Step 1: Update `src/types/types.ts`**

Replace the file content with:

```ts
export type GalleryItem = {
  id: string;
  imageUrl: string;
  title?: string;
  category?: string;
  spotifyTrackUri?: string;
};

export type GalleryItemSpotifyFacets = {
  addedAt?: string;
  releaseDate?: string;
};

export type GalleryItemAiFacets = {
  genre?: string;
  country?: string;
  bpm?: "slow" | "mid" | "fast" | "energetic";
};

export type GalleryItemFacets = {
  spotify?: GalleryItemSpotifyFacets;
  ai?: GalleryItemAiFacets;
  [source: string]: unknown;
};

export type GalleryItemFacetsByKey = Record<string, GalleryItemFacets>;

export type GallerySceneProps = {
  items: GalleryItem[];
  activeItemId?: string | null;
  onItemClick?: (item: GalleryItem) => void;
};
```

- [ ] **Step 2: Extend `LayoutMode` in `src/components/gallery-scene/helper/gallerySceneLayout.ts`**

Find line 28:
```ts
export type LayoutMode = "trackName" | "addedAt" | "releaseYear" | "initial";
```

Replace with:
```ts
export type LayoutMode = "trackName" | "addedAt" | "releaseYear" | "initial" | "genre" | "country" | "bpm";
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build`

Expected: build succeeds with no type errors. The widened index signature (`unknown`) is backward-compatible — all existing `?.spotify?.addedAt` accesses still type-check because named properties take precedence over index signatures.

- [ ] **Step 4: Commit**

```bash
git add src/types/types.ts src/components/gallery-scene/helper/gallerySceneLayout.ts
git commit -m "feat: add GalleryItemAiFacets type and extend LayoutMode"
```

---

### Task 2: Create Gemini API client

**Files:**
- Create: `src/api/gemini.ts`

This function handles one batch (≤ 50 tracks). Batching across the full library is the caller's responsibility. Uses the Gemini REST API directly — no SDK dependency.

- [ ] **Step 1: Create `src/api/gemini.ts`**

```ts
import type { GalleryItemAiFacets } from "@/types/types";

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

type TrackInput = {
  id: string;
  title: string;
  artist: string;
};

type GeminiEnrichedItem = {
  id: string;
  genre?: string;
  country?: string;
  bpm?: "slow" | "mid" | "fast" | "energetic";
};

type GeminiApiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

/**
 * Enriches up to 50 tracks with genre, country, and BPM label via Gemini 2.0 Flash.
 * Returns a map from track id to AI facets. Missing or unparseable entries are silently skipped.
 */
export async function enrichTracksWithAi(
  tracks: TrackInput[],
  apiKey: string,
): Promise<Record<string, GalleryItemAiFacets>> {
  const prompt = `You are a music metadata expert. For each track below, return a JSON array — one object per track.

Each object must have exactly these fields:
- "id": copy from input unchanged
- "genre": single genre string, e.g. "Pop", "Hip-Hop", "Electronic", "Rock", "R&B", "Jazz", "Classical", "Country", "Reggae", "Latin", "Metal", "Soul", "Blues", "Funk"
- "country": two-letter ISO 3166-1 alpha-2 code of the primary artist's origin country, e.g. "US", "GB", "NG", "KR", "BR", "SE"
- "bpm": one of:
  "slow"      — under 80 BPM (ballads, ambient, slow R&B)
  "mid"       — 80–110 BPM (moderate pop, classic R&B, soul)
  "fast"      — 110–135 BPM (uptempo pop, rock, standard hip-hop)
  "energetic" — 135+ BPM (EDM, drum and bass, fast hip-hop)

Always return a value for every field. Make your best guess if uncertain.
Return ONLY the JSON array — no explanation, no markdown.

Tracks:
${JSON.stringify(tracks)}`;

  const response = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as GeminiApiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

  let parsed: GeminiEnrichedItem[];
  try {
    parsed = JSON.parse(text) as GeminiEnrichedItem[];
  } catch {
    return {};
  }

  if (!Array.isArray(parsed)) return {};

  return Object.fromEntries(
    parsed
      .filter((item): item is GeminiEnrichedItem & { id: string } =>
        typeof item === "object" && item !== null && typeof item.id === "string",
      )
      .map((item) => [
        item.id,
        {
          genre: item.genre,
          country: item.country,
          bpm: item.bpm,
        } satisfies GalleryItemAiFacets,
      ]),
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`

Expected: build succeeds. The `satisfies GalleryItemAiFacets` on the last line will catch any type drift if `GalleryItemAiFacets` changes.

- [ ] **Step 3: Commit**

```bash
git add src/api/gemini.ts
git commit -m "feat: add Gemini 2.0 Flash API client for track enrichment"
```

---

### Task 3: Add genre, country, and bpm layout modes

**Files:**
- Modify: `src/components/gallery-scene/helper/gallerySceneLayout.ts`

All three modes reuse the existing `createClusterLayout` function. Only groupKey, sortItems, and labelTitle differ.

- [ ] **Step 1: Add AI facet helpers after the existing `getSpotifyReleaseDate` function (around line 127)**

Add these three functions after `getSpotifyReleaseDate`:

```ts
function getAiGenre(item: GalleryItemData, facetsByKey: GalleryItemFacetsByKey): string | null {
  return facetsByKey[getFacetKey(item)]?.ai?.genre ?? null;
}

function getAiCountry(item: GalleryItemData, facetsByKey: GalleryItemFacetsByKey): string | null {
  return facetsByKey[getFacetKey(item)]?.ai?.country ?? null;
}

function getAiBpm(item: GalleryItemData, facetsByKey: GalleryItemFacetsByKey): string | null {
  return facetsByKey[getFacetKey(item)]?.ai?.bpm ?? null;
}
```

`ai` is a named typed property on `GalleryItemFacets` (`ai?: GalleryItemAiFacets`), so TypeScript resolves it as `GalleryItemAiFacets | undefined` — no casting needed.

- [ ] **Step 2: Add BPM sort order constant before `createSceneLayout` (around line 238)**

Add this constant just above the `createSceneLayout` function:

```ts
const BPM_ORDER: Record<string, number> = { slow: 0, mid: 1, fast: 2, energetic: 3 };
```

- [ ] **Step 3: Add genre, country, and bpm cases inside `createSceneLayout`**

Inside `createSceneLayout`, after the existing `if (layoutMode === "releaseYear")` block and before the final `return` statement, add:

```ts
  if (layoutMode === "genre") {
    return createClusterLayout({
      items,
      facetsByKey,
      initialLayout,
      viewportSize,
      sortItems: (sceneItems, facets) =>
        [...sceneItems].sort((a, b) => {
          const ga = getAiGenre(a, facets) ?? "";
          const gb = getAiGenre(b, facets) ?? "";
          return ga.localeCompare(gb) || normalizedTrackName(a.title).localeCompare(normalizedTrackName(b.title));
        }),
      groupKey: (item, facets) => getAiGenre(item, facets) ?? "Unknown Genre",
      labelTitle: (group) => group,
    });
  }

  if (layoutMode === "country") {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    return createClusterLayout({
      items,
      facetsByKey,
      initialLayout,
      viewportSize,
      sortItems: (sceneItems, facets) =>
        [...sceneItems].sort((a, b) => {
          const ca = getAiCountry(a, facets) ?? "";
          const cb = getAiCountry(b, facets) ?? "";
          return ca.localeCompare(cb) || normalizedTrackName(a.title).localeCompare(normalizedTrackName(b.title));
        }),
      groupKey: (item, facets) => getAiCountry(item, facets) ?? "Unknown Country",
      labelTitle: (group) => {
        if (group === "Unknown Country") return group;
        try {
          return displayNames.of(group) ?? group;
        } catch {
          return group;
        }
      },
    });
  }

  if (layoutMode === "bpm") {
    return createClusterLayout({
      items,
      facetsByKey,
      initialLayout,
      viewportSize,
      sortItems: (sceneItems, facets) =>
        [...sceneItems].sort((a, b) => {
          const orderA = BPM_ORDER[getAiBpm(a, facets) ?? ""] ?? 99;
          const orderB = BPM_ORDER[getAiBpm(b, facets) ?? ""] ?? 99;
          if (orderA !== orderB) return orderA - orderB;
          return normalizedTrackName(a.title).localeCompare(normalizedTrackName(b.title));
        }),
      groupKey: (item, facets) => getAiBpm(item, facets) ?? "Unknown",
      labelTitle: (group) => {
        const labels: Record<string, string> = {
          slow: "Slow",
          mid: "Mid",
          fast: "Fast",
          energetic: "Energetic",
        };
        return labels[group] ?? group;
      },
    });
  }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run build`

Expected: build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/gallery-scene/helper/gallerySceneLayout.ts
git commit -m "feat: add genre, country, and bpm cluster layout modes"
```

---

### Task 4: Background AI enrichment in useSpotifyGallery

**Files:**
- Modify: `src/hooks/useSpotifyGallery.ts`

Two changes:
1. When the Spotify cache refreshes, carry over existing AI facets so already-enriched tracks aren't re-sent to Gemini.
2. A second `useEffect` detects tracks missing `ai` facets and enriches them in the background.

- [ ] **Step 1: Add import for `enrichTracksWithAi` at the top of `src/hooks/useSpotifyGallery.ts`**

After the existing imports, add:

```ts
import { enrichTracksWithAi } from "@/api/gemini";
```

- [ ] **Step 2: Add `isAiEnriching` to the state type and initial state**

In `SpotifyGalleryState` type, add:
```ts
  isAiEnriching: boolean;
```

Add a new `useState` hook inside `useSpotifyGallery`:
```ts
  const [isAiEnriching, setIsAiEnriching] = useState(false);
```

- [ ] **Step 3: Carry over AI facets when Spotify cache refreshes**

In `loadGallery`, find the block that saves to cache after a fresh fetch:
```ts
        setItems(nextGallery.items);
        setFacetsByKey(nextGallery.facetsByKey);
        setLikedSongsCount(nextGallery.items.length);
        setTotalLikedSongs((currentTotal) => currentTotal ?? nextGallery.items.length);
        saveCachedSpotifyGallery(nextGallery.items, nextGallery.facetsByKey);
```

Replace with:
```ts
        // Carry over AI facets from the previous cache so already-enriched
        // tracks are not re-sent to Gemini after a Spotify cache refresh.
        const mergedFacets: GalleryItemFacetsByKey = { ...nextGallery.facetsByKey };
        if (cachedGallery) {
          for (const key of Object.keys(mergedFacets)) {
            const previousAi = cachedGallery.facetsByKey[key]?.ai;
            if (previousAi) {
              mergedFacets[key] = { ...mergedFacets[key], ai: previousAi };
            }
          }
        }

        setItems(nextGallery.items);
        setFacetsByKey(mergedFacets);
        setLikedSongsCount(nextGallery.items.length);
        setTotalLikedSongs((currentTotal) => currentTotal ?? nextGallery.items.length);
        saveCachedSpotifyGallery(nextGallery.items, mergedFacets);
```

- [ ] **Step 4: Add background enrichment effect**

Add a second `useEffect` inside `useSpotifyGallery`, after the existing one:

```ts
  useEffect(() => {
    if (!enabled || isLoading || items.length === 0) return;

    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    if (!geminiApiKey) return;

    const missingTracks = items.filter((item) => {
      const key = item.spotifyTrackUri ?? item.id;
      return !facetsByKey[key]?.ai;
    });

    if (missingTracks.length === 0) return;

    let cancelled = false;
    setIsAiEnriching(true);

    const BATCH_SIZE = 50;

    const runEnrichment = async () => {
      const trackInputs = missingTracks.map((item) => ({
        id: item.spotifyTrackUri ?? item.id,
        title: item.title ?? "",
        artist: item.category ?? "",
      }));

      // finalFacets accumulates all batch results for the final cache write.
      const finalFacets: GalleryItemFacetsByKey = { ...facetsByKey };

      try {
        for (let i = 0; i < trackInputs.length; i += BATCH_SIZE) {
          if (cancelled) return;

          const batch = trackInputs.slice(i, i + BATCH_SIZE);

          try {
            const results = await enrichTracksWithAi(batch, geminiApiKey);
            if (cancelled) return;

            for (const [key, aiFacets] of Object.entries(results)) {
              finalFacets[key] = { ...finalFacets[key], ai: aiFacets };
            }

            setFacetsByKey((current) => {
              const updated = { ...current };
              for (const [key, aiFacets] of Object.entries(results)) {
                updated[key] = { ...updated[key], ai: aiFacets };
              }
              return updated;
            });
          } catch (err) {
            console.error("AI enrichment batch failed:", err);
            // Continue with remaining batches.
          }
        }

        if (!cancelled) {
          saveCachedSpotifyGallery(items, finalFacets);
        }
      } finally {
        if (!cancelled) {
          setIsAiEnriching(false);
        }
      }
    };

    void runEnrichment();

    return () => {
      cancelled = true;
    };
    // facetsByKey is intentionally omitted from deps — we only want to trigger
    // enrichment when the item list changes, not after each batch update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, isLoading, enabled]);
```

- [ ] **Step 5: Expose `isAiEnriching` in the return value**

In the `return` statement at the bottom of `useSpotifyGallery`, add `isAiEnriching`:

```ts
  return {
    items,
    facetsByKey,
    likedSongsCount,
    totalLikedSongs,
    isLoading,
    isAiEnriching,
    errorMessage,
  };
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npm run build`

Expected: build succeeds. If you see an error about `import.meta.env.VITE_GEMINI_API_KEY`, it is safe — Vite injects all `VITE_*` env vars at build time and TypeScript's `ImportMeta` accepts `unknown` for env keys.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useSpotifyGallery.ts
git commit -m "feat: background AI enrichment with cache carry-over in useSpotifyGallery"
```

---

### Task 5: Filter sidebar — three new buttons with loading state

**Files:**
- Modify: `src/components/gallery-scene/filters/GalleryFilters.tsx`
- Modify: `src/components/gallery-scene/filters/gallery_filters.css`

- [ ] **Step 1: Add `is-loading` style to `gallery_filters.css`**

Append to the end of the file:

```css
.filter-sidebar__btn.is-loading {
  opacity: 0.45;
  cursor: default;
  pointer-events: none;
  animation: filter-btn-pulse 1.4s ease-in-out infinite;
}

@keyframes filter-btn-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.25; }
}
```

- [ ] **Step 2: Update `GalleryFilters.tsx`**

Replace the entire file with:

```tsx
import type { LayoutMode } from "../GalleryScene";
import "./gallery_filters.css";

export type GalleryFiltersProps = {
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
  isAiEnriching: boolean;
};

export function GalleryFilters({
  layoutMode,
  onLayoutModeChange,
  isAiEnriching,
}: GalleryFiltersProps) {
  return (
    <aside className="filter-sidebar">
      <span className="filter-sidebar__label">View</span>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "trackName" ? "is-active" : ""}`}
        onClick={() => onLayoutModeChange("trackName")}
      >
        Track Name
      </button>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "addedAt" ? "is-active" : ""}`}
        onClick={() => onLayoutModeChange("addedAt")}
      >
        Date Added
      </button>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "releaseYear" ? "is-active" : ""}`}
        onClick={() => onLayoutModeChange("releaseYear")}
      >
        Release Year
      </button>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "genre" ? "is-active" : ""} ${isAiEnriching ? "is-loading" : ""}`}
        disabled={isAiEnriching}
        onClick={() => onLayoutModeChange("genre")}
      >
        Genre
      </button>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "country" ? "is-active" : ""} ${isAiEnriching ? "is-loading" : ""}`}
        disabled={isAiEnriching}
        onClick={() => onLayoutModeChange("country")}
      >
        Country
      </button>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "bpm" ? "is-active" : ""} ${isAiEnriching ? "is-loading" : ""}`}
        disabled={isAiEnriching}
        onClick={() => onLayoutModeChange("bpm")}
      >
        Speed
      </button>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "initial" ? "is-active" : ""}`}
        onClick={() => onLayoutModeChange("initial")}
      >
        Initial
      </button>
    </aside>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build`

Expected: build will fail because `App.tsx` passes `GalleryFilters` without the new `isAiEnriching` prop — that's expected and will be fixed in the next task.

- [ ] **Step 4: Commit**

```bash
git add src/components/gallery-scene/filters/GalleryFilters.tsx src/components/gallery-scene/filters/gallery_filters.css
git commit -m "feat: add Genre, Country, Speed filter buttons with loading state"
```

---

### Task 6: Wire isAiEnriching in App.tsx and add env var

**Files:**
- Modify: `src/App.tsx`
- Modify: `.env`

- [ ] **Step 1: Destructure `isAiEnriching` from `useSpotifyGallery` in `App.tsx`**

Find the `useSpotifyGallery` destructure (around line 25):
```ts
  const {
    items: galleryItems,
    facetsByKey,
    likedSongsCount,
    totalLikedSongs,
    isLoading: isLibraryLoading,
    errorMessage: libraryError,
  } = useSpotifyGallery({
```

Replace with:
```ts
  const {
    items: galleryItems,
    facetsByKey,
    likedSongsCount,
    totalLikedSongs,
    isLoading: isLibraryLoading,
    isAiEnriching,
    errorMessage: libraryError,
  } = useSpotifyGallery({
```

- [ ] **Step 2: Pass `isAiEnriching` to `GalleryFilters` in `App.tsx`**

Find the `<GalleryFilters>` usage (around line 140):
```tsx
      <GalleryFilters
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
      />
```

Replace with:
```tsx
      <GalleryFilters
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
        isAiEnriching={isAiEnriching}
      />
```

- [ ] **Step 3: Add Gemini API key to `.env`**

Open `.env` and add:
```
VITE_GEMINI_API_KEY=<paste your key from aistudio.google.com>
```

- [ ] **Step 4: Verify full build passes**

Run: `npm run build`

Expected: build succeeds with no type errors.

Run: `npm run lint`

Expected: no lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire isAiEnriching from useSpotifyGallery into GalleryFilters"
```

Note: do not commit `.env` — it contains your API key.

---

### Task 7: Manual verification

**No files changed — browser testing only.**

- [ ] **Step 1: Clear localStorage to force a fresh enrichment run**

Open browser DevTools → Application → Local Storage → delete `spotify_gallery_items`.

- [ ] **Step 2: Start dev server**

Run: `npm run dev`

Open `http://127.0.0.1:5173` and sign in.

- [ ] **Step 3: Verify loading phase**

While liked songs load, the gallery loading screen should appear as before. After it resolves, the gallery scene should render immediately.

- [ ] **Step 4: Verify Genre / Country / Speed buttons pulse while enriching**

The three new buttons should appear in the sidebar with a pulsing animation. The existing buttons (Track Name, Date Added, Release Year, Initial) should be fully interactive.

- [ ] **Step 5: Verify buttons unlock after enrichment**

When enrichment completes (check the browser console for any batch errors), the three buttons should stop pulsing and become clickable.

- [ ] **Step 6: Verify each new layout mode clusters correctly**

- Click **Genre** → album art groups into clusters labelled by genre (e.g. "Pop", "Hip-Hop")
- Click **Country** → clusters labelled by full country name (e.g. "United States", "United Kingdom")
- Click **Speed** → clusters labelled Slow / Mid / Fast / Energetic, in that order

- [ ] **Step 7: Verify cache persists AI facets**

Reload the page without clearing localStorage. The Genre / Country / Speed buttons should be immediately active (no pulsing) because AI facets are already in the cache.

- [ ] **Step 8: Final commit**

```bash
git add .env.example  # only if you maintain a .env.example — add VITE_GEMINI_API_KEY= (no value)
git commit -m "feat: AI track enrichment with genre, country, and BPM layout modes"
```
