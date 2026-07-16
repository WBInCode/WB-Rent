// Generates favicon PNGs + PWA icons from public/favicon.svg (uses sharp from devDependencies)
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svgPath = path.join(__dirname, 'public', 'favicon.svg');
const svgBuffer = fs.readFileSync(svgPath);

const outputs = [
  { file: 'favicon-16x16.png', size: 16 },
  { file: 'favicon-32x32.png', size: 32 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
];

(async () => {
  for (const { file, size } of outputs) {
    const outPath = path.join(__dirname, 'public', file);
    await sharp(svgBuffer, { density: 300 })
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`✅ ${file} (${size}x${size})`);
  }
})().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
