import type { LayoutMode } from "../GalleryScene";
import "./gallery_filters.css";

export type GalleryFiltersProps = {
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
  isAiEnriching: boolean;
};

const BASIC_FILTERS: { mode: LayoutMode; label: string }[] = [
  { mode: "trackName", label: "Track Name" },
  { mode: "addedAt", label: "Date Added" },
  { mode: "releaseYear", label: "Release Year" },
];

const AI_FILTERS: { mode: LayoutMode; label: string }[] = [
  { mode: "genre", label: "Genre" },
  { mode: "country", label: "Country" },
  { mode: "bpm", label: "Speed" },
];

export function GalleryFilters({
  layoutMode,
  onLayoutModeChange,
  isAiEnriching,
}: GalleryFiltersProps) {
  return (
    <aside className="filter-sidebar">
      <span className="filter-sidebar__label">View</span>
      {BASIC_FILTERS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          className={`filter-sidebar__btn ${layoutMode === mode ? "is-active" : ""}`}
          onClick={() => onLayoutModeChange(mode)}
        >
          {label}
        </button>
      ))}
      {AI_FILTERS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          className={`filter-sidebar__btn ${layoutMode === mode ? "is-active" : ""} ${isAiEnriching ? "is-loading" : ""}`}
          disabled={isAiEnriching}
          onClick={() => onLayoutModeChange(mode)}
        >
          {label}
        </button>
      ))}
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
