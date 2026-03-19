import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import type { LayoutMode, SceneLayout } from "./gallerySceneLayout";

const ZOOM_SPEED = 6;
const PAN_SPEED = 0.8;
const MIN_CAMERA_Z = -20000;
const MAX_CAMERA_Z = 35000;
const MIN_CLUSTER_CAMERA_Z = 1500;
const MAX_CLUSTER_CAMERA_Z = 15000;
const LAYOUT_ANIMATION_DURATION = 0.95;
const CAMERA_ANIMATION_DURATION = 0.25;

export function useScenePanZoom(
  galleryRef: React.RefObject<HTMLDivElement | null>,
  itemRefs: React.RefObject<(HTMLButtonElement | null)[]>,
  labelRefs: React.RefObject<(HTMLDivElement | null)[]>,
  sceneLayout: SceneLayout,
  layoutMode: LayoutMode,
  viewportSize: { width: number; height: number }
) {
  const [activeClusterKey, setActiveClusterKey] = useState<string | null>(null);
  const [clusterScrollProgress, setClusterScrollProgress] = useState(0);
  const cameraXRef = useRef(0);
  const cameraYRef = useRef(0);
  const cameraZRef = useRef(4000);
  const activeClusterKeyRef = useRef<string | null>(null);
  const activeClusterFrameRef = useRef<number | null>(null);
  const clusterScrollProgressRef = useRef(0);
  const sceneLayoutRef = useRef(sceneLayout);
  const lastLayoutModeRef = useRef<LayoutMode>(layoutMode);
  const layoutModeRef = useRef<LayoutMode>(layoutMode);

  const updateActiveClusterKey = useCallback((nextKey: string | null) => {
    if (activeClusterKeyRef.current === nextKey) return;

    activeClusterKeyRef.current = nextKey;

    if (activeClusterFrameRef.current !== null) {
      cancelAnimationFrame(activeClusterFrameRef.current);
    }

    activeClusterFrameRef.current = requestAnimationFrame(() => {
      activeClusterFrameRef.current = null;
      setActiveClusterKey(nextKey);
    });
  }, []);

  const updateClusterScrollProgress = useCallback((nextProgress: number) => {
    const clampedProgress = gsap.utils.clamp(0, 1, nextProgress);
    if (Math.abs(clusterScrollProgressRef.current - clampedProgress) < 0.001) return;

    clusterScrollProgressRef.current = clampedProgress;

    requestAnimationFrame(() => {
      setClusterScrollProgress(clampedProgress);
    });
  }, []);

  const updateScene = useCallback((duration: number) => {
    const gallery = galleryRef.current;
    const layout = sceneLayoutRef.current;
    if (!gallery) return;
    const applyTransform = duration === 0 ? gsap.set : gsap.to;

    layout.items.forEach((sceneItem, index) => {
      const element = itemRefs.current[index];
      if (!element) return;

      const relativeZ = sceneItem.baseZ - cameraZRef.current;

      applyTransform(element, {
        duration,
        x: sceneItem.x,
        y: sceneItem.y,
        z: relativeZ,
        ease: "power3.inOut",
        overwrite: "auto",
      });
    });

    layout.labels.forEach((label, index) => {
      const element = labelRefs.current[index];
      if (!element) return;

      const relativeZ = label.baseZ - cameraZRef.current;
      applyTransform(element, {
        duration,
        x: label.x,
        y: label.y,
        z: relativeZ,
        yPercent: -50,
        autoAlpha: 1,
        ease: "power3.inOut",
        overwrite: "auto",
      });
    });

    applyTransform(gallery, {
      duration: duration === 0 ? 0 : CAMERA_ANIMATION_DURATION,
      x: cameraXRef.current,
      y: cameraYRef.current,
      ease: "power2.out",
      overwrite: "auto",
    });

    if (layoutModeRef.current === "initial" || layout.labels.length === 0) {
      updateActiveClusterKey(null);
      updateClusterScrollProgress(0);
      return;
    }

    const sortedLabels = [...layout.labels].sort((first, second) => first.y - second.y);
    const viewportCenterY = viewportSize.height / 2 - cameraYRef.current;
    let closestLabel = sortedLabels[0];
    let closestDistance = Math.abs(closestLabel.y - viewportCenterY);

    sortedLabels.forEach((label) => {
      const distance = Math.abs(label.y - viewportCenterY);
      if (distance < closestDistance) {
        closestLabel = label;
        closestDistance = distance;
      }
    });

    let nextProgress = 0;
    if (sortedLabels.length > 1) {
      if (viewportCenterY <= sortedLabels[0].y) {
        nextProgress = 0;
      } else if (viewportCenterY >= sortedLabels[sortedLabels.length - 1].y) {
        nextProgress = 1;
      } else {
        for (let index = 0; index < sortedLabels.length - 1; index += 1) {
          const currentLabel = sortedLabels[index];
          const nextLabel = sortedLabels[index + 1];
          if (viewportCenterY >= currentLabel.y && viewportCenterY <= nextLabel.y) {
            const segmentProgress =
              (viewportCenterY - currentLabel.y) / Math.max(1, nextLabel.y - currentLabel.y);
            nextProgress = (index + segmentProgress) / (sortedLabels.length - 1);
            break;
          }
        }
      }
    }

    updateActiveClusterKey(closestLabel.key);
    updateClusterScrollProgress(nextProgress);
  }, [
    galleryRef,
    itemRefs,
    labelRefs,
    updateActiveClusterKey,
    updateClusterScrollProgress,
    viewportSize.height,
  ]);

  const focusCluster = useCallback((clusterKey: string) => {
    const layout = sceneLayoutRef.current;
    const targetLabel = layout.labels.find((label) => label.key === clusterKey);
    if (!targetLabel) return;

    cameraYRef.current = viewportSize.height / 2 - targetLabel.y;
    updateScene(CAMERA_ANIMATION_DURATION);
  }, [updateScene, viewportSize.height]);

  const frameLayout = useCallback((mode: LayoutMode) => {
    const layout = sceneLayoutRef.current;
    if (layout.items.length === 0) return;

    const sizeByClass: Record<string, number> = {
      "block--small": 36,
      "block--medium": 60,
      "block--large": 88,
    };

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    layout.items.forEach((item) => {
      const size = sizeByClass[item.sizeClass] ?? 36;
      const half = size / 2;
      minX = Math.min(minX, item.x - half);
      maxX = Math.max(maxX, item.x + half);
      minY = Math.min(minY, item.y - half);
      maxY = Math.max(maxY, item.y + half);
    });

    layout.labels.forEach((label) => {
      minX = Math.min(minX, label.x);
      maxX = Math.max(maxX, label.x);
      minY = Math.min(minY, label.y);
      maxY = Math.max(maxY, label.y);
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;

    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    cameraXRef.current = viewportSize.width / 2 - contentCenterX;
    cameraYRef.current = viewportSize.height / 2 - contentCenterY;

    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const span = Math.max(spanX, spanY);

    // Heuristic: bigger layouts start slightly farther away.
    const targetCameraZ =
      mode === "initial"
        ? 4000
        : gsap.utils.clamp(
            MIN_CLUSTER_CAMERA_Z,
            MAX_CLUSTER_CAMERA_Z,
            2000 + span * 6
          );

    cameraZRef.current = targetCameraZ;
  }, [viewportSize.height, viewportSize.width]);

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;

    function handleWheel(event: WheelEvent) {
      const isPinch = event.ctrlKey;

      event.preventDefault();

      if (isPinch) {
        console.log("cameraZ", cameraZRef.current);

        const rawDelta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? event.deltaY * window.innerHeight : event.deltaY; 
        cameraZRef.current += rawDelta * ZOOM_SPEED;
    

        const isClusterMode = layoutModeRef.current !== "initial";
        cameraZRef.current = gsap.utils.clamp(
          isClusterMode ? MIN_CLUSTER_CAMERA_Z : MIN_CAMERA_Z,
          isClusterMode ? MAX_CLUSTER_CAMERA_Z : MAX_CAMERA_Z,
          cameraZRef.current
        );

        updateScene(0);
        return;
      } else {
        cameraXRef.current -= event.deltaX * PAN_SPEED;
        cameraYRef.current -= event.deltaY * PAN_SPEED;
      }

      updateScene(CAMERA_ANIMATION_DURATION);
    }

    updateScene(0);

    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, [galleryRef, itemRefs, labelRefs, updateScene]);

  useEffect(() => {
    sceneLayoutRef.current = sceneLayout;
    const isLayoutModeChange = lastLayoutModeRef.current !== layoutMode;
    lastLayoutModeRef.current = layoutMode;
    layoutModeRef.current = layoutMode;

    if (isLayoutModeChange) {
      frameLayout(layoutMode);
    }

    updateScene(LAYOUT_ANIMATION_DURATION);
  }, [sceneLayout, layoutMode, viewportSize, frameLayout, updateScene]);

  useEffect(() => {
    return () => {
      if (activeClusterFrameRef.current !== null) {
        cancelAnimationFrame(activeClusterFrameRef.current);
      }
    };
  }, []);

  return {
    activeClusterKey,
    clusterScrollProgress,
    focusCluster,
  };
}
