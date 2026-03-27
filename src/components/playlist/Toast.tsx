import { useEffect } from "react";
import "./playlist.css";

type ToastProps = {
  message: string;
  onDone: () => void;
};

export function Toast({ message, onDone }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return <div className="playlist-toast">{message}</div>;
}
