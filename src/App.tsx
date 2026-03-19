import "./App.css";
import { useState } from "react";
import { GalleryScene, type LayoutMode } from "@/components/gallery-scene/GalleryScene";
import { GalleryFilters } from "@/components/gallery-scene/filters/GalleryFilters";
import { GALLERY_ITEMS } from "@/data/galleryItems";

function App() {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("initial");

  return (
    <>
      <GalleryFilters
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
      />
      <GalleryScene
        items={GALLERY_ITEMS}
        layoutMode={layoutMode}
        onItemClick={(item) => {
          console.log("Clicked item:", item);
        }}
      />
    </>
  );
}

export default App;
