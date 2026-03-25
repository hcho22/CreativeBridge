interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

export default function FeatureCard({
  icon,
  title,
  description,
}: FeatureCardProps) {
  return (
    <article className="rounded-card border border-border bg-surface p-6 transition-shadow hover:shadow-md">
      <div className="mb-3 text-3xl" role="img" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-text-secondary">
        {description}
      </p>
    </article>
  );
}
