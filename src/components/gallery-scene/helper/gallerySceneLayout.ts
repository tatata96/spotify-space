import { gsap } from "gsap";
import { getYearMonthKeyFromIso, parseIsoDateToTimestamp, parseReleaseYear } from "@/lib/dateTime";
import {
  type GalleryItem as GalleryItemData,
  type GalleryItemFacetsByKey,
} from "@/types/types";

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

export type LayoutMode = "trackName" | "addedAt" | "releaseYear" | "initial";

const CLUSTER_SIZE_CLASS = "block--small";

/** Radius scales with sqrt(count) so cluster area grows with item count; sized so items don’t overlap. */
const CLUSTER_RADIUS_BASE = 56;
const CLUSTER_RADIUS_SCALE = 18;
const CLUSTER_ROW_PADDING = 90;
const CLUSTER_GAP_Y = 90;
const CLUSTER_GAP_X = 180;
const CLUSTER_MARGIN = 120;
const CLUSTER_CENTER_OFFSET_Y = 24;
const LABEL_GAP_X = 120;
const LABEL_OFFSET_Y = 0;
const CLUSTER_Z_PLANE = 0;
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

  // Scale radius with item count so items never overlap regardless of library size.
  const minItemSpacing = CLUSTER_ITEM_SIZE + 16;
  const radius = Math.max(400, minItemSpacing * Math.sqrt(Math.max(1, items.length) / Math.PI));

  // Sunflower packing guarantees non-overlapping placement; small jitter breaks
  // the mechanical look while keeping items clearly separable for hit-testing.
  const points = createSunflowerPoints(centerX, centerY, radius, items.length);

  return points.map((point) => ({
    x: point.x + gsap.utils.random(-12, 12),
    y: point.y + gsap.utils.random(-12, 12),
    baseZ: gsap.utils.random(-200, 80),
    sizeClass: CLUSTER_SIZE_CLASS,
  }));
}

type ClusterLayoutOptions = {
  items: GalleryItemData[];
  facetsByKey: GalleryItemFacetsByKey;
  initialLayout: SceneItemMeta[];
  groupKey: (item: GalleryItemData, facetsByKey: GalleryItemFacetsByKey) => string;
  labelTitle: (group: string) => string;
  viewportSize: { width: number; height: number };
  sortItems?: (items: GalleryItemData[], facetsByKey: GalleryItemFacetsByKey) => GalleryItemData[];
};

const UNKNOWN_ADDED_DATE_GROUP = "Unknown Added Date";
const UNKNOWN_RELEASE_YEAR_GROUP = "Unknown Release Year";

function getFacetKey(item: GalleryItemData): string {
  return item.spotifyTrackUri ?? item.id;
}

function getSpotifyAddedAt(item: GalleryItemData, facetsByKey: GalleryItemFacetsByKey): string | null {
  return facetsByKey[getFacetKey(item)]?.spotify?.addedAt ?? null;
}

function getSpotifyReleaseDate(item: GalleryItemData, facetsByKey: GalleryItemFacetsByKey): string | null {
  return facetsByKey[getFacetKey(item)]?.spotify?.releaseDate ?? null;
}

function normalizedTrackName(value?: string): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function trackNameGroupKey(item: GalleryItemData): string {
  const firstCharacter = item.title?.trim().charAt(0).toLocaleUpperCase() ?? "";
  return /^[A-Z]$/.test(firstCharacter) ? firstCharacter : "#";
}

function compareNullableNumbersDescending(first: number | null, second: number | null): number {
  if (first === null && second === null) return 0;
  if (first === null) return 1;
  if (second === null) return -1;
  return second - first;
}

function createClusterLayout({
  items,
  facetsByKey,
  initialLayout,
  groupKey,
  labelTitle,
  viewportSize,
  sortItems,
}: ClusterLayoutOptions): SceneLayout {
  const groupOrder: string[] = [];
  const groups = new Map<string, number[]>();
  const itemIndexById = new Map(items.map((item, index) => [item.id, index]));
  const orderedItems = sortItems ? sortItems(items, facetsByKey) : items;

  orderedItems.forEach((item) => {
    const key = groupKey(item, facetsByKey);
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
  facetsByKey: GalleryItemFacetsByKey,
  initialLayout: SceneItemMeta[],
  layoutMode: LayoutMode,
  viewportSize: { width: number; height: number }
): SceneLayout {
  if (layoutMode === "trackName") {
    return createClusterLayout({
      items,
      facetsByKey,
      initialLayout,
      viewportSize,
      sortItems: (sceneItems) =>
        [...sceneItems].sort((first, second) => {
          const titleComparison = normalizedTrackName(first.title).localeCompare(
            normalizedTrackName(second.title)
          );
          if (titleComparison !== 0) {
            return titleComparison;
          }

          return first.id.localeCompare(second.id);
        }),
      groupKey: (item) => trackNameGroupKey(item),
      labelTitle: (group) => group,
    });
  }

  if (layoutMode === "addedAt") {
    return createClusterLayout({
      items,
      facetsByKey,
      initialLayout,
      viewportSize,
      sortItems: (sceneItems, facets) =>
        [...sceneItems].sort((first, second) => {
          const firstTimestamp = parseIsoDateToTimestamp(getSpotifyAddedAt(first, facets));
          const secondTimestamp = parseIsoDateToTimestamp(getSpotifyAddedAt(second, facets));
          const timestampComparison = compareNullableNumbersDescending(firstTimestamp, secondTimestamp);
          if (timestampComparison !== 0) {
            return timestampComparison;
          }

          return normalizedTrackName(first.title).localeCompare(normalizedTrackName(second.title));
        }),
      groupKey: (item, facets) =>
        getYearMonthKeyFromIso(getSpotifyAddedAt(item, facets)) ?? UNKNOWN_ADDED_DATE_GROUP,
      labelTitle: (group) => group,
    });
  }

  if (layoutMode === "releaseYear") {
    return createClusterLayout({
      items,
      facetsByKey,
      initialLayout,
      viewportSize,
      sortItems: (sceneItems, facets) =>
        [...sceneItems].sort((first, second) => {
          const firstYear = parseReleaseYear(getSpotifyReleaseDate(first, facets));
          const secondYear = parseReleaseYear(getSpotifyReleaseDate(second, facets));
          const yearComparison = compareNullableNumbersDescending(firstYear, secondYear);
          if (yearComparison !== 0) {
            return yearComparison;
          }

          return normalizedTrackName(first.title).localeCompare(normalizedTrackName(second.title));
        }),
      groupKey: (item, facets) => {
        const releaseYear = parseReleaseYear(getSpotifyReleaseDate(item, facets));
        return releaseYear !== null ? String(releaseYear) : UNKNOWN_RELEASE_YEAR_GROUP;
      },
      labelTitle: (group) => group,
    });
  }

  return {
    items: initialLayout,
    labels: [],
  };
}

