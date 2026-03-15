import type { GalleryItem } from "@/types/types";

const BASE_IMAGES = [
  "https://images.unsplash.com/photo-1592581428203-aee84ad776d0",
  "https://images.unsplash.com/photo-1593278540538-c48ea5b81944",
  "https://plus.unsplash.com/premium_photo-1672510002580-23fcab4dfbce",
  "https://images.unsplash.com/photo-1643904697364-d7da6bb0d46b",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e",
] as const;

const CATEGORIES = ["nature", "people", "cars", "architecture", "travel"] as const;

function buildGalleryItems(count: number): GalleryItem[] {
  const items: GalleryItem[] = [];
  for (let i = 0; i < count; i++) {
    const baseUrl = BASE_IMAGES[i % BASE_IMAGES.length];
    const imageUrl = `${baseUrl}?w=600&h=600&sig=${i}`;
    const category = CATEGORIES[i % CATEGORIES.length];
    items.push({
      id: String(i + 1),
      imageUrl,
      category,
    });
  }
  return items;
}

export const GALLERY_ITEMS: GalleryItem[] = buildGalleryItems(200);
