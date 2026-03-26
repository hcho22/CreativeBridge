module.exports = [
  11325,
  a => {
    a.v({
      className: 'kaushan_script_16d3461d-module__u8WorG__className',
      variable: 'kaushan_script_16d3461d-module__u8WorG__variable',
    });
  },
  3102,
  a => {
    a.v({
      className: 'architects_daughter_6fb87541-module__u_YViq__className',
      variable: 'architects_daughter_6fb87541-module__u_YViq__variable',
    });
  },
  27572,
  a => {
    'use strict';
    var b = a.i(7997),
      c = a.i(11325);
    let d = {
      className: c.default.className,
      style: {
        fontFamily: "'Kaushan Script', 'Kaushan Script Fallback'",
        fontWeight: 400,
        fontStyle: 'normal',
      },
    };
    null != c.default.variable && (d.variable = c.default.variable);
    var e = a.i(3102);
    let f = {
      className: e.default.className,
      style: {
        fontFamily: "'Architects Daughter', 'Architects Daughter Fallback'",
        fontWeight: 400,
        fontStyle: 'normal',
      },
    };
    null != e.default.variable && (f.variable = e.default.variable);
    let g = {
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
        twitter: { card: 'summary_large_image' },
        icons: { icon: '/favicon.png', apple: '/icon.png' },
      },
      h = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'CreativeBridge',
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'iOS, Android',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        description:
          'AI-powered educational storytelling app designed for students in grades K-12.',
      };
    a.s(
      [
        'default',
        0,
        function ({ children: a }) {
          return (0, b.jsx)('html', {
            lang: 'en',
            className: `${d.variable} ${f.variable}`,
            children: (0, b.jsxs)('body', {
              children: [
                (0, b.jsx)('script', {
                  type: 'application/ld+json',
                  dangerouslySetInnerHTML: { __html: JSON.stringify(h) },
                }),
                a,
              ],
            }),
          });
        },
        'metadata',
        0,
        g,
      ],
      27572,
    );
  },
  50645,
  a => {
    a.n(a.i(27572));
  },
];

//# sourceMappingURL=%5Broot-of-the-server%5D__04v9b.j._.js.map
