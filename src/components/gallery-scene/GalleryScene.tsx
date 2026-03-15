import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import {GalleryItem} from "./GalleryItem";
import { type GalleryItem as GalleryItemData } from "@/types/types";

type SceneItemMeta = {
  x: number;
  y: number;
  baseZ: number;
  sizeClass: string;
};

const SIZE_CLASSES = ["block--small", "block--medium", "block--large"] as const;

export type GallerySceneProps = {
  items: GalleryItemData[];
  onItemClick?: (item: GalleryItemData) => void;
};


const PAN_SPEED = 0.8;
const ZOOM_SPEED = 80;
const MIN_CAMERA_Z = -20000;
const MAX_CAMERA_Z = 35000;

export function GalleryScene({
  items,
  onItemClick,
}: GallerySceneProps) {
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const cameraXRef = useRef(0);
  const cameraYRef = useRef(0);
  const cameraZRef = useRef(0);


  const sceneItems = useMemo(() => {
    if (typeof window === "undefined") return [];
    return createInitialLayout(items);
  }, [items]);

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;

    function updateBlocks() {
      console.log("updateBlocks");
      sceneItems.forEach((sceneItem, index) => {
        const element = itemRefs.current[index];
        if (!element) return;

        const relativeZ = sceneItem.baseZ - cameraZRef.current;
        const opacity = relativeZ > 600 ? 0 : 1;

        gsap.set(element, {
          x: sceneItem.x,
          y: sceneItem.y,
          z: relativeZ,
          opacity,
        });
      });

      gsap.to(gallery, {
        duration: 0.25,
        x: cameraXRef.current,
        y: cameraYRef.current,
        ease: "power2.out",
      });
    }

    function handleWheel(event: WheelEvent) {
      const isPinch = event.ctrlKey;

      event.preventDefault();

      if (isPinch) {
        cameraZRef.current += event.deltaY * ZOOM_SPEED;

        // to prevent the camera from going out of bounds while zooming
        cameraZRef.current = gsap.utils.clamp(
          MIN_CAMERA_Z,
          MAX_CAMERA_Z,
          cameraZRef.current
        );
      } else {
        cameraXRef.current -= event.deltaX * PAN_SPEED;
        cameraYRef.current -= event.deltaY * PAN_SPEED;
      }

      updateBlocks();
    }

    updateBlocks();

    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, [sceneItems]);

  return (
    <div className="scene">
      <div ref={galleryRef} className="gallery">
        {items.map((item, index) => (
          <GalleryItem
            key={item.id}
            item={item}
            sizeClass={sceneItems[index]?.sizeClass ?? "block--medium"}
            onClick={onItemClick}
            itemRef={(element) => {
              itemRefs.current[index] = element;
            }}
          />
        ))}
      </div>
    </div>
  );
}

function randomFromArray<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function createInitialLayout(items: GalleryItemData[]): SceneItemMeta[] {
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  return items.map(() => {
    const angle = gsap.utils.random(0, Math.PI * 2);
    const radius = gsap.utils.random(450, 900);

    const jitterX = gsap.utils.random(-80, 80);
    const jitterY = gsap.utils.random(-80, 80);

    const x = centerX + Math.cos(angle) * radius + jitterX;
    const y = centerY + Math.sin(angle) * radius + jitterY;

    return {
      x,
      y,
      baseZ: gsap.utils.random(-4000, 800),
      sizeClass: randomFromArray(SIZE_CLASSES),
    };
  });
}