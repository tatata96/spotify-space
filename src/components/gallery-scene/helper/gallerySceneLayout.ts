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
  baseZ: number;
};

export type SceneLayout = {
  items: SceneItemMeta[];
  labels: SceneLabelMeta[];
};

export type LayoutMode = "category" | "id" | "initial";

const CLUSTER_SIZE_CLASS = "block--small";

/** Radius scales with sqrt(count) so cluster area grows with item count; sized so items don’t overlap. */
const CLUSTER_RADIUS_BASE = 56;
const CLUSTER_RADIUS_SCALE = 18;
const CLUSTER_ROW_PADDING = 90;
const CLUSTER_GAP_Y = 90;
const CLUSTER_GAP_X = 180;
const CLUSTER_MARGIN = 120;
const CLUSTER_CENTER_OFFSET_Y = 24;
const LABEL_GAP_X = 12;
const LABEL_OFFSET_Y = 0;
const CLUSTER_Z_PLANE = -200;
const CLUSTER_ITEM_SIZE = 36;
const CLUSTER_ITEM_GAP = 50;
const CLUSTER_PACKING_DENSITY = 0.62;

function clusterRadiusForCount(count: number): number {
  return CLUSTER_RADIUS_BASE + CLUSTER_RADIUS_SCALE * Math.sqrt(Math.max(1, count));
}

function clusterRadiusForCountNoOverlap(count: number): number {
  const minDistance = CLUSTER_ITEM_SIZE + CLUSTER_ITEM_GAP;
  const requiredRadius =
    (minDistance / 2) * Math.sqrt(Math.max(1, count) / CLUSTER_PACKING_DENSITY);
  return Math.max(clusterRadiusForCount(count), requiredRadius);
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

function createSunflowerPoints(
  centerX: number,
  centerY: number,
  radius: number,
  count: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / Math.max(1, count);
    const r = radius * Math.sqrt(t);
    const theta = i * goldenAngle;
    points.push({
      x: centerX + Math.cos(theta) * r,
      y: centerY + Math.sin(theta) * r,
    });
  }

  return points;
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
  viewportSize: { width: number; height: number };
  sortItems?: (items: GalleryItemData[]) => GalleryItemData[];
};

function createClusterLayout({
  items,
  initialLayout,
  groupKey,
  labelTitle,
  viewportSize,
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

  const safeViewportWidth = Math.max(320, viewportSize.width);
  const clusterColumnWidth = Math.max(220, (safeViewportWidth - CLUSTER_MARGIN * 2) / 2);
  const columnCount = Math.max(
    1,
    Math.floor((safeViewportWidth - CLUSTER_MARGIN * 2 + CLUSTER_GAP_X) / (clusterColumnWidth + CLUSTER_GAP_X))
  );
  const columnHeights = Array.from({ length: columnCount }, () => CLUSTER_MARGIN);
  const columnCentersX = Array.from({ length: columnCount }, (_, columnIndex) => {
    const totalWidth =
      columnCount * clusterColumnWidth + (columnCount - 1) * CLUSTER_GAP_X;
    const startX = (safeViewportWidth - totalWidth) / 2 + clusterColumnWidth / 2;
    return startX + columnIndex * (clusterColumnWidth + CLUSTER_GAP_X);
  });

  groupOrder.forEach((key) => {
    const groupIndexes = groups.get(key) ?? [];
    const count = groupIndexes.length;
    const clusterRadius = clusterRadiusForCountNoOverlap(count);
    const rowHeight = 2 * clusterRadius + CLUSTER_ROW_PADDING;

    const targetColumnIndex = columnHeights.reduce(
      (bestIndex, height, index, array) =>
        height < array[bestIndex] ? index : bestIndex,
      0
    );

    const clusterCenterX = columnCentersX[targetColumnIndex];
    const clusterCenterY = columnHeights[targetColumnIndex] + CLUSTER_CENTER_OFFSET_Y;
    const points = createSunflowerPoints(clusterCenterX, clusterCenterY, clusterRadius, count);

    const maxX = Math.max(...points.map((point) => point.x));
    const averageY =
      points.reduce((total, point) => total + point.y, 0) / points.length;

    labels.push({
      key,
      title: labelTitle(key),
      x: maxX + LABEL_GAP_X,
      y: averageY + LABEL_OFFSET_Y,
      baseZ: CLUSTER_Z_PLANE,
    });

    groupIndexes.forEach((itemIndex, groupIndex) => {
      const point = points[groupIndex];

      layoutItems[itemIndex] = {
        ...initialLayout[itemIndex],
        x: point.x,
        y: point.y,
        baseZ: CLUSTER_Z_PLANE,
        sizeClass: CLUSTER_SIZE_CLASS,
      };
    });

    columnHeights[targetColumnIndex] += rowHeight + CLUSTER_GAP_Y;
  });

  return {
    items: layoutItems,
    labels,
  };
}

export function createSceneLayout(
  items: GalleryItemData[],
  initialLayout: SceneItemMeta[],
  layoutMode: LayoutMode,
  viewportSize: { width: number; height: number }
): SceneLayout {
  if (layoutMode === "category") {
    return createClusterLayout({
      items,
      initialLayout,
      viewportSize,
      groupKey: (item) => item.category?.trim() || "Uncategorized",
      labelTitle: (group) => group.toUpperCase(),
    });
  }

  if (layoutMode === "id") {
    return createClusterLayout({
      items,
      initialLayout,
      viewportSize,
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

