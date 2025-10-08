#!/usr/bin/env node

/**
 * CreativeBridge Android Icon Generator
 *
 * This script generates placeholder app icons for Android development.
 * For production, replace with your actual app icon design.
 *
 * Usage: node scripts/generate-android-icons.js
 *
 * Prerequisites:
 * - Node.js installed
 * - sharp package (optional): npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.log(
    '📦 Sharp not installed. SVG files will be generated for manual conversion.',
  );
}

const ANDROID_ICON_SIZES = [
  { density: 'mdpi', size: 48, description: 'Medium density (~160dpi)' },
  { density: 'hdpi', size: 72, description: 'High density (~240dpi)' },
  { density: 'xhdpi', size: 96, description: 'Extra high density (~320dpi)' },
  {
    density: 'xxhdpi',
    size: 144,
    description: 'Extra extra high density (~480dpi)',
  },
  {
    density: 'xxxhdpi',
    size: 192,
    description: 'Extra extra extra high density (~640dpi)',
  },
];

const BRAND_COLORS = {
  primary: '#4A65F2',
  secondary: '#6B73FF',
  accent: '#9C88FF',
  background: '#F8F9FA',
  text: '#2D3436',
};

async function createAndroidIcon(size, outputPath, isRound = false) {
  const cornerRadius = isRound ? size / 2 : size * 0.125; // Round icons are circular

  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${
        BRAND_COLORS.primary
      };stop-opacity:1" />
      <stop offset="100%" style="stop-color:${
        BRAND_COLORS.secondary
      };stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#00000020"/>
    </filter>
  </defs>
  
  <!-- Background shape -->
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#grad)" filter="url(#shadow)"/>
  
  <!-- Icon content -->
  <g transform="translate(${size / 2}, ${size / 2})">
    <!-- Book spine -->
    <rect x="-${size * 0.15}" y="-${size * 0.2}" width="${
    size * 0.05
  }" height="${size * 0.4}" fill="white" opacity="0.9"/>
    
    <!-- Book pages -->
    <rect x="-${size * 0.1}" y="-${size * 0.18}" width="${
    size * 0.25
  }" height="${size * 0.36}" fill="white" rx="${size * 0.02}"/>
    
    <!-- Bridge arch -->
    <path d="M -${size * 0.2} ${size * 0.05} Q 0 -${size * 0.1} ${size * 0.2} ${
    size * 0.05
  }" 
          stroke="white" stroke-width="${
            size * 0.03
          }" fill="none" stroke-linecap="round"/>
    
    <!-- Bridge pillars -->
    <rect x="-${size * 0.18}" y="${size * 0.05}" width="${
    size * 0.02
  }" height="${size * 0.08}" fill="white" rx="${size * 0.01}"/>
    <rect x="${size * 0.16}" y="${size * 0.05}" width="${
    size * 0.02
  }" height="${size * 0.08}" fill="white" rx="${size * 0.01}"/>
    
    <!-- Creative sparkles -->
    <circle cx="-${size * 0.05}" cy="-${size * 0.25}" r="${
    size * 0.015
  }" fill="white" opacity="0.8"/>
    <circle cx="${size * 0.08}" cy="-${size * 0.28}" r="${
    size * 0.01
  }" fill="white" opacity="0.6"/>
    <circle cx="${size * 0.15}" cy="-${size * 0.15}" r="${
    size * 0.012
  }" fill="white" opacity="0.7"/>
  </g>
</svg>`;

  if (sharp) {
    await sharp(Buffer.from(svg)).png().toFile(outputPath);
  } else {
    fs.writeFileSync(outputPath.replace('.png', '.svg'), svg);
  }
}

async function createSplashScreen(outputPath) {
  const width = 1080;
  const height = 1920;

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${
        BRAND_COLORS.background
      };stop-opacity:1" />
      <stop offset="50%" style="stop-color:#E8F0FF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:${
        BRAND_COLORS.primary
      };stop-opacity:0.1" />
    </linearGradient>
    
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
  
  <!-- Main content centered -->
  <g transform="translate(${width / 2}, ${height / 2})">
    <!-- App icon -->
    <g transform="translate(0, -150)">
      <circle r="80" fill="url(#grad)" filter="url(#glow)"/>
      <text font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle" dy="0.35em">CB</text>
    </g>
    
    <!-- App name -->
    <text font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="${
      BRAND_COLORS.primary
    }" text-anchor="middle" dy="0em">CreativeBridge</text>
    
    <!-- Tagline -->
    <text font-family="Arial, sans-serif" font-size="18" fill="${
      BRAND_COLORS.text
    }" text-anchor="middle" dy="40">Where Stories Come Alive</text>
    
    <!-- Loading indicator area -->
    <g transform="translate(0, 120)">
      <rect x="-100" y="-2" width="200" height="4" rx="2" fill="${
        BRAND_COLORS.primary
      }" opacity="0.2"/>
      <rect x="-100" y="-2" width="60" height="4" rx="2" fill="${
        BRAND_COLORS.primary
      }">
        <animateTransform 
          attributeName="transform" 
          type="translate" 
          values="-100,0; 140,0; -100,0" 
          dur="2s" 
          repeatCount="indefinite"/>
      </rect>
    </g>
    
    <!-- Decorative elements -->
    <circle cx="-200" cy="-300" r="3" fill="${
      BRAND_COLORS.accent
    }" opacity="0.6"/>
    <circle cx="180" cy="-280" r="2" fill="${
      BRAND_COLORS.secondary
    }" opacity="0.5"/>
    <circle cx="-150" cy="250" r="4" fill="${
      BRAND_COLORS.primary
    }" opacity="0.4"/>
    <circle cx="220" cy="200" r="2.5" fill="${
      BRAND_COLORS.accent
    }" opacity="0.6"/>
  </g>
</svg>`;

  if (sharp) {
    await sharp(Buffer.from(svg)).png().toFile(outputPath);
  } else {
    fs.writeFileSync(outputPath.replace('.png', '.svg'), svg);
  }
}

async function generateAndroidAssets() {
  console.log('🤖 Generating CreativeBridge Android Assets...\n');

  const resPath = path.join(__dirname, '../android/app/src/main/res');

  // Generate app icons for each density
  console.log('📱 Creating Android app icons:');

  for (const iconConfig of ANDROID_ICON_SIZES) {
    const mipmapDir = path.join(resPath, `mipmap-${iconConfig.density}`);

    // Ensure directory exists
    fs.mkdirSync(mipmapDir, { recursive: true });

    // Generate regular icon
    const regularIconPath = path.join(mipmapDir, 'ic_launcher.png');
    await createAndroidIcon(iconConfig.size, regularIconPath, false);
    console.log(
      `✅ ic_launcher.png (${iconConfig.size}x${iconConfig.size}) - ${iconConfig.description}`,
    );

    // Generate round icon (Android 7.1+)
    const roundIconPath = path.join(mipmapDir, 'ic_launcher_round.png');
    await createAndroidIcon(iconConfig.size, roundIconPath, true);
    console.log(
      `✅ ic_launcher_round.png (${iconConfig.size}x${iconConfig.size}) - ${iconConfig.description} [Round]`,
    );
  }

  // Create splash screen
  console.log('\n🚀 Creating splash screen:');
  const splashDir = path.join(resPath, 'drawable');
  fs.mkdirSync(splashDir, { recursive: true });

  const splashPath = path.join(splashDir, 'splash_screen.png');
  await createSplashScreen(splashPath);
  console.log('✅ splash_screen.png (1080x1920) - Android splash screen');

  // Create adaptive icon XML (Android 8.0+)
  const adaptiveIconXML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>`;

  // Create adaptive icon directory and files
  const adaptiveIconDir = path.join(resPath, 'mipmap-anydpi-v26');
  fs.mkdirSync(adaptiveIconDir, { recursive: true });

  fs.writeFileSync(
    path.join(adaptiveIconDir, 'ic_launcher.xml'),
    adaptiveIconXML,
  );
  fs.writeFileSync(
    path.join(adaptiveIconDir, 'ic_launcher_round.xml'),
    adaptiveIconXML,
  );

  // Create color resources
  const colorsXML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BRAND_COLORS.primary}</color>
    <color name="splash_background">${BRAND_COLORS.background}</color>
    <color name="brand_primary">${BRAND_COLORS.primary}</color>
    <color name="brand_secondary">${BRAND_COLORS.secondary}</color>
    <color name="brand_accent">${BRAND_COLORS.accent}</color>
</resources>`;

  const colorsPath = path.join(resPath, 'values', 'colors.xml');
  fs.writeFileSync(colorsPath, colorsXML);
  console.log('✅ colors.xml - Brand colors for Android');

  // Create splash theme
  const splashThemeXML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="SplashTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="android:windowBackground">@drawable/splash_screen</item>
        <item name="android:statusBarColor">@color/brand_primary</item>
        <item name="android:navigationBarColor">@color/brand_primary</item>
        <item name="android:windowLightStatusBar">false</item>
    </style>
</resources>`;

  const stylesPath = path.join(resPath, 'values', 'splash_styles.xml');
  fs.writeFileSync(stylesPath, splashThemeXML);
  console.log('✅ splash_styles.xml - Splash screen theme');

  // Create instructions
  const instructionsPath = path.join(
    __dirname,
    '../ANDROID_ICON_INSTRUCTIONS.md',
  );
  const instructions = `# CreativeBridge Android Icons & Assets

## 🤖 Generated Android Assets

This script has generated placeholder assets for the CreativeBridge Android app.

### App Icons Created:
${ANDROID_ICON_SIZES.map(
  config => `- **mipmap-${config.density}/ic_launcher.png** (${config.size}×${config.size}px) - ${config.description}
- **mipmap-${config.density}/ic_launcher_round.png** (${config.size}×${config.size}px) - ${config.description} [Round]`,
).join('\n')}

### Additional Assets:
- **drawable/splash_screen.png** (1080×1920px) - Splash screen background
- **values/colors.xml** - Brand color definitions
- **values/splash_styles.xml** - Splash screen theme
- **mipmap-anydpi-v26/ic_launcher.xml** - Adaptive icon configuration
- **mipmap-anydpi-v26/ic_launcher_round.xml** - Adaptive round icon configuration

## 🎨 Android Design Guidelines

### App Icon Requirements:
- **Format**: PNG-24 with alpha channel
- **Shape**: Can be any shape (Android applies mask)
- **Safe Area**: Keep important content in center 66% of icon
- **Colors**: Use brand colors consistently
- **Style**: Material Design principles

### Adaptive Icons (Android 8.0+):
- **Foreground**: 108dp × 108dp (main icon content)
- **Background**: 108dp × 108dp (solid color or simple pattern)  
- **Safe Area**: Content within 72dp × 72dp center circle
- **Animation**: Can be animated (optional)

### Splash Screen:
- **Duration**: Quick loading (< 3 seconds)
- **Content**: App branding, loading indicator
- **Colors**: Match app theme
- **Responsive**: Works across different screen sizes

## 📱 Density Buckets

| Density | DPI Range | Scale Factor |
|---------|-----------|--------------|
| mdpi    | ~160dpi   | 1.0x         |
| hdpi    | ~240dpi   | 1.5x         |
| xhdpi   | ~320dpi   | 2.0x         |
| xxhdpi  | ~480dpi   | 3.0x         |
| xxxhdpi | ~640dpi   | 4.0x         |

## 🛠 Production Recommendations

### Professional Design:
1. Create vector-based design in Illustrator/Figma
2. Export at highest resolution first (xxxhdpi)
3. Scale down for other densities
4. Test on various devices and Android versions
5. Validate with Android Asset Studio

### Testing:
- Test adaptive icon behavior across launchers
- Verify icon appears in all contexts (launcher, settings, notifications)
- Check splash screen on various screen sizes
- Validate colors in light/dark themes

### Tools:
- [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/)
- [Image Asset Studio](https://developer.android.com/studio/write/image-asset-studio) (Android Studio)
- [Adaptive Icon Generator](https://adapticon.tooo.io/)

## 🚀 Next Steps

1. Replace placeholder icons with professional designs
2. Test on Android emulators and devices
3. Update adaptive icon foreground/background as needed
4. Optimize file sizes for app bundle
5. Submit to Google Play Console

${
  !sharp
    ? `
## ⚠️ Note: SVG Files Generated

Since 'sharp' is not installed, SVG files were generated. Convert to PNG:
1. Install sharp: \`npm install sharp\`
2. Re-run: \`node scripts/generate-android-icons.js\`
3. Or convert SVGs manually using online tools
`
    : ''
}
`;

  fs.writeFileSync(instructionsPath, instructions);
  console.log(`\n📋 Android instructions saved to: ${instructionsPath}`);

  console.log('\n🎉 Android asset generation complete!');
}

if (require.main === module) {
  generateAndroidAssets().catch(console.error);
}

module.exports = { generateAndroidAssets, ANDROID_ICON_SIZES, BRAND_COLORS };
