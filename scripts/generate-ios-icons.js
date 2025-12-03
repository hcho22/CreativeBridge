const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// App theme color
const BACKGROUND_COLOR = '#4CAF50';
const TEXT_COLOR = '#FFFFFF';

// iOS App Icon sizes needed for App Store submission
const IOS_ICON_SIZES = [
  { size: 20, scale: 1, idiom: 'ipad' },
  { size: 20, scale: 2, idiom: 'iphone' },
  { size: 20, scale: 2, idiom: 'ipad' },
  { size: 20, scale: 3, idiom: 'iphone' },
  { size: 29, scale: 1, idiom: 'ipad' },
  { size: 29, scale: 2, idiom: 'iphone' },
  { size: 29, scale: 2, idiom: 'ipad' },
  { size: 29, scale: 3, idiom: 'iphone' },
  { size: 40, scale: 1, idiom: 'ipad' },
  { size: 40, scale: 2, idiom: 'iphone' },
  { size: 40, scale: 2, idiom: 'ipad' },
  { size: 40, scale: 3, idiom: 'iphone' },
  { size: 60, scale: 2, idiom: 'iphone' },
  { size: 60, scale: 3, idiom: 'iphone' },
  { size: 76, scale: 1, idiom: 'ipad' },
  { size: 76, scale: 2, idiom: 'ipad' },
  { size: 83.5, scale: 2, idiom: 'ipad' },
  { size: 1024, scale: 1, idiom: 'ios-marketing' },
];

async function createBaseIcon(size) {
  // Create a simple icon with "CB" text on green background
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${BACKGROUND_COLOR}"/>
      <text 
        x="50%" 
        y="50%" 
        dominant-baseline="central" 
        text-anchor="middle" 
        font-family="Arial, Helvetica, sans-serif" 
        font-weight="bold" 
        font-size="${size * 0.35}px" 
        fill="${TEXT_COLOR}">CB</text>
    </svg>
  `;
  
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function generateIcons() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  const iosIconDir = path.join(__dirname, '..', 'ios', 'CreativeBridge', 'Images.xcassets', 'AppIcon.appiconset');

  // Ensure directories exist
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  if (!fs.existsSync(iosIconDir)) {
    fs.mkdirSync(iosIconDir, { recursive: true });
  }

  console.log('Generating app icons...');

  // Generate main icon for Expo (1024x1024)
  const mainIcon = await createBaseIcon(1024);
  await sharp(mainIcon).toFile(path.join(assetsDir, 'icon.png'));
  console.log('Created assets/icon.png');

  // Generate splash icon
  await sharp(mainIcon).toFile(path.join(assetsDir, 'splash.png'));
  console.log('Created assets/splash.png');

  // Generate adaptive icon for Android
  await sharp(mainIcon).toFile(path.join(assetsDir, 'adaptive-icon.png'));
  console.log('Created assets/adaptive-icon.png');

  // Generate favicon
  const favicon = await createBaseIcon(48);
  await sharp(favicon).toFile(path.join(assetsDir, 'favicon.png'));
  console.log('Created assets/favicon.png');

  // Generate iOS icons
  const images = [];
  const generatedSizes = new Set();

  for (const iconConfig of IOS_ICON_SIZES) {
    const pixelSize = Math.round(iconConfig.size * iconConfig.scale);
    const filename = `icon-${pixelSize}.png`;
    
    // Only generate each size once
    if (!generatedSizes.has(pixelSize)) {
      const icon = await createBaseIcon(pixelSize);
      await sharp(icon).toFile(path.join(iosIconDir, filename));
      generatedSizes.add(pixelSize);
      console.log(`Created iOS icon: ${filename}`);
    }

    images.push({
      filename: filename,
      idiom: iconConfig.idiom,
      scale: `${iconConfig.scale}x`,
      size: `${iconConfig.size}x${iconConfig.size}`
    });
  }

  // Create Contents.json for iOS
  const contentsJson = {
    images: images,
    info: {
      author: 'xcode',
      version: 1
    }
  };

  fs.writeFileSync(
    path.join(iosIconDir, 'Contents.json'),
    JSON.stringify(contentsJson, null, 2)
  );
  console.log('Created Contents.json');

  console.log('\nApp icons generated successfully!');
}

generateIcons().catch(console.error);

