import "./App.css";
import { useState } from "react";
import { GalleryScene, type LayoutMode } from "@/components/gallery-scene/GalleryScene";
import { GalleryFilters } from "@/components/gallery-scene/filters/GalleryFilters";
import { SpotifyLoginScreen } from "@/components/auth/SpotifyLoginScreen";
import { SpotifyEmbedPlayer } from "@/components/spotify/SpotifyEmbedPlayer";
import { useSpotifyAuth } from "@/hooks/useSpotifyAuth";
import { useSpotifyGallery } from "@/hooks/useSpotifyGallery";
import type { GalleryItem } from "@/types/types";

function App() {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("initial");
  const [currentTrack, setCurrentTrack] = useState<GalleryItem | null>(null);
  const { errorMessage, isLoading, login, logout, scope, tokens } = useSpotifyAuth();
  const isSignedIn = Boolean(tokens);
  const {
    items: galleryItems,
    facetsByKey,
    likedSongsCount,
    totalLikedSongs,
    isLoading: isLibraryLoading,
    errorMessage: libraryError,
  } = useSpotifyGallery({
    enabled: isSignedIn,
    accessToken: tokens?.accessToken,
  });

  const handleItemClick = (item: GalleryItem) => {
    if (!item.spotifyTrackUri) {
      return;
    }

    setCurrentTrack(item);
  };

  if (!isSignedIn) {
    return (
      <SpotifyLoginScreen
        errorMessage={errorMessage}
        isLoading={isLoading}
        isSignedIn={false}
        onLogin={login}
        onLogout={logout}
        scope={scope}
      />
    );
  }

  if (isLibraryLoading) {
    return (
      <main className="spotify-auth-screen">
        <div className="spotify-auth-screen__glow spotify-auth-screen__glow--left" />
        <div className="spotify-auth-screen__glow spotify-auth-screen__glow--right" />

        <section className="spotify-auth-card spotify-auth-card--loading">
          <p className="spotify-auth-card__eyebrow">Spotify Space</p>
          <h1 className="spotify-auth-card__title">Loading your liked songs.</h1>
          <p className="spotify-auth-card__copy">
            Building the gallery from your full Spotify library before the scene appears.
          </p>
          <p className="spotify-auth-card__status spotify-auth-card__status--success">
            {totalLikedSongs ? `${likedSongsCount} of ${totalLikedSongs} tracks retrieved` : `${likedSongsCount} tracks retrieved`}
          </p>
          <div className="spotify-auth-card__progress" aria-hidden="true">
            <div
              className="spotify-auth-card__progress-fill"
              style={{
                width: totalLikedSongs ? `${Math.min((likedSongsCount / totalLikedSongs) * 100, 100)}%` : "20%",
              }}
            />
          </div>
          <button className="spotify-auth-card__secondary-action" onClick={logout} type="button">
            Disconnect
          </button>
        </section>
      </main>
    );
  }

  if (libraryError) {
    return (
      <SpotifyLoginScreen
        errorMessage={libraryError}
        isLoading={false}
        isSignedIn={true}
        onLogin={login}
        onLogout={logout}
        scope={scope}
      />
    );
  }

  return (
    <div className="app-shell">
      <div className="app-shell__auth-indicator">
        <span>Spotify connected</span>
        <span>{galleryItems.length} liked songs loaded</span>
        <button
          onClick={() => {
            setCurrentTrack(null);
            logout();
          }}
          type="button"
        >
          Disconnect
        </button>
      </div>
      <GalleryFilters
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
      />
      <GalleryScene
        items={galleryItems}
        facetsByKey={facetsByKey}
        layoutMode={layoutMode}
        activeItemId={currentTrack?.id ?? null}
        onItemClick={(item) => {
          handleItemClick(item);
        }}
      />
      {currentTrack?.spotifyTrackUri ? (
        <SpotifyEmbedPlayer
          title={currentTrack.title ?? "Selected track"}
          trackUri={currentTrack.spotifyTrackUri}
        />
      ) : null}
    </div>
  );
}

export default App;
