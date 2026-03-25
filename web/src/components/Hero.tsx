import Image from 'next/image';

export default function Hero() {
  return (
    <section
      aria-label="Hero"
      className="bg-gradient-to-b from-white to-primary-light/10 px-4 py-16 md:py-24"
    >
      <div className="mx-auto flex max-w-6xl flex-col-reverse items-center gap-10 md:flex-row md:gap-16">
        {/* Text content */}
        <div className="flex-1 text-center md:text-left">
          <h1 className="font-display text-4xl text-primary md:text-6xl">
            AI-Powered Storytelling for Every Student
          </h1>

          <p className="mt-4 font-creative text-lg text-text-secondary md:text-xl">
            The only writing app that grows with students from kindergarten
            through high school, providing AI-powered storytelling experiences
            that adapt to each learner&apos;s unique needs and interests.
          </p>

          <p className="mt-3 text-base text-text-secondary">
            Create, continue, and illustrate stories with the help of AI —
            designed for grades K-12.
          </p>

          {/* CTA buttons */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
            <a
              href="#download"
              className="inline-block rounded-button bg-primary px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Download on iOS
            </a>
            <a
              href="#download"
              className="inline-block rounded-button border-2 border-primary px-6 py-3 text-center font-semibold text-primary-dark transition-colors hover:bg-primary hover:text-white"
            >
              Get on Android
            </a>
          </div>
        </div>

        {/* App icon */}
        <div className="flex-shrink-0">
          <Image
            src="/icon.png"
            alt="CreativeBridge app icon"
            width={160}
            height={160}
            className="rounded-3xl shadow-lg"
            priority
          />
        </div>
      </div>
    </section>
  );
}
