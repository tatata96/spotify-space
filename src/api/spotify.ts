import { getValidSpotifyAccessToken, parseRetryAfterMs } from "@/lib/spotifyAuth";

const baseUrl = "https://api.spotify.com/v1";

export type SpotifyApiError = Error & {
  status?: number;
  retryAfterMs?: number;
};

export type SpotifyUserProfile = {
  id: string;
  display_name: string | null;
  email?: string;
  product?: string;
  country?: string;
};

export type SpotifySavedTrackItem = {
  added_at: string;
  track: {
    id: string | null;
    name: string;
    uri: string;
    href: string;
    duration_ms: number;
    explicit: boolean;
    popularity: number;
    preview_url: string | null;
    artists: Array<{
      id: string | null;
      name: string;
      uri: string;
    }>;
    album: {
      id: string | null;
      name: string;
      uri: string;
      release_date?: string;
      images: Array<{
        url: string;
        width: number | null;
        height: number | null;
      }>;
    };
  };
};

export type SpotifySavedTracksResponse = {
  href: string;
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
  items: SpotifySavedTrackItem[];
};

type SpotifyFetchOptions = {
  method?: string;
  body?: BodyInit | null;
  headers?: HeadersInit;
};

type SpotifyApiErrorOptions = {
  status?: number;
  retryAfterMs?: number;
};

type SpotifyErrorResponseBody = {
  error?:
    | string
    | {
        status?: number;
        message?: string;
      };
  error_description?: string;
};

function createSpotifyApiError(message: string, options: SpotifyApiErrorOptions = {}): SpotifyApiError {
  const error = new Error(message) as SpotifyApiError;
  if (typeof options.status === "number") {
    error.status = options.status;
  }
  if (typeof options.retryAfterMs === "number") {
    error.retryAfterMs = options.retryAfterMs;
  }
  return error;
}

function createUnauthorizedError(): SpotifyApiError {
  return createSpotifyApiError("Spotify auth is missing or expired. Please sign in again.", {
    status: 401,
  });
}

function buildSpotifyApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (path.startsWith("/")) {
    return `${baseUrl}${path}`;
  }

  return `${baseUrl}/${path}`;
}

async function getAccessTokenOrThrow(): Promise<string> {
  const accessToken = await getValidSpotifyAccessToken();
  if (!accessToken) {
    throw createUnauthorizedError();
  }

  return accessToken;
}

async function spotifyFetch(path: string, options?: SpotifyFetchOptions): Promise<Response> {
  const token = await getAccessTokenOrThrow();
  const url = buildSpotifyApiUrl(path);

  const headers = new Headers(options?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(url, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body ?? null,
  });

  if (response.status === 401 || response.status === 403) {
    throw createSpotifyApiError("Spotify rejected the access token. Please sign in again.", {
      status: response.status,
    });
  }

  if (!response.ok) {
    let message = `Spotify API request failed with ${response.status}.`;

    try {
      const errorBody = (await response.clone().json()) as SpotifyErrorResponseBody;
      if (typeof errorBody.error === "string") {
        message = errorBody.error;
      } else if (errorBody.error?.message) {
        message = errorBody.error.message;
      } else if (errorBody.error_description) {
        message = errorBody.error_description;
      }
    } catch {
      // Keep the fallback message when Spotify doesn't return JSON.
    }

    throw createSpotifyApiError(message, {
      status: response.status,
      retryAfterMs: response.status === 429 ? parseRetryAfterMs(response.headers.get("Retry-After"), 0) : undefined,
    });
  }

  return response;
}

export async function spotifyFetcher<T>(path: string): Promise<T> {
  const response = await spotifyFetch(path);
  return (await response.json()) as T;
}

export async function getSpotifyCurrentUserProfile(): Promise<SpotifyUserProfile> {
  return await spotifyFetcher<SpotifyUserProfile>("/me");
}

export function getSpotifyLikedSongsPath(limit?: number, offset?: number): string {
  const params = new URLSearchParams();
  const safeLimit = Math.min(Math.max(limit ?? 20, 1), 50);
  const safeOffset = Math.max(offset ?? 0, 0);

  params.set("limit", String(safeLimit));
  params.set("offset", String(safeOffset));

  return `/me/tracks?${params.toString()}`;
}

export async function getSpotifyLikedSongs(limit?: number, offset?: number): Promise<SpotifySavedTracksResponse> {
  return await spotifyFetcher<SpotifySavedTracksResponse>(getSpotifyLikedSongsPath(limit, offset));
}

export async function verifySpotifyConnection(): Promise<boolean> {
  await spotifyFetch("/me");
  return true;
}
