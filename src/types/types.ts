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

export type GalleryItemFacets = {
  spotify?: GalleryItemSpotifyFacets;
  [source: string]: Record<string, unknown> | undefined;
};

export type GalleryItemFacetsByKey = Record<string, GalleryItemFacets>;


export type GallerySceneProps = {
  items: GalleryItem[];
  activeItemId?: string | null;
  onItemClick?: (item: GalleryItem) => void;
};
