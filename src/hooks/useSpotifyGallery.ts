import { useEffect, useState } from "react";

import type { GalleryItem, GalleryItemFacetsByKey } from "@/types/types";
import { loadSpotifyGalleryItems } from "@/helper/spotifyGallery";
import { enrichTracksWithAi, GeminiQuotaExceededError } from "@/api/gemini";

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
  isAiEnriching: boolean;
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
  const [isAiEnriching, setIsAiEnriching] = useState(false);
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

  useEffect(() => {
    if (!enabled || isLoading || items.length === 0) return;

    const missingTracks = items.filter((item) => {
      const key = item.spotifyTrackUri ?? item.id;
      return !facetsByKey[key]?.ai;
    });

    if (missingTracks.length === 0) return;

    let cancelled = false;
    setIsAiEnriching(true);

    const BATCH_SIZE = 200;

    const runEnrichment = async () => {
      const trackInputs = missingTracks.map((item) => ({
        id: item.spotifyTrackUri ?? item.id,
        title: item.title ?? "",
        artist: item.category ?? "",
      }));

      const finalFacets: GalleryItemFacetsByKey = { ...facetsByKey };

      try {
        for (let i = 0; i < trackInputs.length; i += BATCH_SIZE) {
          if (cancelled) return;

          const batch = trackInputs.slice(i, i + BATCH_SIZE);

          try {
            const results = await enrichTracksWithAi(batch);
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
            if (err instanceof GeminiQuotaExceededError) {
              setErrorMessage("Gemini free tier quota exceeded. AI enrichment is unavailable until your quota resets.");
              return;
            }
            console.error("AI enrichment batch failed:", err);
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
    // facetsByKey intentionally omitted — enrichment triggers on item list changes only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, isLoading, enabled]);

  return {
    items,
    facetsByKey,
    likedSongsCount,
    totalLikedSongs,
    isLoading,
    isAiEnriching,
    errorMessage,
  };
}
