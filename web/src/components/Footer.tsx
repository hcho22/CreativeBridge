import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-text text-surface">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Legal links */}
          <nav aria-label="Footer" className="flex gap-2 text-sm">
            <Link
              href="/privacy"
              className="inline-flex min-h-[44px] items-center px-3 text-gray-300 transition-colors hover:text-white"
            >
              Privacy Policy
            </Link>
            <a
              href="#"
              className="inline-flex min-h-[44px] items-center px-3 text-gray-300 transition-colors hover:text-white"
            >
              Terms of Service
            </a>
          </nav>

          {/* COPPA compliance notice */}
          <p className="max-w-xl text-xs leading-relaxed text-gray-400">
            CreativeBridge is committed to protecting children&apos;s privacy
            and complies with COPPA. Parental consent is required for users
            under 13.
          </p>

          {/* Copyright */}
          <p className="text-xs text-gray-500">
            &copy; 2026 CreativeBridge. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
