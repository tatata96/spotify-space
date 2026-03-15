import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { GalleryItem } from "./GalleryItem";
import { type GalleryItem as GalleryItemData } from "@/types/types";

type SceneItemMeta = {
  x: number;
  y: number;
  baseZ: number;
  sizeClass: string;
};

type SceneLabelMeta = {
  key: string;
  title: string;
  x: number;
  y: number;
};

type SceneLayout = {
  items: SceneItemMeta[];
  labels: SceneLabelMeta[];
};

const SIZE_CLASSES = ["block--small", "block--medium", "block--large"] as const;
const CLUSTER_SIZE_CLASS = "block--small";

export type LayoutMode = "category" | "id" | "initial";

export type GallerySceneProps = {
  items: GalleryItemData[];
  layoutMode: LayoutMode;
  onItemClick?: (item: GalleryItemData) => void;
};

const PAN_SPEED = 0.8;
const ZOOM_SPEED = 80;
const MIN_CAMERA_Z = -20000;
const MAX_CAMERA_Z = 35000;
const LAYOUT_ANIMATION_DURATION = 0.95;
const CAMERA_ANIMATION_DURATION = 0.25;

export function GalleryScene({
  items,
  layoutMode,
  onItemClick,
}: GallerySceneProps) {
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const cameraXRef = useRef(0);
  const cameraYRef = useRef(0);
  const cameraZRef = useRef(4000);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === "undefined" ? 1440 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
  }));

  const initialLayout = useMemo(() => {
    if (typeof window === "undefined") return [];
    console.log(items)
    return createInitialLayout(items, viewportSize);
  }, [items, viewportSize]);

  const sceneLayout = useMemo(() => {
    return createSceneLayout(items, initialLayout, layoutMode);
  }, [initialLayout, items, layoutMode]);

  const sceneLayoutRef = useRef(sceneLayout);

  function updateScene(duration: number) {
    const gallery = galleryRef.current;
    const layout = sceneLayoutRef.current;
    if (!gallery) return;

    layout.items.forEach((sceneItem, index) => {
      const element = itemRefs.current[index];
      if (!element) return;

      const relativeZ = sceneItem.baseZ - cameraZRef.current;

      gsap.to(element, {
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

      gsap.to(element, {
        duration,
        x: label.x,
        y: label.y,
        autoAlpha: 1,
        ease: "power3.inOut",
        overwrite: "auto",
      });
    });

    gsap.to(gallery, {
      duration: CAMERA_ANIMATION_DURATION,
      x: cameraXRef.current,
      y: cameraYRef.current,
      ease: "power2.out",
      overwrite: "auto",
    });
  }

  useEffect(() => {
    function handleResize() {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;

    function handleWheel(event: WheelEvent) {
      const isPinch = event.ctrlKey;

      event.preventDefault();

      if (isPinch) {
        cameraZRef.current += event.deltaY * ZOOM_SPEED;

        // to prevent the camera from going out of bounds while zooming
        cameraZRef.current = gsap.utils.clamp(
          MIN_CAMERA_Z,
          MAX_CAMERA_Z,
          cameraZRef.current
        );
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
  }, []);

  useEffect(() => {
    sceneLayoutRef.current = sceneLayout;
    updateScene(LAYOUT_ANIMATION_DURATION);
  }, [sceneLayout]);

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

function randomFromArray<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function createInitialLayout(
  items: GalleryItemData[],
  viewportSize: { width: number; height: number }
): SceneItemMeta[] {
  const centerX = viewportSize.width / 2;
  const centerY = viewportSize.height / 2;
  const maxRadius = 900;

  return items.map(() => {
    const point = createScatterPoint(centerX, centerY, maxRadius, 40);

    return {
      x: point.x,
      y: point.y,
      baseZ: gsap.utils.random(-4000, 800),
      sizeClass: randomFromArray(SIZE_CLASSES),
    };
  });
}

function createSceneLayout(
  items: GalleryItemData[],
  initialLayout: SceneItemMeta[],
  layoutMode: LayoutMode
): SceneLayout {
  if (layoutMode === "category") {
    return createClusterLayout({
      items,
      initialLayout,
      groupKey: (item) => item.category?.trim() || "Uncategorized",
      labelTitle: (group) => group.toUpperCase(),
      topStart: 140,
      clusterCenterX: 176,
      clusterCenterOffsetY: 20,
      labelGapX: 8,
      labelOffsetY: -10,
      clusterGapY: 120,
      rowHeight: 182,
      clusterRadius: 56,
    });
  }

  if (layoutMode === "id") {
    return createClusterLayout({
      items,
      initialLayout,
      sortItems: (sceneItems) =>
        [...sceneItems].sort((first, second) => Number(first.id) - Number(second.id)),
      groupKey: (item) => {
        const bucketStart = Math.floor((Number(item.id) - 1) / 25) * 25 + 1;
        const bucketEnd = bucketStart + 24;

        return `${String(bucketStart).padStart(3, "0")}-${String(bucketEnd).padStart(3, "0")}`;
      },
      labelTitle: (group) => group,
      topStart: 120,
      clusterCenterX: 188,
      clusterCenterOffsetY: 28,
      labelGapX: 8,
      labelOffsetY: -10,
      clusterGapY: 112,
      rowHeight: 192,
      clusterRadius: 74,
    });
  }

  return {
    items: initialLayout,
    labels: [],
  };
}

type ClusterLayoutOptions = {
  items: GalleryItemData[];
  initialLayout: SceneItemMeta[];
  groupKey: (item: GalleryItemData) => string;
  labelTitle: (group: string) => string;
  topStart: number;
  labelGapX: number;
  labelOffsetY: number;
  clusterGapY: number;
  rowHeight: number;
  clusterRadius: number;
  clusterCenterX: number;
  clusterCenterOffsetY: number;
  sortItems?: (items: GalleryItemData[]) => GalleryItemData[];
};

function createClusterLayout({
  items,
  initialLayout,
  groupKey,
  labelTitle,
  topStart,
  labelGapX,
  labelOffsetY,
  clusterGapY,
  rowHeight,
  clusterRadius,
  clusterCenterX,
  clusterCenterOffsetY,
  sortItems,
}: ClusterLayoutOptions): SceneLayout {
  const groupOrder: string[] = [];
  const groups = new Map<string, number[]>();
  const itemIndexById = new Map(items.map((item, index) => [item.id, index]));
  const orderedItems = sortItems ? sortItems(items) : items;

  orderedItems.forEach((item) => {
    const key = groupKey(item);
    const index = itemIndexById.get(item.id);
    if (index === undefined) return;

    if (!groups.has(key)) {
      groups.set(key, []);
      groupOrder.push(key);
    }

    groups.get(key)?.push(index);
  });

  const layoutItems = [...initialLayout];
  const labels: SceneLabelMeta[] = [];

  let currentY = topStart;

  groupOrder.forEach((key) => {
    const groupIndexes = groups.get(key) ?? [];
    const clusterCenterY = currentY + clusterCenterOffsetY;
    const points = groupIndexes.map(() =>
      createScatterPoint(clusterCenterX, clusterCenterY, clusterRadius, 10)
    );

    const maxX = Math.max(...points.map((point) => point.x));
    const averageY =
      points.reduce((total, point) => total + point.y, 0) / points.length;

    labels.push({
      key,
      title: labelTitle(key),
      x: maxX + labelGapX,
      y: averageY + labelOffsetY,
    });

    groupIndexes.forEach((itemIndex, groupIndex) => {
      const point = points[groupIndex];

      layoutItems[itemIndex] = {
        ...initialLayout[itemIndex],
        x: point.x,
        y: point.y,
        baseZ: -200 - groupIndex * 2,
        sizeClass: CLUSTER_SIZE_CLASS,
      };
    });

    currentY += rowHeight + clusterGapY;
  });

  return {
    items: layoutItems,
    labels,
  };
}

function createScatterPoint(
  centerX: number,
  centerY: number,
  radius: number,
  jitter: number
) {
  const angle = gsap.utils.random(0, Math.PI * 2);
  const distance = radius * Math.sqrt(gsap.utils.random(0, 1));
  const jitterX = gsap.utils.random(-jitter, jitter);
  const jitterY = gsap.utils.random(-jitter, jitter);

  return {
    x: centerX + Math.cos(angle) * distance + jitterX,
    y: centerY + Math.sin(angle) * distance + jitterY,
  };
}
