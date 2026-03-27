# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server at http://127.0.0.1:5173
npm run build      # TypeScript compile + Vite bundle
npm run lint       # ESLint validation
npm run preview    # Preview production build
```

No test runner is configured.

## Environment

Requires a `.env` file with:
```
VITE_SPOTIFY_CLIENT_ID=<spotify_app_client_id>
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback
```

The dev server must run on `127.0.0.1:5173` (not `localhost`) to match the Spotify OAuth callback URL.

## Architecture

Spotify Space is a browser-only SPA that displays a user's Spotify liked songs as an interactive visual gallery. No backend — all auth uses PKCE flow with tokens stored in localStorage.

### Data Flow

```
useSpotifyAuth (PKCE OAuth) → access token
  ↓
useSpotifyGallery → loadSpotifyGalleryItems() → paginated Spotify API → GalleryItem[]
  (caches to localStorage, 10-min TTL)
  ↓
App.tsx (orchestrates state: auth, items, facets, layout mode, current track)
  ↓
GalleryScene → useGallerySceneLayout() → GSAP-animated positions
GalleryFilters → LayoutMode: "initial" | "trackName" | "addedAt" | "releaseYear"
SpotifyEmbedPlayer → Spotify iframe API
```

### Key Concepts

**Layout Modes** (`src/components/gallery-scene/helper/gallerySceneLayout.ts`): Items are positioned using two algorithms — `createInitialLayout` (random scatter with z-depth) and `createClusterLayout` (groups by trackName/addedAt/releaseYear using sunflower-pattern positioning within each cluster).

**Pan/Zoom** (`useScenePanZoom.ts`): GSAP drives all transforms. The scene uses CSS transforms on a container div; clusters scroll into view via animated pan to viewport center.

**Gallery data** (`src/helper/spotifyGallery.ts`): Maps Spotify API track objects to `GalleryItem` + `GalleryItemFacets`. Facets carry `addedAt` (ISO date) and `releaseDate` used for clustering.

**Auth** (`src/lib/spotifyAuth.ts`): Full PKCE implementation — code verifier/challenge, token exchange, refresh, session persistence in localStorage.

### Path Alias

`@/` maps to `src/` — use `@/components/...`, `@/hooks/...`, etc.

### Types

Core interfaces live in `src/types/types.ts`: `GalleryItem`, `GalleryItemFacets`, `LayoutMode`.
