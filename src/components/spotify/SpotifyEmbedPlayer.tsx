import { useEffect, useRef } from "react";

type SpotifyEmbedPlayerProps = {
  title: string;
  trackUri: string;
};

type SpotifyEmbedController = {
  loadUri: (uri: string) => void;
  play: () => void;
  destroy?: () => void;
};

type SpotifyIFrameApi = {
  createController: (
    element: HTMLElement,
    options: {
      uri: string;
      width?: number | string;
      height?: number | string;
    },
    callback: (controller: SpotifyEmbedController) => void,
  ) => void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameApi) => void;
  }
}

const SPOTIFY_IFRAME_API_ID = "spotify-iframe-api";
const SPOTIFY_IFRAME_API_SRC = "https://open.spotify.com/embed/iframe-api/v1";

let spotifyIframeApiPromise: Promise<SpotifyIFrameApi> | null = null;

function loadSpotifyIframeApi(): Promise<SpotifyIFrameApi> {
  if (spotifyIframeApiPromise) {
    return spotifyIframeApiPromise;
  }

  spotifyIframeApiPromise = new Promise<SpotifyIFrameApi>((resolve, reject) => {
    const existingScript = document.getElementById(SPOTIFY_IFRAME_API_ID) as HTMLScriptElement | null;

    window.onSpotifyIframeApiReady = (api) => {
      window.onSpotifyIframeApiReady = undefined;
      resolve(api);
    };

    if (existingScript) {
      existingScript.addEventListener("error", () => {
        reject(new Error("Spotify embed API failed to load."));
      });
      return;
    }

    const script = document.createElement("script");
    script.id = SPOTIFY_IFRAME_API_ID;
    script.src = SPOTIFY_IFRAME_API_SRC;
    script.async = true;
    script.onerror = () => {
      reject(new Error("Spotify embed API failed to load."));
    };
    document.body.appendChild(script);
  });

  return spotifyIframeApiPromise;
}

export function SpotifyEmbedPlayer({ title, trackUri }: SpotifyEmbedPlayerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);

  useEffect(() => {
    let isDisposed = false;

    const initializePlayer = async () => {
      if (!mountRef.current) {
        return;
      }

      try {
        const api = await loadSpotifyIframeApi();

        if (isDisposed || !mountRef.current) {
          return;
        }

        if (controllerRef.current) {
          controllerRef.current.loadUri(trackUri);
          controllerRef.current.play();
          return;
        }

        api.createController(
          mountRef.current,
          {
            uri: trackUri,
            width: "100%",
            height: 80,
          },
          (controller) => {
            if (isDisposed) {
              controller.destroy?.();
              return;
            }

            controllerRef.current = controller;
            controller.play();
          },
        );
      } catch {
        // Leave the mount empty if Spotify's embed API cannot load.
      }
    };

    void initializePlayer();

    return () => {
      isDisposed = true;
    };
  }, [trackUri]);

  useEffect(() => {
    return () => {
      controllerRef.current?.destroy?.();
      controllerRef.current = null;
    };
  }, []);

  return (
    <section className="spotify-embed-player" aria-label={`Now playing ${title}`}>
      <div ref={mountRef} className="spotify-embed-player__frame" />
    </section>
  );
}
