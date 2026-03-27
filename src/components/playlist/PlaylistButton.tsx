import "./playlist.css";

type PlaylistButtonProps = {
  isActive: boolean;
  onClick: () => void;
};

export function PlaylistButton({ isActive, onClick }: PlaylistButtonProps) {
  return (
    <button
      type="button"
      className={`playlist-btn${isActive ? " playlist-btn--active" : ""}`}
      onClick={onClick}
    >
      {isActive ? "Done" : "Create Playlist"}
    </button>
  );
}
