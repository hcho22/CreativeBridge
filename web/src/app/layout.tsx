import type { Metadata } from 'next';
import { Kaushan_Script, Architects_Daughter } from 'next/font/google';
import './globals.css';

const kaushanScript = Kaushan_Script({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-kaushan',
});

const architectsDaughter = Architects_Daughter({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-architects',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://creativebridge.app'),
  title:
    'CreativeBridge - AI Story Creator | Educational Storytelling for K-12',
  description:
    'CreativeBridge is an AI-powered educational storytelling app designed for students in grades K-12. Create, continue, and illustrate stories with the help of AI.',
  keywords: [
    'education',
    'storytelling',
    'AI',
    'creative writing',
    'kids',
    'students',
    'K-12',
  ],
  openGraph: {
    title:
      'CreativeBridge - AI Story Creator | Educational Storytelling for K-12',
    description:
      'CreativeBridge is an AI-powered educational storytelling app designed for students in grades K-12. Create, continue, and illustrate stories with the help of AI.',
    url: 'https://creativebridge.app',
    type: 'website',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/icon.png',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'CreativeBridge',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'iOS, Android',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'AI-powered educational storytelling app designed for students in grades K-12.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${kaushanScript.variable} ${architectsDaughter.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
