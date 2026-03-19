const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const PKCE_VERIFIER_STORAGE_KEY = "spotify_pkce_code_verifier";
const PKCE_STATE_STORAGE_KEY = "spotify_pkce_state";
const PKCE_REDIRECT_URI_STORAGE_KEY = "spotify_pkce_redirect_uri";
const TOKEN_STORAGE_KEY = "spotify_auth_tokens";
const AUTH_SCOPE = "user-library-read";
let loginCompletionPromise: Promise<StoredSpotifyTokens | null> | null = null;

type StoredSpotifyTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

const wait = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const base64UrlEncode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const getRandomString = (length: number) => {
  const allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomValues = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(randomValues, (value) => allowed[value % allowed.length]).join("");
};

const createCodeChallenge = async (codeVerifier: string) => {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return base64UrlEncode(new Uint8Array(digest));
};

export const parseRetryAfterMs = (headerValue: string | null, attempt: number) => {
  if (!headerValue) {
    return Math.min(1000 * 2 ** attempt, 8000);
  }

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const retryDate = Date.parse(headerValue);
  if (Number.isNaN(retryDate)) {
    return Math.min(1000 * 2 ** attempt, 8000);
  }

  return Math.max(retryDate - Date.now(), 0);
};

const getConfiguredRedirectUri = () => {
  const configured = import.meta.env.VITE_SPOTIFY_REDIRECT_URI?.trim();
  if (!configured) {
    throw new Error("Missing VITE_SPOTIFY_REDIRECT_URI.");
  }

  const redirectUri = configured;
  const parsed = new URL(redirectUri);
  const isLoopback = parsed.protocol === "http:" && parsed.hostname === "127.0.0.1";
  const isSecure = parsed.protocol === "https:";

  if (!isSecure && !isLoopback) {
    throw new Error(
      "Spotify redirect URI must use HTTPS, or http://127.0.0.1 during local development.",
    );
  }

  if (parsed.hostname === "localhost") {
    throw new Error("Spotify redirect URI cannot use http://localhost. Use http://127.0.0.1 instead.");
  }

  return redirectUri;
};

const clearPkceSessionStorage = () => {
  window.sessionStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
  window.sessionStorage.removeItem(PKCE_STATE_STORAGE_KEY);
  window.sessionStorage.removeItem(PKCE_REDIRECT_URI_STORAGE_KEY);
};

const getUriOriginAndPath = (uri: string) => {
  const parsed = new URL(uri);
  return `${parsed.origin}${parsed.pathname}`;
};

const clearSpotifyCallbackParams = (url: URL) => {
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  window.history.replaceState({}, document.title, url.toString());
};

export const getSpotifyClientId = () => {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("Missing VITE_SPOTIFY_CLIENT_ID.");
  }

  return clientId;
};

export const getSpotifyRedirectUri = () => getConfiguredRedirectUri();

export const getSpotifyScope = () => AUTH_SCOPE;

export const loadStoredTokens = (): StoredSpotifyTokens | null => {
  const rawValue = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredSpotifyTokens;
  } catch {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }
};

const saveTokens = (response: TokenResponse, existingRefreshToken?: string) => {
  const tokens: StoredSpotifyTokens = {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? existingRefreshToken,
    expiresAt: Date.now() + response.expires_in * 1000,
    scope: response.scope ?? AUTH_SCOPE,
    tokenType: response.token_type,
  };

  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  return tokens;
};

export const clearSpotifySession = () => {
  clearPkceSessionStorage();
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
};

const postSpotifyToken = async (params: URLSearchParams) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get("Retry-After"), attempt);
      await wait(retryAfterMs);
      continue;
    }

    if (!response.ok) {
      let message = `Spotify token request failed with ${response.status}.`;

      try {
        const errorBody = (await response.json()) as TokenResponse;
        const details = errorBody.error_description ?? errorBody.error;
        if (details) {
          message = `Spotify token request failed: ${details}`;
        }
      } catch {
        // Keep the fallback message when the response is not JSON.
      }

      throw new Error(message);
    }

    return (await response.json()) as TokenResponse;
  }

  throw new Error("Spotify rate limit reached. Try again in a moment.");
};

