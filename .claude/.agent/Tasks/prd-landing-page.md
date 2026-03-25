# PRD: CreativeBridge Landing Page

## Introduction

CreativeBridge needs a public-facing landing page to serve as the app's web presence for app discovery, App Store compliance (the privacy policy URL `https://creativebridge.app/privacy` is already referenced in store metadata), and marketing. The landing page will be a minimal launch page built with Next.js and deployed on Vercel, living in a `web/` subdirectory of the existing repository.

## Goals

- Provide a professional web presence for CreativeBridge that communicates the app's value proposition
- Satisfy App Store requirements for a privacy policy URL (`https://creativebridge.app/privacy`)
- Enable app discovery via SEO (proper meta tags, Open Graph, structured data)
- Deliver a responsive, accessible, fast-loading static site (target Lighthouse 95+ across all metrics)
- Match the CreativeBridge brand identity (green primary #4CAF50, Kaushan Script + Architects Daughter fonts)
- Deploy on Vercel with automatic builds from the `web/` subdirectory

## User Stories

### Phase 1: Project Scaffolding

---

### US-001: Initialize Next.js Project in `web/` Subdirectory

**Description:** As a developer, I need a standalone Next.js project inside `web/` so the landing page has its own dependency tree separate from the React Native app.

**Acceptance Criteria:**

- [x] `web/` directory exists at the repo root with its own `package.json`
- [x] Next.js 14+ with App Router, TypeScript, Tailwind CSS, and `src/` directory structure
- [x] `web/tsconfig.json` is standalone (does NOT extend the root RN tsconfig)
- [x] Path alias `@/*` maps to `./src/*` in `web/tsconfig.json`
- [x] Default boilerplate content is removed (clean `page.tsx`, clean `globals.css`)
- [x] `web/.gitignore` excludes `.next/` and `node_modules/`
- [x] Typecheck passes: `cd web && npx tsc --noEmit`

**Validation Test:**

```bash
# From repo root:
cd web && npm run dev
# Verify: dev server starts on localhost:3000 without errors
# Verify: browser shows a blank/minimal page (boilerplate removed)
cd web && npx tsc --noEmit
# Verify: exits with code 0, no type errors
```

---

### US-002: Configure Tailwind with CreativeBridge Design Tokens

**Description:** As a developer, I need Tailwind configured with CreativeBridge's color palette, typography, and spacing so that all components use consistent branding.

**Acceptance Criteria:**

- [x] `globals.css` `@theme` block extends Tailwind v4 with CreativeBridge colors: primary (#4CAF50), primary-dark (#388E3C), primary-light (#81C784), secondary (#2196F3), background (#fcfcfc), surface (#ffffff), text (#333333), text-secondary (#666666), border (#e0e0e0) _(Note: Tailwind v4 uses CSS-based `@theme` config instead of `tailwind.config.ts`)_
- [x] Custom font families defined: `display` (Kaushan Script), `creative` (Architects Daughter), `sans` (system-ui)
- [x] Custom border radii: `card` (12px), `button` (8px)
- [x] `globals.css` contains Tailwind v4 `@import "tailwindcss"` directive and `@theme` design tokens
- [x] Typecheck passes

**Validation Test:**

```bash
cd web && npm run build
# Verify: build succeeds, Tailwind processes all utility classes
# Verify: in globals.css, Tailwind directives are present
# Manually inspect tailwind.config.ts to confirm all design tokens match the spec above
```

---

### US-003: Set Up Google Fonts (Kaushan Script + Architects Daughter)

**Description:** As a user visiting the landing page, I should see the CreativeBridge brand fonts (Kaushan Script for headings, Architects Daughter for creative text) loaded without layout shift.

**Acceptance Criteria:**

- [x] `next/font/google` used to load Kaushan Script (weight 400) and Architects Daughter (weight 400) in `layout.tsx`
- [x] CSS variables `--font-kaushan` and `--font-architects` applied to the `<html>` element
- [x] Tailwind classes `font-display` and `font-creative` reference these CSS variables
- [x] `display: 'swap'` set on both fonts for performance
- [x] No Flash of Unstyled Text (FOUT) on page load
- [x] Typecheck passes

**Validation Test:**

```bash
cd web && npm run dev
# Verify: open browser, inspect <html> element — should have font CSS variable classes
# Verify: add a test <h1 className="font-display">Test</h1> to page.tsx
#   — confirm it renders in Kaushan Script (cursive handwritten style)
# Verify: add a test <p className="font-creative">Test</p> to page.tsx
#   — confirm it renders in Architects Daughter (handwriting style)
# Remove test elements after verification
```

---

### US-004: Copy App Assets to `web/public/`

**Description:** As a developer, I need the app icon, favicon, and store badges in `web/public/` so they can be referenced by landing page components.

**Acceptance Criteria:**

- [x] `web/public/icon.png` exists (copied from `assets/icon.png`)
- [x] `web/public/favicon.png` exists (copied from `assets/favicon.png`)
- [x] `web/public/app-store-badge.svg` exists (Apple App Store download badge)
- [x] `web/public/google-play-badge.png` exists (Google Play download badge)
- [x] Favicon is configured in `layout.tsx` metadata (references `/favicon.png`)
- [x] All images load correctly when referenced via `/icon.png`, etc.

**Validation Test:**

```bash
# Verify files exist:
ls -la web/public/icon.png web/public/favicon.png web/public/app-store-badge.svg web/public/google-play-badge.png
# Verify all four files are present and non-zero size

cd web && npm run dev
# In browser: navigate to localhost:3000/icon.png — should display the app icon
# In browser: navigate to localhost:3000/favicon.png — should display the favicon
# In browser: check browser tab — should show the favicon
```

---

### Phase 2: Layout and Chrome

---

### US-005: Build Root Layout with SEO Metadata and JSON-LD

**Description:** As a search engine crawler or social media platform, I need proper metadata so the landing page appears correctly in search results and social sharing previews.

**Acceptance Criteria:**

- [x] `layout.tsx` exports a `metadata` object with:
  - Title: "CreativeBridge - AI Story Creator | Educational Storytelling for K-12"
  - Description: "CreativeBridge is an AI-powered educational storytelling app designed for students in grades K-12. Create, continue, and illustrate stories with the help of AI."
  - Keywords: education, storytelling, AI, creative writing, kids, students, K-12
  - Open Graph: title, description, image (`/og-image.png`), url, type: website
  - Twitter card: summary_large_image
  - metadataBase: `new URL('https://creativebridge.app')`
- [x] JSON-LD `SoftwareApplication` schema embedded in layout (`<script type="application/ld+json">`) with name, applicationCategory (EducationalApplication), operatingSystem (iOS, Android), price: 0
- [x] `<html lang="en">` set for accessibility
- [x] Font CSS variables applied to `<html>` element
- [x] `globals.css` imported
- [x] Semantic `<main>` wraps page content
- [x] Typecheck passes

**Validation Test:**

```bash
cd web && npm run build
# Verify: build succeeds with no errors

cd web && npm run dev
# In browser: View Page Source (Ctrl+U / Cmd+U)
# Verify: <title> tag contains "CreativeBridge"
# Verify: <meta name="description"> is present with app description
# Verify: <meta property="og:title"> and <meta property="og:description"> are present
# Verify: <meta name="twitter:card" content="summary_large_image"> is present
# Verify: <script type="application/ld+json"> contains "SoftwareApplication"
# Verify: <html lang="en"> is set
```

---

### US-006: Build Header Component

**Description:** As a visitor, I see a sticky navigation bar at the top of the page with the app logo and a download CTA so I can always access the download section.

**Acceptance Criteria:**

- [x] `Header.tsx` component created in `src/components/`
- [x] Sticky positioning (`sticky top-0`) with white background and subtle bottom border
- [x] Left side: app icon (32x32, from `/icon.png`) + "CreativeBridge" text in `font-display` (Kaushan Script), green color
- [x] Right side: "Download" button styled with primary green background and white text
- [x] "Download" button links to `#download` (smooth scroll to AppStoreLinks section)
- [x] Responsive: works on mobile (320px+) and desktop
- [x] Semantic HTML: `<header>` with `<nav>` inside
- [x] Typecheck passes
- [x] Verify in browser using dev server

**Validation Test:**

```bash
cd web && npm run dev
# In browser at localhost:3000:
# Verify: header is visible at top of page
# Verify: app icon and "CreativeBridge" text appear on the left
# Verify: "CreativeBridge" text is in a cursive/handwritten font (Kaushan Script)
# Verify: "Download" button appears on the right with green background
# Verify: scroll down — header remains sticky at top
# Verify: resize to 375px width — header still looks correct, no overflow
# Verify: inspect HTML — <header> and <nav> tags are used
```

---

### US-007: Build Footer Component

**Description:** As a visitor, I see a footer with legal links, COPPA compliance notice, and copyright information at the bottom of the page.

**Acceptance Criteria:**

- [x] `Footer.tsx` component created in `src/components/`
- [x] Contains Privacy Policy link pointing to `/privacy`
- [x] Contains Terms of Service link (placeholder `#` href)
- [x] Contains COPPA compliance note: "CreativeBridge is committed to protecting children's privacy and complies with COPPA. Parental consent is required for users under 13."
- [x] Contains copyright: "2026 CreativeBridge. All rights reserved."
- [x] Visually distinct section (darker or contrasting background)
- [x] Semantic HTML: `<footer>` tag
- [x] Typecheck passes
- [ ] Verify in browser using dev server

**Validation Test:**

```bash
cd web && npm run dev
# In browser at localhost:3000:
# Verify: footer is visible at bottom of page
# Verify: "Privacy Policy" link exists and navigates to /privacy
# Verify: "Terms of Service" link exists
# Verify: COPPA notice text is visible (mentions "children's privacy" and "COPPA")
# Verify: copyright text shows "2026 CreativeBridge"
# Verify: inspect HTML — <footer> tag is used
```

---

### Phase 3: Page Sections

---

### US-008: Build Hero Section

**Description:** As a visitor, I immediately see the app's value proposition, a compelling headline, and clear call-to-action buttons so I understand what CreativeBridge is and how to get it.

**Acceptance Criteria:**

- [x] `Hero.tsx` component created in `src/components/`
- [x] H1 heading: "AI-Powered Storytelling for Every Student" in `font-display` (Kaushan Script), large text (text-4xl md:text-6xl), green primary color
- [x] Subheading paragraph using `font-creative` (Architects Daughter): the unique value proposition — "The only writing app that grows with students from kindergarten through high school, providing AI-powered storytelling experiences that adapt to each learner's unique needs and interests."
- [x] Brief description in system sans-serif font, text-secondary color
- [x] Two CTA buttons side-by-side:
  - Primary: "Download on iOS" — green background (#4CAF50), white text, rounded-button (8px)
  - Secondary: "Get on Android" — outlined with green border, green text, rounded-button (8px)
- [x] Both CTA buttons link to `#download` section
- [x] App icon displayed large (128-160px) with rounded corners and subtle shadow
- [x] Desktop layout: text on left, icon on right (flex-row)
- [x] Mobile layout: stacked vertically — icon on top, text below, buttons full-width
- [x] Light gradient background (white to subtle green tint)
- [x] Semantic HTML: `<section aria-label="Hero">`
- [x] Typecheck passes
- [x] Verify in browser using dev server

**Validation Test:**

```bash
cd web && npm run dev
# In browser at localhost:3000:
# Verify: hero section is the first content after header
# Verify: H1 text "AI-Powered Storytelling for Every Student" is visible in cursive font
# Verify: subheading text about "grows with students" is visible in handwriting font
# Verify: two CTA buttons are visible — one green filled, one green outlined
# Verify: app icon is displayed large with rounded corners
# Verify: at desktop width (1024px+) — text is left, icon is right
# Verify: at mobile width (375px) — icon is on top, text below, buttons stack vertically
# Verify: clicking either CTA button scrolls to the download section (or anchors to #download)
# Verify: inspect HTML — <section> with aria-label is used
```

---

### US-009: Build Features Section (6-Card Grid)

**Description:** As a visitor, I see the key features of CreativeBridge presented in an attractive card grid so I understand what makes the app valuable.

**Acceptance Criteria:**

- [x] `Features.tsx` and `FeatureCard.tsx` components created in `src/components/`
- [x] Section heading: "Why CreativeBridge?" in `font-display`, centered
- [x] Six feature cards displayed in a responsive grid:
  - Desktop (lg): 3 columns, 2 rows
  - Tablet (md): 2 columns, 3 rows
  - Mobile: 1 column, 6 rows
- [x] Each FeatureCard contains:
  - Icon (emoji or simple SVG)
  - Title (semibold)
  - Description (1-2 sentences, text-secondary)
  - Card style: white surface, 12px border radius, border, subtle shadow on hover
- [x] The six features are:
  1. Grade-Level Stories — "Stories adapt from kindergarten through high school with age-appropriate vocabulary and themes."
  2. AI-Assisted Writing — "GPT-4 powered story generation helps students develop creative writing skills."
  3. Story Illustrations — "AI-generated images bring stories to life with grade-appropriate art styles."
  4. Voice Input — "Speak your ideas and watch them transform into written stories."
  5. XP & Streaks — "Stay motivated with experience points, daily streaks, and achievements."
  6. Story Library — "Save, revisit, and export your stories anytime."
- [x] Semantic HTML: `<section aria-label="Features">` with appropriate list or article structure
- [x] Typecheck passes
- [x] Verify in browser using dev server

**Validation Test:**

```bash
cd web && npm run dev
# In browser at localhost:3000:
# Verify: "Why CreativeBridge?" heading is visible and centered
# Verify: all 6 feature cards are visible with icons, titles, and descriptions
# Verify: at desktop width (1024px+) — 3 columns of cards
# Verify: at tablet width (768px) — 2 columns of cards
# Verify: at mobile width (375px) — 1 column, cards stack vertically
# Verify: hover over a card — subtle shadow/elevation change occurs
# Verify: card content matches the 6 features listed above
# Verify: inspect HTML — <section> with aria-label is used
```

---

### US-010: Build App Store Links Section

**Description:** As a visitor who wants to download the app, I see clear App Store and Google Play download badges so I can get CreativeBridge on my device.

**Acceptance Criteria:**

- [x] `AppStoreLinks.tsx` component created in `src/components/`
- [x] Section has `id="download"` for anchor linking from Header and Hero CTAs
- [x] Centered text: "Available on iOS and Android"
- [x] Apple App Store badge and Google Play badge displayed side-by-side, centered
- [x] Each badge is a link (`<a target="_blank" rel="noopener noreferrer">`) with placeholder `href="#"` (to be updated when store URLs are available)
- [x] Badges are standard size (~135x40px or similar)
- [x] Responsive: badges stack vertically on very small screens if needed
- [x] Semantic HTML: `<section id="download" aria-label="Download">`
- [x] Typecheck passes
- [x] Verify in browser using dev server

**Validation Test:**

```bash
cd web && npm run dev
# In browser at localhost:3000:
# Verify: "Available on iOS and Android" text is visible and centered
# Verify: two download badges are displayed (App Store and Google Play)
# Verify: badges are clickable links
# Verify: inspect the badge links — they have target="_blank" and rel="noopener noreferrer"
# Verify: section has id="download"
# Verify: clicking "Download" in the header scrolls smoothly to this section
# Verify: at 375px width — badges still display properly (side-by-side or stacked)
```

---

### US-011: Compose Landing Page

**Description:** As a visitor, I see a complete, polished landing page with all sections flowing together in a cohesive layout.

**Acceptance Criteria:**

- [x] `page.tsx` composes all components in order: Header, Hero, Features, AppStoreLinks, Footer
- [x] Sections flow naturally with appropriate vertical spacing between them
- [x] Page is fully static (SSG) — no client-side data fetching or dynamic rendering
- [x] Smooth scroll behavior enabled for anchor links (`scroll-behavior: smooth` in CSS or `html { scroll-behavior: smooth }`)
- [x] No horizontal overflow at any viewport width
- [x] Typecheck passes
- [ ] Verify in browser using dev server

**Validation Test:**

```bash
cd web && npm run dev
# In browser at localhost:3000:
# Verify: all sections appear in order — Header, Hero, Features, App Store Links, Footer
# Verify: scroll through entire page — no broken layouts, no horizontal scrollbar
# Verify: clicking "Download" CTA in header/hero smoothly scrolls to the download section
# Verify: adequate spacing between each section (not cramped, not overly spaced)
# Verify: page looks cohesive — colors, fonts, and spacing are consistent throughout

cd web && npm run build
# Verify: build output shows the page was statically generated (SSG)
# Verify: no "Dynamic" pages in the build output — all should be "Static" or "SSG"
```

---

### Phase 4: Privacy Page

---

### US-012: Build Privacy Policy Page

**Description:** As a visitor (or App Store reviewer), I can access a privacy policy page at `/privacy` that outlines CreativeBridge's data practices and COPPA commitments.

**Acceptance Criteria:**

- [x] `app/privacy/page.tsx` created
- [x] Page reuses Header and Footer components
- [x] Page heading: "Privacy Policy" (H1)
- [x] Contains placeholder privacy policy content with key COPPA commitments in bullet points:
  - No collection of personal information from children under 13 without verifiable parental consent
  - Parents/guardians can review, delete, or refuse further collection of their child's data
  - Data collected is used solely for providing the educational storytelling experience
  - No behavioral advertising or third-party ad networks
  - No social features or user-to-user communication for users under 13
  - Data retention and deletion policies
- [x] "Last updated" date displayed
- [x] Page is accessible at `/privacy` route
- [x] Page has its own metadata (title: "Privacy Policy | CreativeBridge")
- [x] Semantic HTML: proper heading hierarchy, `<article>` or `<section>` for content
- [x] Typecheck passes
- [x] Verify in browser using dev server

**Validation Test:**

```bash
cd web && npm run dev
# In browser: navigate to localhost:3000/privacy
# Verify: page loads without errors
# Verify: Header and Footer are present (same as landing page)
# Verify: "Privacy Policy" heading is visible
# Verify: COPPA-related bullet points are present (mentions "children under 13", "parental consent")
# Verify: "Last updated" date is displayed
# Verify: click "Privacy Policy" link in the footer — navigates to this page
# Verify: View Page Source — <title> contains "Privacy Policy | CreativeBridge"

cd web && npx tsc --noEmit
# Verify: no type errors
```

---

### Phase 5: Polish and Verification

---

### US-013: Responsive Design Verification

**Description:** As a visitor on any device, I see a properly laid out landing page that adapts gracefully across mobile, tablet, and desktop viewports.

**Acceptance Criteria:**

- [x] Mobile (375px): all content single-column, buttons full-width, text readable, no horizontal scroll
- [x] Tablet (768px): features grid 2-column, hero has adequate spacing
- [x] Desktop (1024px+): features grid 3-column, hero side-by-side layout (text left, icon right)
- [x] Large desktop (1440px+): content contained within max-width, centered
- [x] No content overflow or clipping at any breakpoint (overflow-x: hidden on body)
- [x] Touch targets are at least 44x44px on mobile (min-h-[44px] on all interactive elements)
- [x] Text is readable at all sizes (minimum 16px body text on mobile)

**Validation Test:**

```bash
cd web && npm run dev
# In Chrome DevTools responsive mode:
# Test at 375px (iPhone SE): verify single-column layout, no overflow
# Test at 768px (iPad): verify 2-column feature grid
# Test at 1024px (laptop): verify 3-column feature grid, hero side-by-side
# Test at 1440px (desktop): verify content is centered, not stretched edge-to-edge
# At each breakpoint: verify no horizontal scrollbar appears
# At 375px: verify buttons are finger-tap friendly (visually at least ~44px tall)
```

---

### US-014: Accessibility Verification

**Description:** As a visitor using assistive technology, I can navigate and understand the landing page with keyboard and screen readers.

**Acceptance Criteria:**

- [x] All interactive elements (links, buttons) are keyboard-focusable and have visible focus indicators
- [x] Tab order follows visual order (Header > Hero CTAs > Features > Download badges > Footer links)
- [x] All images have descriptive `alt` text
- [x] Semantic HTML used throughout (header, nav, main, section with aria-labels, footer)
- [x] Color contrast meets WCAG AA: use #388E3C (dark green) for small text on white; #4CAF50 only for large/bold text and decorative elements
- [x] No information conveyed by color alone
- [x] Page language set (`<html lang="en">`)

**Validation Test:**

```bash
cd web && npm run dev
# Keyboard navigation test:
# Press Tab from top of page — verify focus moves through:
#   Download button (header) > iOS CTA > Android CTA > feature cards (if links) > App Store badge > Google Play badge > Privacy Policy > Terms of Service
# Verify: all focused elements have a visible outline/ring

# Screen reader test (macOS VoiceOver: Cmd+F5):
# Verify: page title is announced
# Verify: headings are announced (H1, section headings)
# Verify: images have alt text announced
# Verify: buttons/links have clear labels

# Contrast check:
# Inspect small body text — should use #333333 or #388E3C on white (not #4CAF50)
# Inspect button text — white on #4CAF50 is acceptable for large/bold text
```

---

### US-015: Build Verification and Production Readiness

**Description:** As a developer, I need to confirm that the site builds successfully as a static site, passes all linting and type checks, and is ready for Vercel deployment.

**Acceptance Criteria:**

- [x] `npm run build` succeeds with zero errors in `web/`
- [x] `npx tsc --noEmit` passes with zero type errors in `web/`
- [x] `npm run lint` passes in `web/` (or only has acceptable warnings)
- [x] Build output confirms all pages are statically generated (no dynamic/server pages)
- [x] Build output includes both `/` and `/privacy` routes
- [x] No console errors or warnings when running the production build locally (`npm run start`)
- [x] `.gitignore` properly excludes `web/.next/` and `web/node_modules/`

**Validation Test:**

```bash
cd web && npm run build
# Verify: exit code 0, no errors
# Verify: output shows Route `/` as Static
# Verify: output shows Route `/privacy` as Static

cd web && npx tsc --noEmit
# Verify: exit code 0

cd web && npm run lint
# Verify: no errors (warnings acceptable)

cd web && npm run start
# Visit localhost:3000 in browser
# Verify: page loads correctly (production build)
# Open browser console — verify no errors or warnings
# Visit localhost:3000/privacy — verify it loads correctly

# Check gitignore:
cat web/.gitignore | grep -E "\.next|node_modules"
# Verify: both .next and node_modules are listed
```

---

## Functional Requirements

- FR-1: The landing page must be a standalone Next.js project inside `web/` with its own `package.json`, independent from the React Native app
- FR-2: Tailwind CSS must be configured with CreativeBridge design tokens (colors, fonts, border radii) matching `src/constants/theme.ts`
- FR-3: Google Fonts (Kaushan Script, Architects Daughter) must load via `next/font` with zero layout shift
- FR-4: The page must include a sticky Header with the app logo and a "Download" CTA
- FR-5: The Hero section must contain the H1, value proposition, two CTA buttons, and the app icon
- FR-6: The Features section must display 6 feature cards in a responsive grid (1/2/3 columns)
- FR-7: The App Store Links section must display iOS and Google Play download badges with `id="download"` for anchor linking
- FR-8: The Footer must include Privacy Policy link, Terms of Service link, COPPA notice, and copyright
- FR-9: A Privacy Policy page must be accessible at `/privacy` with COPPA compliance commitments
- FR-10: All pages must be statically generated (SSG) with no server-side rendering or API routes
- FR-11: SEO metadata must include title, description, keywords, Open Graph tags, Twitter card, and JSON-LD structured data
- FR-12: The site must be responsive across mobile (375px), tablet (768px), and desktop (1024px+)
- FR-13: Accessibility must meet WCAG AA standards (color contrast, semantic HTML, keyboard navigation, alt text)
- FR-14: The site must build and deploy cleanly on Vercel with root directory set to `web/`

## Non-Goals (Out of Scope)

- No analytics or tracking (Google Analytics, Mixpanel, etc.)
- No email signup, waitlist, or lead capture forms
- No CMS or blog functionality
- No dynamic content, API routes, or database connections
- No authentication or user accounts
- No shared code or dependencies between `web/` and the React Native `src/` directory
- No custom domain setup (handled separately in Vercel/DNS)
- No OG image generation (use a manually created static image)
- No animations or complex interactions beyond hover effects
- No internationalization (English only)

## Design Considerations

- **Color palette**: Primary green (#4CAF50) with dark variant (#388E3C) for accessible text. White/light gray surfaces. Blue (#2196F3) for secondary accents if needed.
- **Typography hierarchy**: Kaushan Script for H1 and section headings (display), Architects Daughter for the value proposition subheading (creative), system sans-serif for body text
- **Accessibility**: #4CAF50 on white fails WCAG AA for small text (3.0:1 ratio). Use #388E3C (4.8:1) for small body text. White on #4CAF50 is acceptable for large/bold button text.
- **Existing components to reuse**: None — this is a separate Next.js project. However, design tokens should mirror `src/constants/theme.ts` for brand consistency.
- **Assets**: Copy `assets/icon.png` and `assets/favicon.png` into `web/public/`. Do NOT symlink (Vercel doesn't resolve symlinks outside project root).

## Technical Considerations

- **Independence**: `web/` is a fully standalone project. It does not share `node_modules`, `tsconfig`, or any code with the React Native app. This avoids dependency conflicts between `react-native` and `react-dom`.
- **Static output**: All pages use Static Site Generation. No `getServerSideProps`, no API routes, no `"use client"` data fetching. This ensures maximum CDN cacheability and Vercel free-tier compatibility.
- **Font loading**: `next/font/google` handles font optimization (subsetting, preloading, CSS variables) automatically. No external `<link>` tags needed.
- **Vercel configuration**: Set root directory to `web/` in the Vercel project dashboard. No `vercel.json` file needed — Next.js is auto-detected.
- **Store badges**: Download official Apple App Store and Google Play badge SVGs/PNGs from their respective developer portals and commit to `web/public/`.

## Success Metrics

- Lighthouse Performance score: 95+
- Lighthouse Accessibility score: 95+
- Lighthouse SEO score: 100
- Build time: under 30 seconds
- Page load time (TTFB): under 100ms on Vercel edge
- All 15 user stories pass their validation tests
- Privacy policy page resolves at the URL referenced in App Store metadata

## Open Questions

- What are the actual App Store and Google Play URLs once the app is published? (placeholder `#` hrefs for now)
- Should a custom OG image be designed, or is a simple text-on-green-background sufficient for launch?
- Is `creativebridge.app` the confirmed domain, or might it change before launch?
