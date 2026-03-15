import { useEffect, useEffectEvent, useRef } from "react";
import { gsap } from "gsap";
import type { SceneLayout } from "./gallerySceneLayout";

const PAN_SPEED = 0.8;
const ZOOM_SPEED = 90;
const MIN_CAMERA_Z = -20000;
const MAX_CAMERA_Z = 35000;
const LAYOUT_ANIMATION_DURATION = 0.95;
const CAMERA_ANIMATION_DURATION = 0.25;

export function useScenePanZoom(
  galleryRef: React.RefObject<HTMLDivElement | null>,
  itemRefs: React.RefObject<(HTMLButtonElement | null)[]>,
  labelRefs: React.RefObject<(HTMLDivElement | null)[]>,
  sceneLayout: SceneLayout
) {
  const cameraXRef = useRef(0);
  const cameraYRef = useRef(0);
  const cameraZRef = useRef(4000);
  const sceneLayoutRef = useRef(sceneLayout);

  const updateScene = useEffectEvent((duration: number) => {
    const gallery = galleryRef.current;
    const layout = sceneLayoutRef.current;
    if (!gallery) return;
    const applyTransform = duration === 0 ? gsap.set : gsap.to;

    layout.items.forEach((sceneItem, index) => {
      const element = itemRefs.current[index];
      if (!element) return;

      const relativeZ = sceneItem.baseZ - cameraZRef.current;

      applyTransform(element, {
        duration,
        x: sceneItem.x,
        y: sceneItem.y,
        z: relativeZ,
        ease: "power3.inOut",
        overwrite: "auto",
      });
    });

    layout.labels.forEach((label, index) => {
      const element = labelRefs.current[index];
      if (!element) return;

      applyTransform(element, {
        duration,
        x: label.x,
        y: label.y,
        yPercent: -50,
        autoAlpha: 1,
        ease: "power3.inOut",
        overwrite: "auto",
      });
    });

    applyTransform(gallery, {
      duration: duration === 0 ? 0 : CAMERA_ANIMATION_DURATION,
      x: cameraXRef.current,
      y: cameraYRef.current,
      ease: "power2.out",
      overwrite: "auto",
    });
  });

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;

    function handleWheel(event: WheelEvent) {
      const isPinch = event.ctrlKey;

      event.preventDefault();

      if (isPinch) {
        const deltaMultiplier =
          event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? 16
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
              ? window.innerHeight
              : 1;

        cameraZRef.current += event.deltaY * deltaMultiplier * ZOOM_SPEED;
        cameraZRef.current = gsap.utils.clamp(
          MIN_CAMERA_Z,
          MAX_CAMERA_Z,
          cameraZRef.current
        );

        updateScene(0);
        return;
      } else {
        cameraXRef.current -= event.deltaX * PAN_SPEED;
        cameraYRef.current -= event.deltaY * PAN_SPEED;
      }

      updateScene(CAMERA_ANIMATION_DURATION);
    }

    updateScene(0);

    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, [galleryRef, itemRefs, labelRefs]);

  useEffect(() => {
    sceneLayoutRef.current = sceneLayout;
    updateScene(LAYOUT_ANIMATION_DURATION);
  }, [sceneLayout]);
}
