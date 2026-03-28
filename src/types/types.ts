export type GalleryItem = {
  id: string;
  imageUrl: string;
  title?: string;
  category?: string;
  spotifyTrackUri?: string;
};

export type GalleryItemSpotifyFacets = {
  addedAt?: string;
  releaseDate?: string;
};

export type GalleryItemAiFacets = {
  genre?: string;
  country?: string;
  bpm?: "slow" | "mid" | "fast" | "energetic";
};

export type GalleryItemFacets = {
  spotify?: GalleryItemSpotifyFacets;
  ai?: GalleryItemAiFacets;
  [source: string]: unknown;
};

export type GalleryItemFacetsByKey = Record<string, GalleryItemFacets>;

export type GallerySceneProps = {
  items: GalleryItem[];
  activeItemId?: string | null;
  onItemClick?: (item: GalleryItem) => void;
};
