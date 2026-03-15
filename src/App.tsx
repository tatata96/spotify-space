
import './App.css'
import {GalleryScene} from './components/gallery-scene/GalleryScene'
import  type {GalleryItem} from './types/types';

const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: "1",
    imageUrl: "https://images.unsplash.com/photo-1592581428203-aee84ad776d0",
    category: "nature",
  },
  {
    id: "2",
    imageUrl: "https://images.unsplash.com/photo-1593278540538-c48ea5b81944",
    category: "people",
  },
  {
    id: "3",
    imageUrl: "https://plus.unsplash.com/premium_photo-1672510002580-23fcab4dfbce",
    category: "cars",
  },
  {
    id: "4",
    imageUrl: "https://images.unsplash.com/photo-1643904697364-d7da6bb0d46b",
    category: "nature",
  },
  {
    id: "5",
    imageUrl: "https://images.unsplash.com/photo-1592581428203-aee84ad776d0",
    category: "nature",
  },
  {
    id: "6",
    imageUrl: "https://images.unsplash.com/photo-1593278540538-c48ea5b81944",
    category: "people",
  },
  {
    id: "7",
    imageUrl: "https://plus.unsplash.com/premium_photo-1672510002580-23fcab4dfbce",
    category: "cars",
  },
  {
    id: "8",
    imageUrl: "https://images.unsplash.com/photo-1643904697364-d7da6bb0d46b",
    category: "nature",
  },
  {
    id: "9",
    imageUrl: "https://images.unsplash.com/photo-1592581428203-aee84ad776d0",
    category: "nature",
  },
  {
    id: "10",
    imageUrl: "https://images.unsplash.com/photo-1593278540538-c48ea5b81944",
    category: "people",
  },
  {
    id: "11",
    imageUrl: "https://plus.unsplash.com/premium_photo-1672510002580-23fcab4dfbce",
    category: "cars",
  },
  {
    id: "12",
    imageUrl: "https://images.unsplash.com/photo-1643904697364-d7da6bb0d46b",
    category: "nature",
  },
];

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
