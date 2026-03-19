import { useEffect, useState } from "react";

import type { GalleryItem } from "@/types/types";
import { loadSpotifyGalleryItems } from "@/helper/spotifyGallery";

const SPOTIFY_GALLERY_CACHE_KEY = "spotify_gallery_items";
const SPOTIFY_GALLERY_CACHE_TTL_MS = 1000 * 60 * 10;

type UseSpotifyGalleryOptions = {
  enabled: boolean;
  accessToken?: string;
};

type SpotifyGalleryState = {
  items: GalleryItem[];
  likedSongsCount: number;
  totalLikedSongs: number | null;
  isLoading: boolean;
  errorMessage: string | null;
};

type SpotifyGalleryCacheEntry = {
  items: GalleryItem[];
  totalLikedSongs: number;
  cachedAt: number;
};

function loadCachedSpotifyGallery(): SpotifyGalleryCacheEntry | null {
  const rawValue = window.localStorage.getItem(SPOTIFY_GALLERY_CACHE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as SpotifyGalleryCacheEntry;
    if (!Array.isArray(parsed.items) || typeof parsed.totalLikedSongs !== "number" || typeof parsed.cachedAt !== "number") {
      window.localStorage.removeItem(SPOTIFY_GALLERY_CACHE_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(SPOTIFY_GALLERY_CACHE_KEY);
    return null;
  }
}

function saveCachedSpotifyGallery(items: GalleryItem[]) {
  const cacheEntry: SpotifyGalleryCacheEntry = {
    items,
    totalLikedSongs: items.length,
    cachedAt: Date.now(),
  };

  window.localStorage.setItem(SPOTIFY_GALLERY_CACHE_KEY, JSON.stringify(cacheEntry));
}

function clearCachedSpotifyGallery() {
  window.localStorage.removeItem(SPOTIFY_GALLERY_CACHE_KEY);
}

export function useSpotifyGallery({ enabled, accessToken }: UseSpotifyGalleryOptions): SpotifyGalleryState {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [likedSongsCount, setLikedSongsCount] = useState(0);
  const [totalLikedSongs, setTotalLikedSongs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLikedSongsCount(0);
      setTotalLikedSongs(null);
      setIsLoading(false);
      setErrorMessage(null);
      clearCachedSpotifyGallery();
      return;
    }

    let isCancelled = false;

    const loadGallery = async () => {
      setErrorMessage(null);

      const cachedGallery = loadCachedSpotifyGallery();
      const isCacheFresh =
        cachedGallery !== null && Date.now() - cachedGallery.cachedAt < SPOTIFY_GALLERY_CACHE_TTL_MS;

      if (cachedGallery) {
        setItems(cachedGallery.items);
        setLikedSongsCount(cachedGallery.items.length);
        setTotalLikedSongs(cachedGallery.totalLikedSongs);
      }

      if (isCacheFresh) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const nextItems = await loadSpotifyGalleryItems(({ loaded, total }) => {
          if (isCancelled) {
            return;
          }

          setLikedSongsCount(loaded);
          setTotalLikedSongs(total);
        });

        if (isCancelled) {
          return;
        }

        setItems(nextItems);
        setLikedSongsCount(nextItems.length);
        setTotalLikedSongs((currentTotal) => currentTotal ?? nextItems.length);
        saveCachedSpotifyGallery(nextItems);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        if (!cachedGallery) {
          setItems([]);
          setErrorMessage(error instanceof Error ? error.message : "Unable to load Spotify liked songs.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadGallery();

    return () => {
      isCancelled = true;
    };
  }, [enabled, accessToken]);

  return {
    items,
    likedSongsCount,
    totalLikedSongs,
    isLoading,
    errorMessage,
  };
}
