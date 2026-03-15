import type { GalleryItem } from "@/types/types";

type GalleryItemProps = {
  item: GalleryItem;
  sizeClass: string;
  onClick?: (item: GalleryItem) => void;
  itemRef?: (element: HTMLButtonElement | null) => void;
};

export function GalleryItem({
  item,
  sizeClass,
  onClick,
  itemRef,
}: GalleryItemProps) {
  return (
    <button
      ref={itemRef}
      type="button"
      className={`block ${sizeClass}`}
      onClick={() => onClick?.(item)}
      aria-label={`Open item ${item.id}`}
      style={{
        backgroundImage: `url(${item.imageUrl})`,
      }}
    />
  );
}