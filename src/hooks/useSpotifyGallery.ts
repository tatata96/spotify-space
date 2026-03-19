import { useEffect, useState } from "react";

import type { GalleryItem } from "@/types/types";
import { loadSpotifyGalleryItems } from "@/helper/spotifyGallery";

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
      return;
    }

    let isCancelled = false;

    const loadGallery = async () => {
      setIsLoading(true);
      setErrorMessage(null);

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
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setItems([]);
        setErrorMessage(error instanceof Error ? error.message : "Unable to load Spotify liked songs.");
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
