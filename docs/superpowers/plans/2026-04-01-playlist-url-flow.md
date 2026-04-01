# Playlist URL Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Spotify OAuth login screen with a playlist URL input that loads any public Spotify playlist into the gallery without user authentication.

**Architecture:** The existing PKCE auth flow is preserved in `App.auth.tsx` but not used. A new `src/lib/spotifyAnon.ts` fetches a short-lived anonymous Bearer token from Spotify's internal web player endpoint. New API helpers and a `usePlaylistGallery` hook load and cache playlist tracks using that token. A new `PlaylistUrlScreen` component handles URL entry, and a new `App.tsx` orchestrates the whole flow with no auth state.

**Tech Stack:** React, TypeScript, existing GSAP/gallery infrastructure, Spotify Web API v1, `open.spotify.com/get_access_token` (undocumented anonymous token endpoint)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Rename | `src/App.tsx` → `src/App.auth.tsx` | Preserved old auth flow, untouched |
| Create | `src/App.tsx` | New playlist-URL-only orchestrator |
| Create | `src/lib/spotifyAnon.ts` | Fetch + cache anonymous Spotify Bearer token |
| Modify | `src/api/spotify.ts` | Add playlist types + `getPlaylistTracks` + `getPlaylistMetadata` |
| Modify | `src/helper/spotifyGallery.ts` | Add `loadPlaylistGalleryItems` |
| Create | `src/hooks/usePlaylistGallery.ts` | Hook: load, cache, expose gallery state for a playlist |
| Create | `src/components/playlist-url/PlaylistUrlScreen.tsx` | Entry screen: URL input, validation, loading, error states |

---

### Task 1: Rename App.tsx → App.auth.tsx

**Files:**
- Rename: `src/App.tsx` → `src/App.auth.tsx`

- [ ] **Step 1: Rename the file via git**

```bash
git mv src/App.tsx src/App.auth.tsx
```

- [ ] **Step 2: Verify the rename**

```bash
git status
```

Expected output includes:
```
renamed: src/App.tsx -> src/App.auth.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: rename App.tsx to App.auth.tsx (preserving old auth flow)"
```

---

### Task 2: Anonymous token module

**Files:**
- Create: `src/lib/spotifyAnon.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/spotifyAnon.ts

type AnonTokenResponse = {
  accessToken: string;
  accessTokenExpirationTimestampMs: number;
  isAnonymous: boolean;
};

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getAnonSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const response = await fetch("https://open.spotify.com/get_access_token", {
    headers: { "App-Platform": "WebPlayer" },
  });

  if (!response.ok) {
    throw new Error("Could not reach Spotify. Try again.");
  }

  const data = (await response.json()) as AnonTokenResponse;

  if (!data.accessToken) {
    throw new Error("Could not reach Spotify. Try again.");
  }

  cachedToken = data.accessToken;
  tokenExpiresAt = data.accessTokenExpirationTimestampMs;
  return cachedToken;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no errors related to `spotifyAnon.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/spotifyAnon.ts
git commit -m "feat: add anonymous Spotify token fetcher"
```

---

### Task 3: Playlist API helpers

**Files:**
- Modify: `src/api/spotify.ts`

- [ ] **Step 1: Add playlist types to `src/api/spotify.ts`**

Add after the existing `SpotifySavedTracksResponse` type (after line 56):

```typescript
export type SpotifyPlaylistTrackItem = {
  added_at: string;
  track: SpotifySavedTrackItem["track"] | null;
};

export type SpotifyPlaylistTracksResponse = {
  href: string;
  limit: number;
  next: string | null;
  offset: number;
  total: number;
  items: SpotifyPlaylistTrackItem[];
};

export type SpotifyPlaylistMetadata = {
  id: string;
  name: string;
  images: Array<{ url: string; width: number | null; height: number | null }>;
  tracks: { total: number };
};
```

- [ ] **Step 2: Add `getPlaylistTracks` function**

Add at the end of `src/api/spotify.ts`:

```typescript
function handlePlaylistApiError(status: number): never {
  if (status === 404) {
    throw new Error("Playlist not found. Check the URL and try again.");
  }
  if (status === 403) {
    throw new Error("This playlist is private and can't be loaded.");
  }
  if (status === 429) {
    throw new Error("Spotify is busy. Wait a moment and try again.");
  }
  throw new Error(`Spotify API request failed with ${status}.`);
}

