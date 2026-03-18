import { useMemo } from "react";
import {
  createInitialLayout,
  createSceneLayout,
  type LayoutMode,
  type SceneLayout,
} from "./gallerySceneLayout";
import type { GalleryItem as GalleryItemData } from "@/types/types";

export function useGallerySceneLayout(
  items: GalleryItemData[],
  layoutMode: LayoutMode,
  viewportSize: { width: number; height: number }
): SceneLayout {
  const initialLayout = useMemo(() => {
    if (typeof window === "undefined") return [];
    return createInitialLayout(items, viewportSize);
  }, [items, viewportSize]);

  const sceneLayout = useMemo(() => {
    return createSceneLayout(items, initialLayout, layoutMode, viewportSize);
  }, [items, initialLayout, layoutMode, viewportSize]);

  return sceneLayout;
}
