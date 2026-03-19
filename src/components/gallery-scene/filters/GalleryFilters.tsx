import type { LayoutMode } from "../GalleryScene";
import "./gallery_filters.css";

export type GalleryFiltersProps = {
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
};

export function GalleryFilters({
  layoutMode,
  onLayoutModeChange,
}: GalleryFiltersProps) {
  return (
    <aside className="filter-sidebar">
      <span className="filter-sidebar__label">View</span>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "category" ? "is-active" : ""}`}
        onClick={() => onLayoutModeChange("category")}
      >
        Category
      </button>
      <button
        type="button"
        className={`filter-sidebar__btn ${layoutMode === "id" ? "is-active" : ""}`}
        onClick={() => onLayoutModeChange("id")}
      >
        Id
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
