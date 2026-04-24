import Icon from "../../components/Icon";

export default function MysteryPathGrid({ paths, onSelectPath }) {
  return (
    <section className="curator-path-grid" aria-label="Mystery paths">
      {paths.map((path) => (
        <button
          type="button"
          key={path.slug}
          className={`curator-path-tile ${path.locked ? "is-locked" : ""}`}
          onClick={() => onSelectPath(path)}
        >
          <span className="curator-path-name">{path.shortName}</span>
          <span className="curator-path-description">{path.description}</span>
          <span className="curator-path-action">
            {path.locked ? "Locked for now" : "Open shelf"}
            <Icon name={path.locked ? "sparkle" : "arrow"} size={13} />
          </span>
        </button>
      ))}
    </section>
  );
}
