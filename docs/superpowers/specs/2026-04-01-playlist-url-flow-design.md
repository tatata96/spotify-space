# Playlist URL Flow — Design Spec

**Date:** 2026-04-01
**Status:** Approved

## Overview

Replace the Spotify OAuth login flow with a public playlist URL input. The user pastes a Spotify playlist URL, the app fetches tracks anonymously, and renders the same gallery experience. No user authentication required.

The old `App.tsx` is preserved as `App.auth.tsx` and is not modified.

---

## File Changes

| File | Action |
|------|--------|
| `src/App.tsx` | Rename to `src/App.auth.tsx` |
| `src/App.tsx` | New file — playlist URL flow only |
| `src/lib/spotifyAnon.ts` | New — anonymous token fetcher |
| `src/api/spotify.ts` | Add `getPlaylistTracks()` function |
| `src/helper/spotifyGallery.ts` | Add `loadPlaylistGalleryItems()` function |
| `src/hooks/usePlaylistGallery.ts` | New hook — mirrors useSpotifyGallery |
| `src/components/playlist-url/PlaylistUrlScreen.tsx` | New entry screen component |

---

## Anonymous Token

`src/lib/spotifyAnon.ts` fetches a short-lived access token from the undocumented Spotify endpoint used by the web player:

```
GET https://open.spotify.com/get_access_token
Headers: { cookie: "" }  (no cookies needed for public data)
```

Response shape: `{ accessToken: string, accessTokenExpirationTimestampMs: number, isAnonymous: boolean }`

- Token is cached in module memory (not localStorage) for its lifetime
- If the fetch fails, throw a user-friendly error: "Could not reach Spotify. Try again."
- CORS: this endpoint allows browser requests (used by spotify.com itself)

---

## Playlist API

`getPlaylistTracks(playlistId: string, accessToken: string)` added to `src/api/spotify.ts`:

- Hits `GET /playlists/{id}/tracks?limit=50&offset={n}` with the provided Bearer token directly (not via `spotifyFetch` which uses the PKCE session)
- Paginates until all tracks are loaded
- Returns `SpotifySavedTrackItem[]` — same type as liked songs response items so `mapSpotifyTracksToGalleryItems` can be reused without changes

Playlist metadata (`GET /playlists/{id}`) also fetched to get the playlist name and cover image for display in the header.

---

## New Hook: usePlaylistGallery

`src/hooks/usePlaylistGallery.ts`

```ts
type UsePlaylistGalleryOptions = {
  playlistId: string | null;
};

type PlaylistGalleryState = {
  items: GalleryItem[];
  facetsByKey: GalleryItemFacetsByKey;
  playlistName: string | null;
  trackCount: number;
  totalTracks: number | null;
  isLoading: boolean;
  errorMessage: string | null;
};
```

- `playlistId: null` → idle state, no fetch
- Caches result in localStorage keyed as `playlist_gallery_{playlistId}` with 10-min TTL
- No AI enrichment (omitted from this flow — can be added later)
- On error, sets `errorMessage` and leaves `items: []`

---

## New Entry Screen: PlaylistUrlScreen

`src/components/playlist-url/PlaylistUrlScreen.tsx`

- Full-screen centered layout (reuses existing `.spotify-auth-screen` CSS classes for the glow background)
- Single `<input>` accepting a Spotify playlist URL
- Extracts playlist ID via regex: `open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)`
- Validates on submit — shows inline error if URL is not a valid Spotify playlist URL
- On valid submit: sets `playlistId` in App state → triggers `usePlaylistGallery`

Loading state (while tracks fetch):
- Same loading card UI as current liked-songs loader
- Shows "X of Y tracks retrieved" progress
- No disconnect button (no auth to disconnect)

Error state:
- Inline message below the input
- Input remains editable so user can try a different URL

---

## New App.tsx

State:
```ts
const [playlistId, setPlaylistId] = useState<string | null>(null);
const [layoutMode, setLayoutMode] = useState<LayoutMode>("initial");
const [currentTrack, setCurrentTrack] = useState<GalleryItem | null>(null);
```

Render logic:
1. `playlistId === null` → render `<PlaylistUrlScreen onSubmit={setPlaylistId} />`
2. `isLoading` → render loading card
3. `errorMessage` → render error state inside `PlaylistUrlScreen` (reset `playlistId` to allow retry)
4. Loaded → render `GalleryScene` + `GalleryFilters` + `SpotifyEmbedPlayer`

Header strip (replacing auth indicator):
- Shows playlist name
- "Change playlist" button → resets `playlistId` to `null`, clears gallery state

**Removed vs old App.tsx:**
- `useSpotifyAuth`
- `PlaylistButton`, `PlaylistPickerModal`, `PlaylistModeFrame`, `Toast`
- `handleItemDoubleClick`
- `isPlaylistMode`, `selectedPlaylist`, `showPlaylistModal` state

---

## Data Flow

```
PlaylistUrlScreen → playlistId (string)
  ↓
usePlaylistGallery(playlistId)
  → spotifyAnon.getAnonToken()          (cached, module-level)
  → getPlaylistTracks(id, token)        (paginated)
  → mapSpotifyTracksToGalleryItems()    (reused unchanged)
  → GalleryItem[] + GalleryItemFacetsByKey
  ↓
App.tsx → GalleryScene + GalleryFilters + SpotifyEmbedPlayer
```

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Invalid URL pasted | Inline validation error, no fetch triggered |
| Anonymous token fetch fails | `errorMessage` shown, user can retry |
| Playlist not found (404) | "Playlist not found. Check the URL and try again." |
| Playlist is private (403) | "This playlist is private and can't be loaded." |
| Rate limited (429) | "Spotify is busy. Wait a moment and try again." |
| Network error | "Could not reach Spotify. Check your connection." |

---

## What Is Not Included

- AI enrichment (Gemini) — not wired up in this flow
- Add-to-playlist feature — requires user auth, excluded by design
- Liked songs flow — preserved in `App.auth.tsx`, not accessible from UI
