import { getSpotifyLikedSongs, type SpotifySavedTrackItem } from "@/api/spotify";
import type { GalleryItem, GalleryItemFacetsByKey } from "@/types/types";

const FALLBACK_COVER_DATA_URL =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1ed760" />
          <stop offset="100%" stop-color="#0b120e" />
        </linearGradient>
      </defs>
      <rect width="600" height="600" fill="url(#bg)" />
      <circle cx="300" cy="300" r="164" fill="rgba(255,255,255,0.12)" />
      <circle cx="300" cy="300" r="52" fill="rgba(255,255,255,0.28)" />
    </svg>
  `);

export type SpotifyGalleryLoadProgress = {
  loaded: number;
  total: number | null;
};

export type SpotifyGalleryPayload = {
  items: GalleryItem[];
  facetsByKey: GalleryItemFacetsByKey;
};

function getFacetKey(item: GalleryItem): string {
  return item.spotifyTrackUri ?? item.id;
}

export function mapSpotifyTracksToGalleryItems(savedTracks: SpotifySavedTrackItem[]): SpotifyGalleryPayload {
  const facetsByKey: GalleryItemFacetsByKey = {};
  const items = savedTracks.map((savedTrack, index) => {
    const item: GalleryItem = {
      id: savedTrack.track.id ?? String(index + 1),
      imageUrl: savedTrack.track.album.images[0]?.url ?? FALLBACK_COVER_DATA_URL,
      title: savedTrack.track.name,
      category:
        savedTrack.track.artists[0]?.name?.trim() ||
        savedTrack.track.album.name.trim() ||
        "Uncategorized",
      spotifyTrackUri: savedTrack.track.uri,
    };

    facetsByKey[getFacetKey(item)] = {
      spotify: {
        addedAt: savedTrack.added_at,
        releaseDate: savedTrack.track.album.release_date,
      },
    };

    return item;
  });

  return {
    items,
    facetsByKey,
  };
}

export async function loadSpotifyGalleryItems(
  onProgress?: (progress: SpotifyGalleryLoadProgress) => void,
): Promise<SpotifyGalleryPayload> {
  const allTracks: SpotifySavedTrackItem[] = [];
  let offset = 0;

  while (true) {
    const response = await getSpotifyLikedSongs(50, offset);

    allTracks.push(...response.items);
    offset += response.items.length;

    onProgress?.({
      loaded: allTracks.length,
      total: response.total,
    });

    if (!response.next || response.items.length === 0 || allTracks.length >= response.total) {
      return mapSpotifyTracksToGalleryItems(allTracks);
    }
  }
}
