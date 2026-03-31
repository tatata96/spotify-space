# Spotify Space

An interactive visual gallery for your Spotify liked songs. Albums float in a 3D-like space and can be clustered and explored by track name, release year, or date added.

## Purpose

Spotify Space transforms your liked songs library into a browsable visual experience — album art arranged spatially, with animated layout modes that group your music in different ways. Click any album to play it via the embedded Spotify player.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Language | TypeScript |
| Build tool | Vite |
| Animation | GSAP 3 |
| Auth | Spotify PKCE OAuth |
| Data | Spotify Web API |
| Persistence | localStorage (tokens + gallery cache) |

No backend. No database. Runs entirely in the browser.

## Getting Started

1. Create a Spotify app at [developer.spotify.com](https://developer.spotify.com) and add `http://127.0.0.1:5173/callback` as a redirect URI.

2. Create a `.env` file in the project root:
   ```
   VITE_SPOTIFY_CLIENT_ID=your_client_id_here
   VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback
   ```

3. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```

4. Open `http://127.0.0.1:5173` — must use this exact URL (not `localhost`) to match the Spotify OAuth callback.

## Commands

```bash
npm run dev      # Dev server at http://127.0.0.1:5173
npm run build    # TypeScript compile + Vite bundle
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Layout Modes

| Mode | Description |
|------|-------------|
| Default | Random scatter with z-depth |
| Track Name | Clustered alphabetically |
| Release Year | Clustered by album release year |
| Date Added | Clustered by when you liked the song |
