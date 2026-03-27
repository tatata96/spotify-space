import { useEffect, useState } from "react";

import {
  beginSpotifyLogin,
  clearSpotifySession,
  getSpotifyClientId,
  getSpotifyRedirectUri,
  getSpotifyScope,
  loadStoredTokens,
  maybeCompleteSpotifyLogin,
  type StoredSpotifyTokens,
} from "@/lib/spotifyAuth";

type SpotifyAuthState = {
  tokens: StoredSpotifyTokens | null;
  isLoading: boolean;
  errorMessage: string | null;
  login: () => Promise<void>;
  logout: () => void;
  scope: string;
};

export const useSpotifyAuth = (): SpotifyAuthState => {
  const [tokens, setTokens] = useState<StoredSpotifyTokens | null>(() => loadStoredTokens());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        getSpotifyClientId();
        getSpotifyRedirectUri();
        const nextTokens = await maybeCompleteSpotifyLogin();
        if (!isMounted) {
          return;
        }

        setTokens(nextTokens);
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setTokens(null);
        setErrorMessage(error instanceof Error ? error.message : "Spotify sign-in failed.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    tokens,
    isLoading,
    errorMessage,
    scope: getSpotifyScope(),
    login: async () => {
      setErrorMessage(null);

      try {
        await beginSpotifyLogin();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to start Spotify sign-in.");
      }
    },
    logout: () => {
      clearSpotifySession();
      setTokens(null);
      setErrorMessage(null);
    },
  };
};
