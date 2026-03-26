module.exports = [
  71306,
  (a, b, c) => {
    b.exports = a.r(18622);
  },
  79847,
  a => {
    a.n(a.i(3343));
  },
  9185,
  a => {
    a.n(a.i(29432));
  },
  72842,
  a => {
    a.n(a.i(75164));
  },
  54897,
  a => {
    a.n(a.i(30106));
  },
  56157,
  a => {
    a.n(a.i(18970));
  },
  94331,
  a => {
    a.n(a.i(60644));
  },
  15988,
  a => {
    a.n(a.i(56952));
  },
  25766,
  a => {
    a.n(a.i(77341));
  },
  29725,
  a => {
    a.n(a.i(94290));
  },
  5785,
  a => {
    a.n(a.i(90588));
  },
  74793,
  a => {
    a.n(a.i(33169));
  },
  85826,
  a => {
    a.n(a.i(37111));
  },
  21565,
  a => {
    a.n(a.i(41763));
  },
  65911,
  a => {
    a.n(a.i(8950));
  },
  25128,
  a => {
    a.n(a.i(91562));
  },
  40781,
  a => {
    a.n(a.i(49670));
  },
  69411,
  a => {
    a.n(a.i(75700));
  },
  63081,
  a => {
    a.n(a.i(276));
  },
  62837,
  a => {
    a.n(a.i(40795));
  },
  34607,
  a => {
    a.n(a.i(11614));
  },
  96338,
  a => {
    a.n(a.i(21751));
  },
  50642,
  a => {
    a.n(a.i(12213));
  },
  32242,
  a => {
    a.n(a.i(22693));
  },
  88530,
  a => {
    a.n(a.i(10531));
  },
  93695,
  (a, b, c) => {
    b.exports = a.x('next/dist/shared/lib/no-fallback-error.external.js', () =>
      require('next/dist/shared/lib/no-fallback-error.external.js'),
    );
  },
  8583,
  a => {
    a.n(a.i(1082));
  },
  38534,
  a => {
    a.n(a.i(98175));
  },
  70408,
  a => {
    a.n(a.i(9095));
  },
  22922,
  a => {
    a.n(a.i(96772));
  },
  78294,
  a => {
    a.n(a.i(71717));
  },
  16625,
  a => {
    a.n(a.i(85034));
  },
  88648,
  a => {
    a.n(a.i(68113));
  },
  51914,
  a => {
    a.n(a.i(66482));
  },
  25466,
  a => {
    a.n(a.i(91505));
  },
  71029,
  (a, b, c) => {
    'use strict';
    c._ = function (a) {
      return a && a.__esModule ? a : { default: a };
    };
  },
  60168,
  a => {
    'use strict';
    var b = a.i(7997),
      c = a.i(22777),
      d = a.i(3236);
    function e() {
      return (0, b.jsx)('section', {
        'aria-label': 'Hero',
        className:
          'bg-gradient-to-b from-white to-primary-light/10 px-4 py-16 md:py-24',
        children: (0, b.jsxs)('div', {
          className:
            'mx-auto flex max-w-6xl flex-col-reverse items-center gap-10 md:flex-row md:gap-16',
          children: [
            (0, b.jsxs)('div', {
              className: 'flex-1 text-center md:text-left',
              children: [
                (0, b.jsx)('h1', {
                  className: 'font-display text-4xl text-primary md:text-6xl',
                  children: 'AI-Powered Storytelling for Every Student',
                }),
                (0, b.jsx)('p', {
                  className:
                    'mt-4 font-creative text-lg text-text-secondary md:text-xl',
                  children:
                    "The only writing app that grows with students from kindergarten through high school, providing AI-powered storytelling experiences that adapt to each learner's unique needs and interests.",
                }),
                (0, b.jsx)('p', {
                  className: 'mt-3 text-base text-text-secondary',
                  children:
                    'Create, continue, and illustrate stories with the help of AI — designed for grades K-12.',
                }),
                (0, b.jsxs)('div', {
                  className:
                    'mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start',
                  children: [
                    (0, b.jsx)('a', {
                      href: '#download',
                      className:
                        'inline-block rounded-button bg-primary px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-primary-dark',
                      children: 'Download on iOS',
                    }),
                    (0, b.jsx)('a', {
                      href: '#download',
                      className:
                        'inline-block rounded-button border-2 border-primary px-6 py-3 text-center font-semibold text-primary-dark transition-colors hover:bg-primary hover:text-white',
                      children: 'Get on Android',
                    }),
                  ],
                }),
              ],
            }),
            (0, b.jsx)('div', {
              className: 'flex-shrink-0',
              children: (0, b.jsx)(d.default, {
                src: '/icon.png',
                alt: 'CreativeBridge app icon',
                width: 160,
                height: 160,
                className: 'rounded-3xl shadow-lg',
                priority: !0,
              }),
            }),
          ],
        }),
      });
    }
    function f({ icon: a, title: c, description: d }) {
      return (0, b.jsxs)('article', {
        className:
          'rounded-card border border-border bg-surface p-6 transition-shadow hover:shadow-md',
        children: [
          (0, b.jsx)('div', {
            className: 'mb-3 text-3xl',
            role: 'img',
            'aria-hidden': 'true',
            children: a,
          }),
          (0, b.jsx)('h3', {
            className: 'text-lg font-semibold text-text',
            children: c,
          }),
          (0, b.jsx)('p', {
            className: 'mt-2 text-base leading-relaxed text-text-secondary',
            children: d,
          }),
        ],
      });
    }
    let g = [
      {
        icon: '📚',
        title: 'Grade-Level Stories',
        description:
          'Stories adapt from kindergarten through high school with age-appropriate vocabulary and themes.',
      },
      {
        icon: '✨',
        title: 'AI-Assisted Writing',
        description:
          'GPT-4 powered story generation helps students develop creative writing skills.',
      },
      {
        icon: '🎨',
        title: 'Story Illustrations',
        description:
          'AI-generated images bring stories to life with grade-appropriate art styles.',
      },
      {
        icon: '🎙️',
        title: 'Voice Input',
        description:
          'Speak your ideas and watch them transform into written stories.',
      },
      {
        icon: '🏆',
        title: 'XP & Streaks',
        description:
          'Stay motivated with experience points, daily streaks, and achievements.',
      },
      {
        icon: '📁',
        title: 'Story Library',
        description: 'Save, revisit, and export your stories anytime.',
      },
    ];
    function h() {
      return (0, b.jsx)('section', {
        'aria-label': 'Features',
        className: 'px-4 py-16 md:py-24',
        children: (0, b.jsxs)('div', {
          className: 'mx-auto max-w-6xl',
          children: [
            (0, b.jsx)('h2', {
              className:
                'text-center font-display text-3xl text-primary md:text-4xl',
              children: 'Why CreativeBridge?',
            }),
            (0, b.jsx)('div', {
              className:
                'mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3',
              children: g.map(a =>
                (0, b.jsx)(
                  f,
                  { icon: a.icon, title: a.title, description: a.description },
                  a.title,
                ),
              ),
            }),
          ],
        }),
      });
    }
    function i() {
      return (0, b.jsxs)('section', {
        id: 'download',
        'aria-label': 'Download',
        className: 'px-4 py-16 text-center',
        children: [
          (0, b.jsx)('h2', {
            className:
              'mb-8 font-display text-2xl text-primary-dark md:text-3xl',
            children: 'Available on iOS and Android',
          }),
          (0, b.jsxs)('div', {
            className:
              'flex flex-col items-center justify-center gap-4 sm:flex-row',
            children: [
              (0, b.jsx)('a', {
                href: '#',
                target: '_blank',
                rel: 'noopener noreferrer',
                className:
                  'inline-flex min-h-[44px] items-center transition-opacity hover:opacity-80',
                children: (0, b.jsx)(d.default, {
                  src: '/app-store-badge.svg',
                  alt: 'Download on the App Store',
                  width: 150,
                  height: 44,
                }),
              }),
              (0, b.jsx)('a', {
                href: '#',
                target: '_blank',
                rel: 'noopener noreferrer',
                className:
                  'inline-flex min-h-[44px] items-center transition-opacity hover:opacity-80',
                children: (0, b.jsx)(d.default, {
                  src: '/google-play-badge.png',
                  alt: 'Get it on Google Play',
                  width: 150,
                  height: 44,
                }),
              }),
            ],
          }),
        ],
      });
    }
    var j = a.i(95774);
    a.s(
      [
        'default',
        0,
        function () {
          return (0, b.jsxs)(b.Fragment, {
            children: [
              (0, b.jsx)(c.default, {}),
              (0, b.jsxs)('main', {
                children: [
                  (0, b.jsx)(e, {}),
                  (0, b.jsx)(h, {}),
                  (0, b.jsx)(i, {}),
                ],
              }),
              (0, b.jsx)(j.default, {}),
            ],
          });
        },
      ],
      60168,
    );
  },
  28004,
  a => {
    a.n(a.i(60168));
  },
];

//# sourceMappingURL=%5Broot-of-the-server%5D__03l0~zv._.js.map
