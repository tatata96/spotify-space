import { useRef } from "react";
import { GalleryItem } from "./GalleryItem";
import { type GalleryItem as GalleryItemData } from "@/types/types";
import { useViewportSize } from "./helper/useViewportSize";
import { useGallerySceneLayout } from "./helper/useGallerySceneLayout";
import { useScenePanZoom } from "./helper/useScenePanZoom";
import type { LayoutMode } from "./helper/gallerySceneLayout";

export type { LayoutMode };

export type GallerySceneProps = {
  items: GalleryItemData[];
  layoutMode: LayoutMode;
  onItemClick?: (item: GalleryItemData) => void;
};

export function GalleryScene({
  items,
  layoutMode,
  onItemClick,
}: GallerySceneProps) {
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const viewportSize = useViewportSize();
  const sceneLayout = useGallerySceneLayout(items, layoutMode, viewportSize);

  useScenePanZoom(galleryRef, itemRefs, labelRefs, sceneLayout, layoutMode, viewportSize);

  return (
    <div className="scene">
      <div ref={galleryRef} className="gallery">
        {sceneLayout.labels.map((label, index) => (
          <div
            key={label.key}
            ref={(element) => {
              labelRefs.current[index] = element;
            }}
            className="cluster-label"
          >
            {label.title}
          </div>
        ))}
        {items.map((item, index) => (
          <GalleryItem
            key={item.id}
            item={item}
            sizeClass={sceneLayout.items[index]?.sizeClass ?? "block--small"}
            onClick={onItemClick}
            itemRef={(element) => {
              itemRefs.current[index] = element;
            }}
          />
        ))}
      </div>
    </div>
  );
}
