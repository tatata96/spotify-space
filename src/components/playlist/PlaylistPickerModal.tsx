import { useEffect, useState } from "react";
import { getUserPlaylists, createPlaylist, type SpotifyPlaylist } from "@/api/spotify";
import "./playlist.css";

type PlaylistPickerModalProps = {
  onSelect: (playlist: SpotifyPlaylist) => void;
  onClose: () => void;
};

type View = "list" | "create";

export function PlaylistPickerModal({ onSelect, onClose }: PlaylistPickerModalProps) {
  const [view, setView] = useState<View>("list");
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getUserPlaylists()
      .then((res) => {
        if (!cancelled) setPlaylists(res.items);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load playlists.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const playlist = await createPlaylist(newName.trim(), newDescription.trim() || undefined);
      onSelect(playlist);
    } catch {
      setCreateError("Failed to create playlist. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="playlist-modal-overlay" onClick={onClose}>
      <div className="playlist-modal" onClick={(e) => e.stopPropagation()}>
        {view === "list" ? (
          <>
            <h2 className="playlist-modal__title">Add to playlist</h2>

            <button
              type="button"
              className="playlist-modal__create-row"
              onClick={() => setView("create")}
            >
              <span className="playlist-modal__create-icon">+</span>
              <span>Create new playlist</span>
            </button>

            {isLoading ? (
              <p className="playlist-modal__status">Loading playlists…</p>
            ) : error ? (
              <p className="playlist-modal__status playlist-modal__status--error">{error}</p>
            ) : (
              <ul className="playlist-modal__list">
                {playlists.map((playlist) => (
                  <li key={playlist.id}>
                    <button
                      type="button"
                      className="playlist-modal__item"
                      onClick={() => onSelect(playlist)}
                    >
                      {playlist.images?.[0] ? (
                        <img
                          className="playlist-modal__item-img"
                          src={playlist.images[0].url}
                          alt=""
                        />
                      ) : (
                        <div className="playlist-modal__item-img playlist-modal__item-img--placeholder" />
                      )}
                      <div className="playlist-modal__item-info">
                        <span className="playlist-modal__item-name">{playlist.name}</span>
                        <span className="playlist-modal__item-count">{playlist.tracks?.total ?? 0} tracks</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button type="button" className="playlist-modal__cancel" onClick={onClose}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <h2 className="playlist-modal__title">New playlist</h2>

            <div className="playlist-modal__form">
              <input
                className="playlist-modal__input"
                type="text"
                placeholder="Playlist name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <textarea
                className="playlist-modal__input playlist-modal__textarea"
                placeholder="Description (optional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
              {createError ? (
                <p className="playlist-modal__status playlist-modal__status--error">{createError}</p>
              ) : null}
            </div>

            <div className="playlist-modal__actions">
              <button
                type="button"
                className="playlist-modal__cancel"
                onClick={() => setView("list")}
                disabled={isCreating}
              >
                Back
              </button>
              <button
                type="button"
                className="playlist-modal__confirm"
                onClick={handleCreate}
                disabled={isCreating || !newName.trim()}
              >
                {isCreating ? "Creating…" : "Create"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
