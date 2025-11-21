const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../assets/logo/logo-black.svg');
const iconPath = path.join(__dirname, '../assets/icon.png');
const adaptiveIconPath = path.join(__dirname, '../assets/adaptive-icon.png');
const faviconPath = path.join(__dirname, '../assets/favicon.png');

async function generateIcons() {
  try {
    const svgBuffer = fs.readFileSync(svgPath);

    // Generate main app icon (1024x1024) with padding
    // Resize logo to 60% of canvas size (614x614) then place on 1024x1024 canvas
    await sharp(svgBuffer)
      .resize(614, 614, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .extend({
        top: 205,
        bottom: 205,
        left: 205,
        right: 205,
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(iconPath);

    console.log('Generated icon.png (1024x1024)');

    // Generate adaptive icon (1024x1024) with padding
    await sharp(svgBuffer)
      .resize(614, 614, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .extend({
        top: 205,
        bottom: 205,
        left: 205,
        right: 205,
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(adaptiveIconPath);

    console.log('Generated adaptive-icon.png (1024x1024)');

    // Generate favicon (48x48) with padding
    await sharp(svgBuffer)
      .resize(30, 30, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .extend({
        top: 9,
        bottom: 9,
        left: 9,
        right: 9,
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(faviconPath);

    console.log('Generated favicon.png (48x48)');

    console.log('App icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
