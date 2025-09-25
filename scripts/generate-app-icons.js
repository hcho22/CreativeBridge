#!/usr/bin/env node

/**
 * CreativeBridge App Icon Generator
 * 
 * This script generates placeholder app icons for development.
 * For production, replace with your actual app icon design.
 * 
 * Usage: node scripts/generate-app-icons.js
 * 
 * Prerequisites:
 * - Node.js installed
 * - sharp package: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available (for actual PNG generation)
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.log('📦 Sharp not installed. Install with: npm install sharp');
  console.log('🎨 This script will create instructions for manual icon creation instead.');
}

const ICON_SIZES = [
  // iPhone
  { name: 'icon-20@2x.png', size: 40, description: 'iPhone Notification 20pt @2x' },
  { name: 'icon-20@3x.png', size: 60, description: 'iPhone Notification 20pt @3x' },
  { name: 'icon-29@2x.png', size: 58, description: 'iPhone Settings 29pt @2x' },
  { name: 'icon-29@3x.png', size: 87, description: 'iPhone Settings 29pt @3x' },
  { name: 'icon-40@2x.png', size: 80, description: 'iPhone Spotlight 40pt @2x' },
  { name: 'icon-40@3x.png', size: 120, description: 'iPhone Spotlight 40pt @3x' },
  { name: 'icon-60@2x.png', size: 120, description: 'iPhone App 60pt @2x' },
  { name: 'icon-60@3x.png', size: 180, description: 'iPhone App 60pt @3x' },
  
  // iPad
  { name: 'icon-20.png', size: 20, description: 'iPad Notification 20pt @1x' },
  { name: 'icon-29.png', size: 29, description: 'iPad Settings 29pt @1x' },
  { name: 'icon-40.png', size: 40, description: 'iPad Spotlight 40pt @1x' },
  { name: 'icon-76.png', size: 76, description: 'iPad App 76pt @1x' },
  { name: 'icon-76@2x.png', size: 152, description: 'iPad App 76pt @2x' },
  { name: 'icon-83.5@2x.png', size: 167, description: 'iPad Pro App 83.5pt @2x' },
  
  // App Store
  { name: 'icon-1024.png', size: 1024, description: 'App Store 1024pt @1x' }
];

const LAUNCH_IMAGES = [
  // iPhone Launch Images
  { name: 'launch-568h@2x.png', width: 640, height: 1136, description: 'iPhone 5/5s/5c/SE (1st gen)' },
  { name: 'launch-667h@2x.png', width: 750, height: 1334, description: 'iPhone 6/6s/7/8/SE (2nd/3rd gen)' },
  { name: 'launch-736h@3x.png', width: 1242, height: 2208, description: 'iPhone 6 Plus/6s Plus/7 Plus/8 Plus' },
  { name: 'launch-812h@3x.png', width: 1125, height: 2436, description: 'iPhone X/XS/11 Pro/12 mini/13 mini' },
  { name: 'launch-896h@2x.png', width: 828, height: 1792, description: 'iPhone XR/11/12/13' },
  { name: 'launch-896h@3x.png', width: 1242, height: 2688, description: 'iPhone XS Max/11 Pro Max/12 Pro Max/13 Pro Max' },
  
  // iPad Launch Images
  { name: 'launch-768x1024.png', width: 768, height: 1024, description: 'iPad Portrait @1x' },
  { name: 'launch-1024x768.png', width: 1024, height: 768, description: 'iPad Landscape @1x' },
  { name: 'launch-1536x2048.png', width: 1536, height: 2048, description: 'iPad Portrait @2x' },
  { name: 'launch-2048x1536.png', width: 2048, height: 1536, description: 'iPad Landscape @2x' }
];

const BRAND_COLORS = {
  primary: '#4A65F2',
  secondary: '#6B73FF',
  accent: '#9C88FF',
  background: '#F8F9FA',
  text: '#2D3436'
};

async function createSVGIcon(size, outputPath) {
  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${BRAND_COLORS.primary};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${BRAND_COLORS.secondary};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.3}" font-weight="bold" fill="white" text-anchor="middle" dy="0.35em">CB</text>
</svg>`;
  
  if (sharp) {
    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);
  } else {
    // Save as SVG for manual conversion
    fs.writeFileSync(outputPath.replace('.png', '.svg'), svg);
  }
}

async function createSVGLaunchImage(width, height, outputPath) {
  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${BRAND_COLORS.background};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#E8F0FF;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
  <g transform="translate(${width/2}, ${height/2})">
    <circle r="${Math.min(width, height) * 0.08}" fill="${BRAND_COLORS.primary}" opacity="0.1"/>
    <text font-family="Arial, sans-serif" font-size="${Math.min(width, height) * 0.06}" font-weight="bold" fill="${BRAND_COLORS.primary}" text-anchor="middle" dy="-0.1em">CreativeBridge</text>
    <text font-family="Arial, sans-serif" font-size="${Math.min(width, height) * 0.025}" fill="${BRAND_COLORS.text}" text-anchor="middle" dy="0.8em">Interactive Storytelling</text>
  </g>
</svg>`;
  
  if (sharp) {
    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);
  } else {
    fs.writeFileSync(outputPath.replace('.png', '.svg'), svg);
  }
}

async function generateIcons() {
  const iconsPath = path.join(__dirname, '../ios/CreativeBridge/Images.xcassets/AppIcon.appiconset');
  const launchPath = path.join(__dirname, '../ios/CreativeBridge/Images.xcassets/LaunchImage.launchimage');
  
  console.log('🎨 Generating CreativeBridge App Icons and Assets...\n');
  
  // Ensure directories exist
  fs.mkdirSync(iconsPath, { recursive: true });
  fs.mkdirSync(launchPath, { recursive: true });
  
  // Generate app icons
  console.log('📱 Creating app icons:');
  for (const icon of ICON_SIZES) {
    const filePath = path.join(iconsPath, icon.name);
    try {
      await createSVGIcon(icon.size, filePath);
      console.log(`✅ ${icon.name} (${icon.size}x${icon.size}) - ${icon.description}`);
    } catch (error) {
      console.log(`❌ Failed to create ${icon.name}: ${error.message}`);
    }
  }
  
  console.log('\n🚀 Creating launch images:');
  for (const launch of LAUNCH_IMAGES) {
    const filePath = path.join(launchPath, launch.name);
    try {
      await createSVGLaunchImage(launch.width, launch.height, filePath);
      console.log(`✅ ${launch.name} (${launch.width}x${launch.height}) - ${launch.description}`);
    } catch (error) {
      console.log(`❌ Failed to create ${launch.name}: ${error.message}`);
    }
  }
  
  // Create instructions file
  const instructionsPath = path.join(__dirname, '../ICON_INSTRUCTIONS.md');
  const instructions = `# CreativeBridge App Icons & Assets

## 📱 Generated Assets

This script has generated placeholder assets for the CreativeBridge app. For production, you should replace these with professionally designed icons.

### App Icons Created:
${ICON_SIZES.map(icon => `- **${icon.name}** (${icon.size}×${icon.size}px) - ${icon.description}`).join('\n')}

### Launch Images Created:
${LAUNCH_IMAGES.map(launch => `- **${launch.name}** (${launch.width}×${launch.height}px) - ${launch.description}`).join('\n')}

## 🎨 Design Guidelines

### App Icon Design:
- **Style**: Clean, modern, child-friendly
- **Colors**: Primary: ${BRAND_COLORS.primary}, Secondary: ${BRAND_COLORS.secondary}
- **Symbol**: Book + Bridge or Creative elements (pencil, imagination symbols)
- **Typography**: Bold, readable font for "CB" monogram
- **Corners**: Rounded (iOS will apply mask automatically)

### Launch Screen Design:
- **Background**: Gradient from ${BRAND_COLORS.background} to light blue
- **Logo**: Centered CreativeBridge wordmark
- **Tagline**: "Interactive Storytelling" or "Where Stories Come Alive"
- **Style**: Minimal, fast-loading design

## 🛠 Tools for Professional Icons

### Recommended Tools:
1. **Sketch** - Professional design tool
2. **Figma** - Free web-based design
3. **Adobe Illustrator** - Vector graphics
4. **AppIcon.co** - Online app icon generator
5. **IconKit** - macOS app icon generator

### Online Generators:
- [App Icon Generator](https://appicon.co)
- [MakeAppIcon](https://makeappicon.com)
- [Icon Slate](https://www.kodlian.com/apps/icon-slate)

## 📦 Export Requirements

### App Icons:
- **Format**: PNG (24-bit with alpha channel)
- **Color Space**: sRGB
- **Compression**: None or lossless
- **Naming**: Exact filenames as generated
- **Quality**: No artifacts or blurring

### Launch Images:
- **Format**: PNG (24-bit)
- **Orientation**: Match device orientation
- **Content**: Status bar safe area consideration
- **Performance**: Optimized file size for fast loading

## 🚀 Installation

1. Replace generated placeholder files with your designs
2. Ensure exact file names match the Contents.json
3. Test on various devices and simulators
4. Verify icons appear correctly in App Store Connect

## 🎯 Brand Colors

\`\`\`css
Primary: ${BRAND_COLORS.primary}
Secondary: ${BRAND_COLORS.secondary}
Accent: ${BRAND_COLORS.accent}
Background: ${BRAND_COLORS.background}
Text: ${BRAND_COLORS.text}
\`\`\`

${!sharp ? `
## ⚠️ Note: SVG Files Generated

Since the 'sharp' package is not installed, SVG files were generated instead of PNG files. 
To generate PNG files:

1. Install sharp: \`npm install sharp\`
2. Run this script again: \`node scripts/generate-app-icons.js\`

Or manually convert the SVG files to PNG using:
- Online converters (CloudConvert, etc.)
- Design tools (Sketch, Figma, etc.)
- Command line tools (ImageMagick, etc.)
` : ''}
`;
  
  fs.writeFileSync(instructionsPath, instructions);
  console.log(`\n📋 Instructions saved to: ${instructionsPath}`);
  
  console.log('\n🎉 Asset generation complete!');
  console.log('\n🔄 Next steps:');
  console.log('1. Review generated placeholder assets');
  console.log('2. Create professional app icon design');
  console.log('3. Replace placeholder files with final designs');
  console.log('4. Test on iOS simulator and devices');
  console.log('5. Upload to App Store Connect for review');
}

// Run the generator
if (require.main === module) {
  generateIcons().catch(console.error);
}

module.exports = { generateIcons, ICON_SIZES, LAUNCH_IMAGES, BRAND_COLORS };