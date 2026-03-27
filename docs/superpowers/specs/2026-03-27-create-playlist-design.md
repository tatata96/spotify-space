# Create Playlist Feature — Design Spec
_Date: 2026-03-27_

## Overview

Add a "Create Playlist" button to the gallery that lets users select or create a Spotify playlist, then browse their liked songs and double-click to add tracks to it.

---

## Interaction Flow

1. User clicks **"Create Playlist"** button (top-left, fixed position)
2. **PlaylistPickerModal** opens, showing the user's existing Spotify playlists
3. User either:
   - **Picks an existing playlist** → modal closes → playlist-add mode activates
   - **Clicks "Create new"** → an inline form appears in the modal (name + optional description) → on submit, a new playlist is created via API → modal closes → playlist-add mode activates
4. **Playlist-add mode** is active:
   - A green border frame appears around the entire screen
   - The "Create Playlist" button becomes a **"Done"** button
   - **Single-click** on a gallery item plays it as usual
   - **Double-click** on a gallery item adds it to the selected playlist and shows a brief toast ("Added to [playlist name]")
5. Clicking **"Done"** exits playlist-add mode — frame disappears, button reverts to "Create Playlist"

---

## API (`src/api/spotify.ts`)

Three new exported async functions:

### `getUserPlaylists(limit?, offset?)`
- `GET /me/playlists`
- Returns `SpotifyPlaylistsResponse` (id, name, images, owner, tracks.total)
- Default limit 50, offset 0

### `createPlaylist(userId, name, description?)`
- `POST /users/{userId}/playlists`
- Body: `{ name, description: description ?? "", public: false }`
- Returns the created `SpotifyPlaylist` object

### `addTrackToPlaylist(playlistId, trackUri)`
- `POST /playlists/{playlistId}/tracks`
- Body: `{ uris: [trackUri] }`
- Returns void (throws on error)

New types added to `spotify.ts`:
- `SpotifyPlaylist` — `{ id, name, images, owner: { id } }`
- `SpotifyPlaylistsResponse` — `{ items: SpotifyPlaylist[], total, next }`

---

## Components

### `PlaylistButton` (`src/components/playlist/PlaylistButton.tsx`)
- Fixed position, top-left (e.g. `top: 2rem; left: 2rem`)
- Styled to match the existing glass-morphism design of `GalleryFilters`
- Two states: default ("Create Playlist") and active ("Done")
- Props: `isActive: boolean`, `onClick: () => void`

### `PlaylistPickerModal` (`src/components/playlist/PlaylistPickerModal.tsx`)
- Centered modal overlay with backdrop blur
- Two views:
  - **List view**: scrollable list of user's playlists (image thumbnail, name). "Create new playlist" at the top/bottom as a distinct row
  - **Create view**: inline form with a name input (required) and description textarea (optional), plus Cancel and Create buttons
- Props:
  - `onSelect: (playlist: SpotifyPlaylist) => void`
  - `onClose: () => void`
  - `userId: string` (needed for createPlaylist API call)

### `PlaylistModeFrame` (`src/components/playlist/PlaylistModeFrame.tsx`)
- A fixed `div` covering the full viewport with a green border (Spotify green `#1ed760`, ~3px solid)
- `pointer-events: none` so it doesn't block interaction
- Only rendered when playlist-add mode is active

### `Toast` (`src/components/playlist/Toast.tsx`)
- Fixed position, bottom-center or bottom-right
- Shows for ~2.5s then disappears (CSS transition fade-out)
- Props: `message: string`, `onDone: () => void`
- Simple state: timeout triggers `onDone` which removes it from App state

---

## State (`App.tsx`)

**User profile:** `getSpotifyCurrentUserProfile()` is already available in `src/api/spotify.ts`. App.tsx will call it once after auth succeeds and store `userProfile.id` in state — this is needed to pass as `userId` to `createPlaylist`. If the app already fetches the profile elsewhere, reuse that; otherwise add a single fetch call in the auth success path.

New state:
```ts
const [isPlaylistMode, setIsPlaylistMode] = useState(false);
const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
const [showPlaylistModal, setShowPlaylistModal] = useState(false);
const [toastMessage, setToastMessage] = useState<string | null>(null);
```

**Button click handler:**
- If not in playlist mode → open modal (`setShowPlaylistModal(true)`)
- If in playlist mode → exit mode (`setIsPlaylistMode(false)`, `setSelectedPlaylist(null)`)

**Modal `onSelect` handler:**
- `setSelectedPlaylist(playlist)` → `setShowPlaylistModal(false)` → `setIsPlaylistMode(true)`

**Double-click handler on gallery items:**
- Only active when `isPlaylistMode && selectedPlaylist`
- Calls `addTrackToPlaylist(selectedPlaylist.id, item.spotifyTrackUri)`
- On success: `setToastMessage(`Added to ${selectedPlaylist.name}`)`
- On error: `setToastMessage("Failed to add — try again")`

---

## Double-click in `GalleryItem`

`GalleryItem` already handles `onClick`. We need to add `onDoubleClick`.

The tricky part: native browser fires `click` before `dblclick`. To avoid playing the track on a double-click, we use a short click delay (~200ms) when `isPlaylistMode` is true:
- Single click → wait 200ms → if no second click, treat as play
- Double click → cancel the pending play, treat as add-to-playlist

Alternatively (simpler): in playlist mode, single click always plays (no delay needed) and double click adds. Since the Spotify embed player doesn't react badly to rapid play calls, no debounce is strictly needed. Both events fire; the play just starts then the add-to-playlist API call goes out. This is acceptable UX — the song plays briefly and gets added.

**Decision:** No click delay. Single-click plays, double-click adds (both fire; behavior is fine in practice).

`GalleryItem` new prop: `onDoubleClick?: (item: GalleryItem) => void`

---

## Styling

- `PlaylistButton` reuses `filter-sidebar__btn` styles (glass morphism, border-radius 14px, backdrop-filter blur)
- `PlaylistModeFrame`: `position: fixed; inset: 0; border: 3px solid #1ed760; pointer-events: none; z-index: 50;`
- Modal overlay: `position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 60; display: flex; align-items: center; justify-content: center;`
- Modal card: `background: rgba(20,30,24,0.95); border-radius: 16px; padding: 2rem; max-width: 440px; width: 90%;`
- Toast: `position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); background: rgba(30,215,96,0.15); border: 1px solid #1ed760; color: #fff; padding: 0.6rem 1.2rem; border-radius: 99px; z-index: 70;`

---

## Error Handling

- If `getUserPlaylists()` fails → show error message inside the modal
- If `createPlaylist()` fails → show inline error in the create form
- If `addTrackToPlaylist()` fails → toast shows error message

---

## Out of Scope

- Pagination for playlists (first 50 is enough for now)
- Adding multiple tracks at once (batch selection)
- Removing tracks from a playlist
- Editing playlist details after creation
