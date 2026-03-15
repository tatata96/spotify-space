import "./App.css";
import { GalleryScene } from "@/components/gallery-scene/GalleryScene";
import { GALLERY_ITEMS } from "@/data/galleryItems";

function App() {

  return (
    <GalleryScene
      items={GALLERY_ITEMS}
      onItemClick={(item) => {
        console.log("Clicked item:", item);
      }}
    />
  );
}

export default App
