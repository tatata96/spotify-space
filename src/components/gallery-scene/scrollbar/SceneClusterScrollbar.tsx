import "./scene_cluster_scrollbar.css";

export type SceneClusterScrollbarItem = {
  key: string;
  title: string;
};

type SceneClusterScrollbarProps = {
  items: SceneClusterScrollbarItem[];
  activeKey: string | null;
  progress: number;
  onSelect: (key: string) => void;
};

export function SceneClusterScrollbar({
  items,
  activeKey,
  progress,
  onSelect,
}: SceneClusterScrollbarProps) {
  if (items.length === 0) return null;

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.key === activeKey)
  );
  const thumbOffset = progress * 100;

  function moveByDirection(direction: 1 | -1) {
    const nextIndex = Math.min(
      items.length - 1,
      Math.max(0, activeIndex + direction)
    );
    onSelect(items[nextIndex].key);
  }

  return (
    <aside
      className="scene-cluster-scrollbar"
      onWheel={(event) => {
        event.preventDefault();
        moveByDirection(event.deltaY > 0 ? 1 : -1);
      }}
    >
      <div
        className="scene-cluster-scrollbar__track"
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientY - bounds.top) / bounds.height;
          const nextIndex = Math.round(
            Math.min(items.length - 1, Math.max(0, ratio * (items.length - 1)))
          );
          onSelect(items[nextIndex].key);
        }}
      >
        <div
          className="scene-cluster-scrollbar__thumb"
          style={{ top: `${thumbOffset}%` }}
        />
      </div>
      <div className="scene-cluster-scrollbar__labels">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`scene-cluster-scrollbar__label ${
              item.key === activeKey ? "is-active" : ""
            }`}
            onClick={() => onSelect(item.key)}
          >
            {item.title}
          </button>
        ))}
      </div>
    </aside>
  );
}
