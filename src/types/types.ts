export type GalleryItem = {
  id: string;
  imageUrl: string;
  category?: string;
};


export type GallerySceneProps = {
  items: GalleryItem[];
  onItemClick?: (item: GalleryItem) => void;
};