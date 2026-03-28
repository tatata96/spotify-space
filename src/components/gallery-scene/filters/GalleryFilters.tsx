import type { LayoutMode } from "../GalleryScene";
import "./gallery_filters.css";

export type GalleryFiltersProps = {
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
  isAiEnriching: boolean;
};

export function GalleryFilters({
  layoutMode,
  onLayoutModeChange,
  isAiEnriching,
}: GalleryFiltersProps) {
  return (
    <aside className="filter-sidebar">
      <span className="filter-sidebar__label">View</span>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "trackName" ? "is-active" : ""}`}
        onClick={() => onLayoutModeChange("trackName")}
      >
        Track Name
      </button>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "addedAt" ? "is-active" : ""}`}
        onClick={() => onLayoutModeChange("addedAt")}
      >
        Date Added
      </button>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "releaseYear" ? "is-active" : ""}`}
        onClick={() => onLayoutModeChange("releaseYear")}
      >
        Release Year
      </button>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "genre" ? "is-active" : ""} ${isAiEnriching ? "is-loading" : ""}`}
        disabled={isAiEnriching}
        onClick={() => onLayoutModeChange("genre")}
      >
        Genre
      </button>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "country" ? "is-active" : ""} ${isAiEnriching ? "is-loading" : ""}`}
        disabled={isAiEnriching}
        onClick={() => onLayoutModeChange("country")}
      >
        Country
      </button>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "bpm" ? "is-active" : ""} ${isAiEnriching ? "is-loading" : ""}`}
        disabled={isAiEnriching}
        onClick={() => onLayoutModeChange("bpm")}
      >
        Speed
      </button>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "initial" ? "is-active" : ""}`}
        onClick={() => onLayoutModeChange("initial")}
      >
        Initial
      </button>
    </aside>
  );
}
