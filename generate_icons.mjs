import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const sizes = {
  'mipmap-mdpi': { size: 48, adaptiveSize: 108 },
  'mipmap-hdpi': { size: 72, adaptiveSize: 162 },
  'mipmap-xhdpi': { size: 96, adaptiveSize: 216 },
  'mipmap-xxhdpi': { size: 144, adaptiveSize: 324 },
  'mipmap-xxxhdpi': { size: 192, adaptiveSize: 432 },
};

const resDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');

async function generateIcons() {
  for (const [folder, dims] of Object.entries(sizes)) {
    const { size, adaptiveSize } = dims;
    const folderPath = path.join(resDir, folder);
    
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const shieldPath = `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
    
    // Shield is originally drawn in a 24x24 box. We need to scale it to `innerSize`
    const scaleForSize = (innerSize) => innerSize / 24;

    const createIconSvg = (canvasSize, isCircle, isTransparent) => {
      const padding = canvasSize * 0.25; // 25% padding on all sides (shield takes 50%)
      const innerSize = canvasSize - (padding * 2);
      const scale = scaleForSize(innerSize);
      
      const radius = isCircle ? canvasSize / 2 : canvasSize * 0.20; // 20% radius for rounded square
      
      let bg = '';
      if (!isTransparent) {
        if (isCircle) {
          bg = `<circle cx="${canvasSize/2}" cy="${canvasSize/2}" r="${radius}" fill="#0d9488" />`;
        } else {
          bg = `<rect width="${canvasSize}" height="${canvasSize}" rx="${radius}" fill="#0d9488" />`;
        }
      }

      return `
        <svg width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}" xmlns="http://www.w3.org/2000/svg">
          ${bg}
          <g transform="translate(${padding}, ${padding}) scale(${scale})">
            ${shieldPath}
          </g>
        </svg>
      `;
    };

    // ic_launcher.png (rounded square)
    await sharp(Buffer.from(createIconSvg(size, false, false))).png().toFile(path.join(folderPath, 'ic_launcher.png'));

    // ic_launcher_round.png (circle)
    await sharp(Buffer.from(createIconSvg(size, true, false))).png().toFile(path.join(folderPath, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png (transparent, icon centered taking ~60% of adaptive size)
    const createAdaptiveFgSvg = () => {
      const fgPadding = adaptiveSize * 0.20; 
      const fgInnerSize = adaptiveSize - (fgPadding * 2);
      const scale = scaleForSize(fgInnerSize);
      return `
        <svg width="${adaptiveSize}" height="${adaptiveSize}" viewBox="0 0 ${adaptiveSize} ${adaptiveSize}" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(${fgPadding}, ${fgPadding}) scale(${scale})">
            ${shieldPath}
          </g>
        </svg>
      `;
    };
    await sharp(Buffer.from(createAdaptiveFgSvg())).png().toFile(path.join(folderPath, 'ic_launcher_foreground.png'));

    console.log(`Generated fixed SVG icons for ${folder}`);
  }
}

generateIcons().catch(console.error);
