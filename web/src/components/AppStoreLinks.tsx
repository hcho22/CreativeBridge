import Image from 'next/image';

export default function AppStoreLinks() {
  return (
    <section
      id="download"
      aria-label="Download"
      className="px-4 py-16 text-center"
    >
      <h2 className="mb-8 font-display text-2xl text-primary-dark md:text-3xl">
        Available on iOS and Android
      </h2>

      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center transition-opacity hover:opacity-80"
        >
          <Image
            src="/app-store-badge.svg"
            alt="Download on the App Store"
            width={150}
            height={44}
          />
        </a>

        <a
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center transition-opacity hover:opacity-80"
        >
          <Image
            src="/google-play-badge.png"
            alt="Get it on Google Play"
            width={150}
            height={44}
          />
        </a>
      </div>
    </section>
  );
}
