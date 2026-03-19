type SpotifyLoginScreenProps = {
  errorMessage: string | null;
  isLoading: boolean;
  isSignedIn: boolean;
  onLogin: () => Promise<void>;
  onLogout: () => void;
  scope: string;
};

export function SpotifyLoginScreen({
  errorMessage,
  isLoading,
  isSignedIn,
  onLogin,
  onLogout,
  scope,
}: SpotifyLoginScreenProps) {
  return (
    <main className="spotify-auth-screen">
      <div className="spotify-auth-screen__glow spotify-auth-screen__glow--left" />
      <div className="spotify-auth-screen__glow spotify-auth-screen__glow--right" />

      <section className="spotify-auth-card">
        <p className="spotify-auth-card__eyebrow">Spotify Space</p>
        <h1 className="spotify-auth-card__title">Sign in to load your liked songs.</h1>
        <p className="spotify-auth-card__copy">
          This app uses Spotify Authorization Code with PKCE and requests the
          <code> {scope} </code>
          scope.
        </p>

        {errorMessage ? (
          <p className="spotify-auth-card__status spotify-auth-card__status--error">{errorMessage}</p>
        ) : null}

        {isSignedIn ? (
          <>
            <p className="spotify-auth-card__status spotify-auth-card__status--success">
              Spotify account connected. The gallery is ready for liked-song data.
            </p>
            <button className="spotify-auth-card__secondary-action" onClick={onLogout} type="button">
              Disconnect
            </button>
          </>
        ) : (
          <button
            className="spotify-auth-card__primary-action"
            disabled={isLoading}
            onClick={() => {
              void onLogin();
            }}
            type="button"
          >
            {isLoading ? "Checking Spotify session..." : "Continue with Spotify"}
          </button>
        )}
      </section>
    </main>
  );
}
