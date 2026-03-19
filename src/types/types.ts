export type GalleryItem = {
  id: string;
  imageUrl: string;
  title?: string;
  category?: string;
  spotifyTrackUri?: string;
};


export type GallerySceneProps = {
  items: GalleryItem[];
  activeItemId?: string | null;
  onItemClick?: (item: GalleryItem) => void;
};
