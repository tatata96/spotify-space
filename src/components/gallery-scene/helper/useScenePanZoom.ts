import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import type { LayoutMode, SceneLayout } from "./gallerySceneLayout";

const PAN_SPEED = 0.8;
const ZOOM_SENSITIVITY = 0.015;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const PERSPECTIVE = 1500;
const LAYOUT_ANIMATION_DURATION = 0.95;
const CAMERA_ANIMATION_DURATION = 0.25;

export function useScenePanZoom(
  galleryRef: React.RefObject<HTMLDivElement | null>,
  itemRefs: React.RefObject<(HTMLButtonElement | null)[]>,
  labelRefs: React.RefObject<(HTMLDivElement | null)[]>,
  sceneLayout: SceneLayout,
  layoutMode: LayoutMode,
  viewportSize: { width: number; height: number },
  disabled = false
) {
  const [activeClusterKey, setActiveClusterKey] = useState<string | null>(null);
  const [clusterScrollProgress, setClusterScrollProgress] = useState(0);
  const cameraXRef = useRef(0);
  const cameraYRef = useRef(0);
  const zoomRef = useRef(1);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const activeClusterKeyRef = useRef<string | null>(null);
  const activeClusterFrameRef = useRef<number | null>(null);
  const clusterScrollProgressRef = useRef(0);
  const sceneLayoutRef = useRef(sceneLayout);
  const lastLayoutModeRef = useRef<LayoutMode>(layoutMode);
  const layoutModeRef = useRef<LayoutMode>(layoutMode);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

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

    const vwCenter = viewportSize.width / 2;
    const vhCenter = viewportSize.height / 2;
    const zoom = zoomRef.current;
    const camX = cameraXRef.current;
    const camY = cameraYRef.current;

    // Each item is positioned directly in viewport space — no CSS 3D preserve-3d needed.
    // Formula matches what CSS perspective(PERSPECTIVE) + translateZ(baseZ) would produce,
    // but uses plain 2D transforms so pointer events are always reliable.
    //
    // depthScale = PERSPECTIVE / (PERSPECTIVE - baseZ)  (same as CSS perspective projection)
    // screenX    = (contentX - vwCenter) * zoom * depthScale + camX * depthScale + vwCenter
    //
    // The camX * depthScale term gives parallax: closer items shift more on pan.

    layout.items.forEach((sceneItem, index) => {
      const element = itemRefs.current[index];
      if (!element) return;

      const depthScale = PERSPECTIVE / Math.max(1, PERSPECTIVE - sceneItem.baseZ);
      const itemScale = zoom * depthScale;

      applyTransform(element, {
        duration,
        x: (sceneItem.x - vwCenter) * itemScale + camX * depthScale + vwCenter,
        y: (sceneItem.y - vhCenter) * itemScale + camY * depthScale + vhCenter,
        scale: itemScale,
        ease: "power3.inOut",
        overwrite: "auto",
      });
    });

    layout.labels.forEach((label, index) => {
      const element = labelRefs.current[index];
      if (!element) return;

      const depthScale = PERSPECTIVE / Math.max(1, PERSPECTIVE - label.baseZ);
      const labelScale = zoom * depthScale;

      applyTransform(element, {
        duration,
        x: (label.x - vwCenter) * labelScale + camX * depthScale + vwCenter,
        y: (label.y - vhCenter) * labelScale + camY * depthScale + vhCenter,
        scale: labelScale,
        yPercent: -50,
        autoAlpha: 1,
        ease: "power3.inOut",
        overwrite: "auto",
      });
    });

    // Gallery is just a DOM container — clear any stale GSAP transforms.
    gsap.set(gallery, { x: 0, y: 0, scale: 1 });

    if (layoutModeRef.current === "initial" || layout.labels.length === 0) {
      updateActiveClusterKey(null);
      updateClusterScrollProgress(0);
      return;
    }

    // Content-space Y at the viewport center.
    // From: 0 = (content_y - vhCenter) * zoom + camY  →  content_y = vhCenter - camY / zoom
    const sortedLabels = [...layout.labels].sort((first, second) => first.y - second.y);
    const viewportCenterY = vhCenter - camY / zoom;
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
    viewportSize.width,
    viewportSize.height,
  ]);

  const focusCluster = useCallback((clusterKey: string) => {
    const layout = sceneLayoutRef.current;
    const targetLabel = layout.labels.find((label) => label.key === clusterKey);
    if (!targetLabel) return;

    // To center label.y at viewport: content_y = vhCenter - camY/zoom → camY = (vhCenter - label.y) * zoom
    cameraYRef.current = (viewportSize.height / 2 - targetLabel.y) * zoomRef.current;
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

    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);

    if (mode === "initial") {
      zoomRef.current = 1;
    } else {
      const fitScale =
        Math.min(viewportSize.width / spanX, viewportSize.height / spanY) * 0.8;
      zoomRef.current = gsap.utils.clamp(MIN_ZOOM, MAX_ZOOM, fitScale);
    }

    // Camera so content center lands at viewport center.
    // From: content_x = vwCenter - camX/zoom → camX = (vwCenter - content_x) * zoom
    cameraXRef.current = (viewportSize.width / 2 - contentCenterX) * zoomRef.current;
    cameraYRef.current = (viewportSize.height / 2 - contentCenterY) * zoomRef.current;
  }, [viewportSize.height, viewportSize.width]);

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;

    function handleWheel(event: WheelEvent) {
      if (disabledRef.current) return;
      const isPinch = event.ctrlKey;

      event.preventDefault();

      if (isPinch) {
        const deltaMultiplier =
          event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? 16
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
              ? window.innerHeight
              : 1;

        const delta = event.deltaY * deltaMultiplier;
        const oldZoom = zoomRef.current;
        const newZoom = gsap.utils.clamp(
          MIN_ZOOM,
          MAX_ZOOM,
          oldZoom * (1 - delta * ZOOM_SENSITIVITY)
        );
        const ratio = newZoom / oldZoom;

        // Zoom toward mouse: keep content point under cursor fixed.
        // Derived for depthScale=1 (z=0 reference plane) — correct for the overall scene.
        const ox = window.innerWidth / 2;
        const oy = window.innerHeight / 2;
        const mx = mousePosRef.current.x;
        const my = mousePosRef.current.y;

        cameraXRef.current = cameraXRef.current * ratio + (mx - ox) * (1 - ratio);
        cameraYRef.current = cameraYRef.current * ratio + (my - oy) * (1 - ratio);
        zoomRef.current = newZoom;

        updateScene(0);
        return;
      }

      cameraXRef.current -= event.deltaX * PAN_SPEED;
      cameraYRef.current -= event.deltaY * PAN_SPEED;

      updateScene(CAMERA_ANIMATION_DURATION);
    }

    function handleMouseMove(event: MouseEvent) {
      mousePosRef.current = { x: event.clientX, y: event.clientY };
    }

    updateScene(0);

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mousemove", handleMouseMove);
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
