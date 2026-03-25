import FeatureCard from './FeatureCard';

const features = [
  {
    icon: '\uD83D\uDCDA',
    title: 'Grade-Level Stories',
    description:
      'Stories adapt from kindergarten through high school with age-appropriate vocabulary and themes.',
  },
  {
    icon: '\u2728',
    title: 'AI-Assisted Writing',
    description:
      'GPT-4 powered story generation helps students develop creative writing skills.',
  },
  {
    icon: '\uD83C\uDFA8',
    title: 'Story Illustrations',
    description:
      'AI-generated images bring stories to life with grade-appropriate art styles.',
  },
  {
    icon: '\uD83C\uDF99\uFE0F',
    title: 'Voice Input',
    description:
      'Speak your ideas and watch them transform into written stories.',
  },
  {
    icon: '\uD83C\uDFC6',
    title: 'XP & Streaks',
    description:
      'Stay motivated with experience points, daily streaks, and achievements.',
  },
  {
    icon: '\uD83D\uDCC1',
    title: 'Story Library',
    description: 'Save, revisit, and export your stories anytime.',
  },
];

export default function Features() {
  return (
    <section aria-label="Features" className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-display text-3xl text-primary md:text-4xl">
          Why CreativeBridge?
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map(feature => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
