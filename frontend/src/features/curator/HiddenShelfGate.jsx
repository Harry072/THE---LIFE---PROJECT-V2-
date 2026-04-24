import Icon from "../../components/Icon";

export default function HiddenShelfGate({ path }) {
  return (
    <section
      id={`curator-path-${path.slug}`}
      className="curator-hidden-shelf"
    >
      <div>
        <p className="curator-section-label">Deeper Path</p>
        <h2>{path.name}</h2>
        <p>{path.description}</p>
      </div>
      <div className="curator-hidden-lock">
        <Icon name="sparkle" size={18} />
        <span>{path.mentorIntro}</span>
      </div>
    </section>
  );
}
