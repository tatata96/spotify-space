import "./App.css";
import { useState } from "react";
import { GalleryScene, type LayoutMode } from "@/components/gallery-scene/GalleryScene";
import { GalleryFilters } from "@/components/gallery-scene/filters/GalleryFilters";
import { SpotifyLoginScreen } from "@/components/auth/SpotifyLoginScreen";
import { GALLERY_ITEMS } from "@/data/galleryItems";
import { useSpotifyAuth } from "@/hooks/useSpotifyAuth";
import { useSpotifyLikedSongs } from "@/api/spotify";

function App() {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("initial");
  const { errorMessage, isLoading, login, logout, scope, tokens } = useSpotifyAuth();
  const isSignedIn = Boolean(tokens);
  const { data: likedSongsResponse, error: likedSongsError, isLoading: isLikedSongsLoading } =
    useSpotifyLikedSongs({ enabled: isSignedIn, limit: 20, offset: 0 });
  const likedSongs = likedSongsResponse?.items ?? [];

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

  return (
    <div className="app-shell">
      <div className="app-shell__auth-indicator">
        <span>Spotify connected</span>
        {isLikedSongsLoading ? <span>Loading liked songs...</span> : null}
        {likedSongsError ? <span>{likedSongsError.message}</span> : null}
        {!isLikedSongsLoading && !likedSongsError ? <span>{likedSongs.length} liked songs loaded</span> : null}
        <button onClick={logout} type="button">
          Disconnect
        </button>
      </div>
      <GalleryFilters
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
      />
      <GalleryScene
        items={GALLERY_ITEMS}
        layoutMode={layoutMode}
        onItemClick={(item) => {
          console.log("Clicked item:", item);
        }}
      />
    </div>
  );
}

export default App;
