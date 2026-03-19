import { useMemo, useRef } from "react";
import { GalleryItem } from "./GalleryItem";
import {
  SceneClusterScrollbar,
  type SceneClusterScrollbarItem,
} from "./scrollbar/SceneClusterScrollbar";
import {
  type GalleryItem as GalleryItemData,
  type GalleryItemFacetsByKey,
} from "@/types/types";
import { useViewportSize } from "./helper/useViewportSize";
import { useGallerySceneLayout } from "./helper/useGallerySceneLayout";
import { useScenePanZoom } from "./helper/useScenePanZoom";
import type { LayoutMode } from "./helper/gallerySceneLayout";

export type { LayoutMode };

export type GallerySceneProps = {
  items: GalleryItemData[];
  facetsByKey: GalleryItemFacetsByKey;
  layoutMode: LayoutMode;
  activeItemId?: string | null;
  onItemClick?: (item: GalleryItemData) => void;
};

export function GalleryScene({
  items,
  facetsByKey,
  layoutMode,
  activeItemId,
  onItemClick,
}: GallerySceneProps) {
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const viewportSize = useViewportSize();
  const sceneLayout = useGallerySceneLayout(items, facetsByKey, layoutMode, viewportSize);
  const isClusterMode = layoutMode !== "initial";
  const clusterScrollbarItems = useMemo<SceneClusterScrollbarItem[]>(
    () =>
      [...sceneLayout.labels]
        .sort((first, second) => first.y - second.y)
        .map((label) => ({
          key: label.key,
          title: label.title,
        })),
    [sceneLayout.labels]
  );

  const { activeClusterKey, clusterScrollProgress, focusCluster } = useScenePanZoom(
    galleryRef,
    itemRefs,
    labelRefs,
    sceneLayout,
    layoutMode,
    viewportSize
  );

  return (
    <div className="scene">
      {isClusterMode ? (
        <SceneClusterScrollbar
          items={clusterScrollbarItems}
          activeKey={activeClusterKey}
          progress={clusterScrollProgress}
          onSelect={focusCluster}
        />
      ) : null}
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
            isActive={item.id === activeItemId}
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
