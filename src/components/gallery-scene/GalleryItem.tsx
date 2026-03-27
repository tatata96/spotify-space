import type { GalleryItem } from "@/types/types";

type GalleryItemProps = {
  item: GalleryItem;
  isActive?: boolean;
  sizeClass: string;
  onClick?: (item: GalleryItem) => void;
  itemRef?: (element: HTMLButtonElement | null) => void;
};

export function GalleryItem({
  item,
  isActive = false,
  sizeClass,
  onClick,
  itemRef,
}: GalleryItemProps) {
  return (
    <button
      ref={itemRef}
      type="button"
      className={`block ${sizeClass}${isActive ? " block--active" : ""}`}
      onClick={() => onClick?.(item)}
      aria-label={item.title ? `Play ${item.title}` : `Open item ${item.id}`}
      aria-pressed={isActive}
      style={{
        backgroundImage: `url(${item.imageUrl})`,
      }}
    />
  );
}