export const beginSpotifyLogin = async () => {
  const clientId = getSpotifyClientId();
  const redirectUri = getConfiguredRedirectUri();
  const codeVerifier = getRandomString(64);
  const state = getRandomString(16);
  const codeChallenge = await createCodeChallenge(codeVerifier);

  window.sessionStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, codeVerifier);
  window.sessionStorage.setItem(PKCE_STATE_STORAGE_KEY, state);
  window.sessionStorage.setItem(PKCE_REDIRECT_URI_STORAGE_KEY, redirectUri);

  const searchParams = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: AUTH_SCOPE,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    state,
  });

  window.location.assign(`${SPOTIFY_AUTHORIZE_URL}?${searchParams.toString()}`);
};

export const maybeCompleteSpotifyLogin = async () => {
  if (loginCompletionPromise) {
    return await loginCompletionPromise;
  }

  loginCompletionPromise = (async () => {
    const currentUrl = new URL(window.location.href);
    const code = currentUrl.searchParams.get("code");
    const returnedState = currentUrl.searchParams.get("state");
    const error = currentUrl.searchParams.get("error");

    if (error) {
      clearSpotifyCallbackParams(currentUrl);
      throw new Error(`Spotify authorization failed: ${error}`);
    }

    if (!code) {
      return loadStoredTokens();
    }

    const storedState = window.sessionStorage.getItem(PKCE_STATE_STORAGE_KEY);
    const codeVerifier = window.sessionStorage.getItem(PKCE_VERIFIER_STORAGE_KEY);
    const storedRedirectUri = window.sessionStorage.getItem(PKCE_REDIRECT_URI_STORAGE_KEY);
    const configuredRedirectUri = getConfiguredRedirectUri();

    if (!returnedState || !storedState || returnedState !== storedState) {
      clearPkceSessionStorage();
      throw new Error("Spotify authorization state mismatch. Please try signing in again.");
    }

    if (!codeVerifier) {
      clearPkceSessionStorage();
      throw new Error("Missing PKCE code verifier. Please try signing in again.");
    }

    if (!storedRedirectUri || storedRedirectUri !== configuredRedirectUri) {
      clearPkceSessionStorage();
      throw new Error(
        "Spotify redirect URI changed during sign-in. Use the same 127.0.0.1 redirect URI and try again.",
      );
    }

    if (getUriOriginAndPath(currentUrl.toString()) !== getUriOriginAndPath(configuredRedirectUri)) {
      clearPkceSessionStorage();
      throw new Error("Spotify callback URI does not match VITE_SPOTIFY_REDIRECT_URI.");
    }

    // Remove the one-time callback params immediately so duplicate effect runs
    // do not attempt to exchange the same authorization code a second time.
    clearSpotifyCallbackParams(currentUrl);

    const tokenResponse = await postSpotifyToken(
      new URLSearchParams({
        client_id: getSpotifyClientId(),
        grant_type: "authorization_code",
        code,
        redirect_uri: storedRedirectUri,
        code_verifier: codeVerifier,
      }),
    );

    clearPkceSessionStorage();
    return saveTokens(tokenResponse);
  })();

  try {
    return await loginCompletionPromise;
  } finally {
    loginCompletionPromise = null;
  }
};

export const refreshSpotifyAccessToken = async (tokens: StoredSpotifyTokens) => {
  if (!tokens.refreshToken) {
    throw new Error("Missing Spotify refresh token. Please sign in again.");
  }

  const tokenResponse = await postSpotifyToken(
    new URLSearchParams({
      client_id: getSpotifyClientId(),
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  );

  return saveTokens(tokenResponse, tokens.refreshToken);
};

export const getValidSpotifyAccessToken = async () => {
  const tokens = loadStoredTokens();
  if (!tokens) {
    return null;
  }

  if (tokens.expiresAt - Date.now() > 60_000) {
    return tokens.accessToken;
  }

  const refreshedTokens = await refreshSpotifyAccessToken(tokens);
  return refreshedTokens.accessToken;
};

export type { StoredSpotifyTokens };
