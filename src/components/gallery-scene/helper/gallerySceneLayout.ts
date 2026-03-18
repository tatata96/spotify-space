import { gsap } from "gsap";
import { type GalleryItem as GalleryItemData } from "@/types/types";

export type SceneItemMeta = {
  x: number;
  y: number;
  baseZ: number;
  sizeClass: string;
};

export type SceneLabelMeta = {
  key: string;
  title: string;
  x: number;
  y: number;
};

export type SceneLayout = {
  items: SceneItemMeta[];
  labels: SceneLabelMeta[];
};

export type LayoutMode = "category" | "id" | "initial";

const CLUSTER_SIZE_CLASS = "block--small";

/** Shared cluster layout options. */
const CLUSTER_LAYOUT_SHARED = {
  topStart: 130,
  clusterCenterX: 182,
  clusterCenterOffsetY: 24,
  labelGapX: 4,
  labelOffsetY: 0,
} as const;

/** Radius scales with sqrt(count) so cluster area grows with item count; sized so items don’t overlap. */
const CLUSTER_RADIUS_BASE = 56;
const CLUSTER_RADIUS_SCALE = 18;
const CLUSTER_ROW_PADDING = 60;
const CLUSTER_GAP_Y = 48;

function clusterRadiusForCount(count: number): number {
  return CLUSTER_RADIUS_BASE + CLUSTER_RADIUS_SCALE * Math.sqrt(Math.max(1, count));
}

/** Single random point inside a circle (uniform over area, with jitter). */
function createScatterPoint(
  centerX: number,
  centerY: number,
  radius: number,
  jitter: number
): { x: number; y: number } {
  const angle = gsap.utils.random(0, Math.PI * 2);
  const distance = radius * Math.sqrt(gsap.utils.random(0, 1));
  const jitterX = gsap.utils.random(-jitter, jitter);
  const jitterY = gsap.utils.random(-jitter, jitter);

  return {
    x: centerX + Math.cos(angle) * distance + jitterX,
    y: centerY + Math.sin(angle) * distance + jitterY,
  };
}

/** N random points inside one circle. Used for both scatter and cluster layouts. */
function createScatterPoints(
  centerX: number,
  centerY: number,
  radius: number,
  jitter: number,
  count: number
): { x: number; y: number }[] {
  return Array.from({ length: count }, () =>
    createScatterPoint(centerX, centerY, radius, jitter)
  );
}

export function createInitialLayout(
  items: GalleryItemData[],
  viewportSize: { width: number; height: number }
): SceneItemMeta[] {
  const centerX = viewportSize.width / 2;
  const centerY = viewportSize.height / 2;
  const maxRadius = 900;

  const points = createScatterPoints(centerX, centerY, maxRadius, 40, items.length);

  return points.map((point) => ({
    x: point.x,
    y: point.y,
    baseZ: gsap.utils.random(-4000, 800),
    sizeClass: CLUSTER_SIZE_CLASS,
  }));
}

type ClusterLayoutOptions = {
  items: GalleryItemData[];
  initialLayout: SceneItemMeta[];
  groupKey: (item: GalleryItemData) => string;
  labelTitle: (group: string) => string;
  topStart: number;
  labelGapX: number;
  labelOffsetY: number;
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
    const count = groupIndexes.length;
    const clusterRadius = clusterRadiusForCount(count);
    const rowHeight = 2 * clusterRadius + CLUSTER_ROW_PADDING;

    const clusterCenterY = currentY + clusterCenterOffsetY;
    const points = createScatterPoints(
      clusterCenterX,
      clusterCenterY,
      clusterRadius,
      6,
      count
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

    currentY += rowHeight + CLUSTER_GAP_Y;
  });

  return {
    items: layoutItems,
    labels,
  };
}

export function createSceneLayout(
  items: GalleryItemData[],
  initialLayout: SceneItemMeta[],
  layoutMode: LayoutMode
): SceneLayout {
  if (layoutMode === "category") {
    return createClusterLayout({
      ...CLUSTER_LAYOUT_SHARED,
      items,
      initialLayout,
      groupKey: (item) => item.category?.trim() || "Uncategorized",
      labelTitle: (group) => group.toUpperCase(),
    });
  }

  if (layoutMode === "id") {
    return createClusterLayout({
      ...CLUSTER_LAYOUT_SHARED,
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
    });
  }

  return {
    items: initialLayout,
    labels: [],
  };
}