export async function getPlaylistTracks(
  playlistId: string,
  accessToken: string,
  limit = 50,
  offset = 0,
): Promise<SpotifyPlaylistTracksResponse> {
  const params = new URLSearchParams({
    limit: String(Math.min(Math.max(limit, 1), 50)),
    offset: String(Math.max(offset, 0)),
  });
  const url = `${baseUrl}/playlists/${playlistId}/tracks?${params.toString()}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    handlePlaylistApiError(response.status);
  }
  return (await response.json()) as SpotifyPlaylistTracksResponse;
}

export async function getPlaylistMetadata(
  playlistId: string,
  accessToken: string,
): Promise<SpotifyPlaylistMetadata> {
  const url = `${baseUrl}/playlists/${playlistId}?fields=id%2Cname%2Cimages%2Ctracks(total)`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    handlePlaylistApiError(response.status);
  }
  return (await response.json()) as SpotifyPlaylistMetadata;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/api/spotify.ts
git commit -m "feat: add playlist track and metadata API helpers"
```

---

### Task 4: Playlist gallery loader

**Files:**
- Modify: `src/helper/spotifyGallery.ts`

- [ ] **Step 1: Add import and `loadPlaylistGalleryItems` to `src/helper/spotifyGallery.ts`**

Add `getPlaylistTracks` to the existing import at line 1:

```typescript
import { getSpotifyLikedSongs, getPlaylistTracks, type SpotifySavedTrackItem } from "@/api/spotify";
```

Then add at the end of the file:

```typescript
export async function loadPlaylistGalleryItems(
  playlistId: string,
  accessToken: string,
  onProgress?: (progress: SpotifyGalleryLoadProgress) => void,
): Promise<SpotifyGalleryPayload> {
  const allTracks: SpotifySavedTrackItem[] = [];
  let offset = 0;

  while (true) {
    const response = await getPlaylistTracks(playlistId, accessToken, 50, offset);

    // Playlist items can have null tracks (deleted from Spotify) — filter them out.
    const validItems = response.items.filter(
      (item): item is { added_at: string; track: SpotifySavedTrackItem["track"] } =>
        item.track !== null,
    );

    allTracks.push(...validItems);
    offset += response.items.length;

    onProgress?.({ loaded: allTracks.length, total: response.total });

    if (!response.next || response.items.length === 0 || allTracks.length >= response.total) {
      return mapSpotifyTracksToGalleryItems(allTracks);
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/helper/spotifyGallery.ts
git commit -m "feat: add loadPlaylistGalleryItems helper"
```

---

### Task 5: usePlaylistGallery hook

**Files:**
- Create: `src/hooks/usePlaylistGallery.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/usePlaylistGallery.ts
import { useEffect, useState } from "react";

import type { GalleryItem, GalleryItemFacetsByKey } from "@/types/types";
import { getAnonSpotifyToken } from "@/lib/spotifyAnon";
import { getPlaylistMetadata } from "@/api/spotify";
import { loadPlaylistGalleryItems } from "@/helper/spotifyGallery";

const PLAYLIST_GALLERY_CACHE_PREFIX = "playlist_gallery_";
const PLAYLIST_GALLERY_CACHE_TTL_MS = 1000 * 60 * 10;

type PlaylistGalleryCacheEntry = {
  items: GalleryItem[];
  facetsByKey: GalleryItemFacetsByKey;
  playlistName: string;
  totalTracks: number;
  cachedAt: number;
};

type UsePlaylistGalleryOptions = {
  playlistId: string | null;
};

export type PlaylistGalleryState = {
  items: GalleryItem[];
  facetsByKey: GalleryItemFacetsByKey;
  playlistName: string | null;
  trackCount: number;
  totalTracks: number | null;
  isLoading: boolean;
  errorMessage: string | null;
};

function getCacheKey(playlistId: string): string {
  return `${PLAYLIST_GALLERY_CACHE_PREFIX}${playlistId}`;
}

function loadCache(playlistId: string): PlaylistGalleryCacheEntry | null {
  try {
    const raw = window.localStorage.getItem(getCacheKey(playlistId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlaylistGalleryCacheEntry;
    if (!Array.isArray(parsed.items) || typeof parsed.cachedAt !== "number") {
      window.localStorage.removeItem(getCacheKey(playlistId));
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(getCacheKey(playlistId));
    return null;
  }
}

function saveCache(playlistId: string, entry: Omit<PlaylistGalleryCacheEntry, "cachedAt">): void {
  try {
    window.localStorage.setItem(
      getCacheKey(playlistId),
      JSON.stringify({ ...entry, cachedAt: Date.now() }),
    );
  } catch {
    // localStorage quota exceeded — skip silently
  }
}

export function usePlaylistGallery({ playlistId }: UsePlaylistGalleryOptions): PlaylistGalleryState {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [facetsByKey, setFacetsByKey] = useState<GalleryItemFacetsByKey>({});
  const [playlistName, setPlaylistName] = useState<string | null>(null);
  const [trackCount, setTrackCount] = useState(0);
  const [totalTracks, setTotalTracks] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!playlistId) {
      setItems([]);
      setFacetsByKey({});
      setPlaylistName(null);
      setTrackCount(0);
      setTotalTracks(null);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    let isCancelled = false;

    const load = async () => {
      setErrorMessage(null);

      const cached = loadCache(playlistId);
      const isCacheFresh = cached !== null && Date.now() - cached.cachedAt < PLAYLIST_GALLERY_CACHE_TTL_MS;

      if (cached) {
        setItems(cached.items);
        setFacetsByKey(cached.facetsByKey);
        setPlaylistName(cached.playlistName);
        setTrackCount(cached.items.length);
        setTotalTracks(cached.totalTracks);
      }

      if (isCacheFresh) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const token = await getAnonSpotifyToken();
        if (isCancelled) return;

        const [metadata, payload] = await Promise.all([
          getPlaylistMetadata(playlistId, token),
          loadPlaylistGalleryItems(playlistId, token, ({ loaded, total }) => {
            if (isCancelled) return;
            setTrackCount(loaded);
            setTotalTracks(total);
          }),
        ]);

        if (isCancelled) return;

        setItems(payload.items);
        setFacetsByKey(payload.facetsByKey);
        setPlaylistName(metadata.name);
        setTrackCount(payload.items.length);
        setTotalTracks(metadata.tracks.total);

        saveCache(playlistId, {
          items: payload.items,
          facetsByKey: payload.facetsByKey,
          playlistName: metadata.name,
          totalTracks: metadata.tracks.total,
        });
      } catch (error) {
        if (isCancelled) return;
        if (!cached) {
          setItems([]);
          setFacetsByKey({});
          setErrorMessage(error instanceof Error ? error.message : "Failed to load playlist.");
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [playlistId]);

  return { items, facetsByKey, playlistName, trackCount, totalTracks, isLoading, errorMessage };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePlaylistGallery.ts
git commit -m "feat: add usePlaylistGallery hook"
```

---

### Task 6: PlaylistUrlScreen component

**Files:**
- Create: `src/components/playlist-url/PlaylistUrlScreen.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/playlist-url/PlaylistUrlScreen.tsx
import { useState, type FormEvent } from "react";

type PlaylistUrlScreenProps = {
  onSubmit: (playlistId: string) => void;
  errorMessage?: string | null;
  isLoading?: boolean;
  trackCount?: number;
  totalTracks?: number | null;
};

function extractPlaylistId(url: string): string | null {
  const match = /open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/.exec(url);
  return match ? (match[1] ?? null) : null;
}

export function PlaylistUrlScreen({
  onSubmit,
  errorMessage,
  isLoading,
  trackCount = 0,
  totalTracks,
}: PlaylistUrlScreenProps) {
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const id = extractPlaylistId(url.trim());
    if (!id) {
      setValidationError("Paste a valid Spotify playlist URL (open.spotify.com/playlist/…)");
      return;
    }
    setValidationError(null);
    onSubmit(id);
  };

  const displayError = validationError ?? errorMessage;

  if (isLoading) {
    return (
      <main className="spotify-auth-screen">
        <div className="spotify-auth-screen__glow spotify-auth-screen__glow--left" />
        <div className="spotify-auth-screen__glow spotify-auth-screen__glow--right" />
        <section className="spotify-auth-card spotify-auth-card--loading">
          <p className="spotify-auth-card__eyebrow">Spotify Space</p>
          <h1 className="spotify-auth-card__title">Loading playlist.</h1>
          <p className="spotify-auth-card__copy">
            Building the gallery from the playlist tracks before the scene appears.
          </p>
          <p className="spotify-auth-card__status spotify-auth-card__status--success">
            {totalTracks
              ? `${trackCount} of ${totalTracks} tracks retrieved`
              : `${trackCount} tracks retrieved`}
          </p>
          <div className="spotify-auth-card__progress" aria-hidden="true">
            <div
              className="spotify-auth-card__progress-fill"
              style={{
                width: totalTracks
                  ? `${Math.min((trackCount / totalTracks) * 100, 100)}%`
                  : "20%",
              }}
            />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="spotify-auth-screen">
      <div className="spotify-auth-screen__glow spotify-auth-screen__glow--left" />
      <div className="spotify-auth-screen__glow spotify-auth-screen__glow--right" />
      <section className="spotify-auth-card">
        <p className="spotify-auth-card__eyebrow">Spotify Space</p>
        <h1 className="spotify-auth-card__title">Paste a playlist.</h1>
        <p className="spotify-auth-card__copy">
          Drop any public Spotify playlist URL to load it as a visual gallery.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            className="playlist-url-input"
            type="url"
            placeholder="https://open.spotify.com/playlist/…"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setValidationError(null);
            }}
            autoFocus
          />
          {displayError ? (
            <p className="spotify-auth-card__status spotify-auth-card__status--error">
              {displayError}
            </p>
          ) : null}
          <button className="spotify-auth-card__primary-action" type="submit">
            Load playlist
          </button>
        </form>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Add `playlist-url-input` CSS to `src/App.css`**

Append to `src/App.css`:

```css
.playlist-url-input {
  margin-top: 20px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
  font-size: 0.95rem;
  outline: none;
}

.playlist-url-input::placeholder {
  color: rgba(243, 248, 244, 0.36);
}

.playlist-url-input:focus {
  border-color: rgba(167, 255, 202, 0.42);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/playlist-url/PlaylistUrlScreen.tsx src/App.css
git commit -m "feat: add PlaylistUrlScreen entry component"
```

---

### Task 7: New App.tsx

**Files:**
- Create: `src/App.tsx`

- [ ] **Step 1: Create the new App.tsx**

```tsx
// src/App.tsx
import "./App.css";
import { useState } from "react";
import { GalleryScene, type LayoutMode } from "@/components/gallery-scene/GalleryScene";
import { GalleryFilters } from "@/components/gallery-scene/filters/GalleryFilters";
import { SpotifyEmbedPlayer } from "@/components/spotify/SpotifyEmbedPlayer";
import { PlaylistUrlScreen } from "@/components/playlist-url/PlaylistUrlScreen";
import { usePlaylistGallery } from "@/hooks/usePlaylistGallery";
import type { GalleryItem } from "@/types/types";

function App() {
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("initial");
  const [currentTrack, setCurrentTrack] = useState<GalleryItem | null>(null);

  const {
    items: galleryItems,
    facetsByKey,
    playlistName,
    trackCount,
    totalTracks,
    isLoading,
    errorMessage,
  } = usePlaylistGallery({ playlistId });

  const handleItemClick = (item: GalleryItem) => {
    if (!item.spotifyTrackUri) return;
    setCurrentTrack(item);
  };

  const handleChangePlaylist = () => {
    setPlaylistId(null);
    setCurrentTrack(null);
    setLayoutMode("initial");
  };

  if (!playlistId || errorMessage) {
    return (
      <PlaylistUrlScreen
        onSubmit={setPlaylistId}
        errorMessage={errorMessage}
      />
    );
  }

  if (isLoading) {
    return (
      <PlaylistUrlScreen
        onSubmit={setPlaylistId}
        isLoading
        trackCount={trackCount}
        totalTracks={totalTracks}
      />
    );
  }

  return (
    <div className="app-shell">
      <div className="app-shell__auth-indicator">
        <span>{playlistName ?? "Playlist"}</span>
        <span>{galleryItems.length} tracks loaded</span>
        <button onClick={handleChangePlaylist} type="button">
          Change playlist
        </button>
      </div>
      <GalleryFilters
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
        isAiEnriching={false}
      />
      <GalleryScene
        items={galleryItems}
        facetsByKey={facetsByKey}
        layoutMode={layoutMode}
        activeItemId={currentTrack?.id ?? null}
        disabled={false}
        onItemClick={handleItemClick}
        onItemDoubleClick={() => {}}
      />
      {currentTrack?.spotifyTrackUri ? (
        <SpotifyEmbedPlayer
          title={currentTrack.title ?? "Selected track"}
          trackUri={currentTrack.spotifyTrackUri}
        />
      ) : null}
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Build and verify no TypeScript errors**

```bash
npm run build 2>&1 | head -40
```

Expected: successful build, no errors.

- [ ] **Step 3: Run the dev server and manually test the flow**

```bash
npm run dev
```

Open `http://127.0.0.1:5173` in a browser. Verify:
1. Entry screen shows with URL input
2. Paste `https://open.spotify.com/playlist/1EEtAZE4injAlmdrdnFHsf?si=8300455d798c4d1d` → click "Load playlist"
3. Loading screen appears with progress counter
4. Gallery renders with album art tiles
5. Clicking a tile plays it in the embed player
6. Filters (layout modes) work
7. "Change playlist" button returns to URL input

- [ ] **Step 4: Verify with an invalid URL**

In the URL input, type `not-a-url` and click "Load playlist".
Expected: inline error "Paste a valid Spotify playlist URL (open.spotify.com/playlist/…)" appears, no fetch triggered.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: new App.tsx — playlist URL flow without auth"
```

---

## Self-Review

**Spec coverage:**
- ✅ `App.tsx` → `App.auth.tsx` rename — Task 1
- ✅ `src/lib/spotifyAnon.ts` — Task 2
- ✅ `getPlaylistTracks` + `getPlaylistMetadata` in `src/api/spotify.ts` — Task 3
- ✅ `loadPlaylistGalleryItems` in `src/helper/spotifyGallery.ts` — Task 4
- ✅ `usePlaylistGallery` hook — Task 5
- ✅ `PlaylistUrlScreen` component — Task 6
- ✅ New `App.tsx` — Task 7
- ✅ Error handling (404/403/429/network/invalid URL) — Tasks 3 + 6
- ✅ Playlist name in header — Task 5 + 7
- ✅ "Change playlist" button — Task 7
- ✅ 10-min localStorage cache per playlist ID — Task 5
- ✅ No AI enrichment, no playlist-add modal, no PKCE auth — confirmed by new App.tsx imports

**Type consistency check:**
- `getAnonSpotifyToken()` defined in Task 2, imported in Task 5 ✅
- `getPlaylistTracks(playlistId, accessToken, limit, offset)` defined in Task 3, called in Task 4 ✅
- `getPlaylistMetadata(playlistId, accessToken)` defined in Task 3, called in Task 5 ✅
- `loadPlaylistGalleryItems(playlistId, accessToken, onProgress?)` defined in Task 4, called in Task 5 ✅
- `SpotifyPlaylistTrackItem` defined in Task 3, used in Task 4 filter ✅
- `usePlaylistGallery({ playlistId })` → returns `PlaylistGalleryState` — used in Task 7 ✅
- `PlaylistUrlScreen` props: `onSubmit`, `errorMessage`, `isLoading`, `trackCount`, `totalTracks` — all passed correctly in Task 7 ✅

**Placeholder scan:** No TBDs, no "implement later", all code blocks are complete. ✅
