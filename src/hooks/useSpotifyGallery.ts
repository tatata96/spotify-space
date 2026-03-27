import { useEffect, useState } from "react";

import type { GalleryItem, GalleryItemFacetsByKey } from "@/types/types";
import { loadSpotifyGalleryItems } from "@/helper/spotifyGallery";

const SPOTIFY_GALLERY_CACHE_KEY = "spotify_gallery_items";
const SPOTIFY_GALLERY_CACHE_TTL_MS = 1000 * 60 * 10;

type UseSpotifyGalleryOptions = {
  enabled: boolean;
  accessToken?: string;
};

type SpotifyGalleryState = {
  items: GalleryItem[];
  facetsByKey: GalleryItemFacetsByKey;
  likedSongsCount: number;
  totalLikedSongs: number | null;
  isLoading: boolean;
  errorMessage: string | null;
};

type SpotifyGalleryCacheEntry = {
  items: GalleryItem[];
  facetsByKey: GalleryItemFacetsByKey;
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
    if (
      !Array.isArray(parsed.items) ||
      typeof parsed.totalLikedSongs !== "number" ||
      typeof parsed.cachedAt !== "number"
    ) {
      window.localStorage.removeItem(SPOTIFY_GALLERY_CACHE_KEY);
      return null;
    }

    const facetsByKey =
      parsed.facetsByKey && typeof parsed.facetsByKey === "object"
        ? parsed.facetsByKey
        : {};

    return {
      ...parsed,
      facetsByKey,
    };
  } catch {
    window.localStorage.removeItem(SPOTIFY_GALLERY_CACHE_KEY);
    return null;
  }
}

function saveCachedSpotifyGallery(items: GalleryItem[], facetsByKey: GalleryItemFacetsByKey) {
  const cacheEntry: SpotifyGalleryCacheEntry = {
    items,
    facetsByKey,
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
  const [facetsByKey, setFacetsByKey] = useState<GalleryItemFacetsByKey>({});
  const [likedSongsCount, setLikedSongsCount] = useState(0);
  const [totalLikedSongs, setTotalLikedSongs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setFacetsByKey({});
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
        setFacetsByKey(cachedGallery.facetsByKey ?? {});
        setLikedSongsCount(cachedGallery.items.length);
        setTotalLikedSongs(cachedGallery.totalLikedSongs);
      }

      if (isCacheFresh) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const nextGallery = await loadSpotifyGalleryItems(({ loaded, total }) => {
          if (isCancelled) {
            return;
          }

          setLikedSongsCount(loaded);
          setTotalLikedSongs(total);
        });

        if (isCancelled) {
          return;
        }

        setItems(nextGallery.items);
        setFacetsByKey(nextGallery.facetsByKey);
        setLikedSongsCount(nextGallery.items.length);
        setTotalLikedSongs((currentTotal) => currentTotal ?? nextGallery.items.length);
        saveCachedSpotifyGallery(nextGallery.items, nextGallery.facetsByKey);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        if (!cachedGallery) {
          setItems([]);
          setFacetsByKey({});
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
    facetsByKey,
    likedSongsCount,
    totalLikedSongs,
    isLoading,
    errorMessage,
  };
}
