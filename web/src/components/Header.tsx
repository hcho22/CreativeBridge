import Image from 'next/image';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/icon.png"
            alt="CreativeBridge app icon"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="font-display text-xl text-primary">
            CreativeBridge
          </span>
        </Link>

        <a
          href="#download"
          className="rounded-button bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark min-h-[44px] inline-flex items-center"
        >
          Download
        </a>
      </nav>
    </header>
  );
}
