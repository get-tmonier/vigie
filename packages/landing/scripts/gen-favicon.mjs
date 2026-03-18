// Generates favicon assets from the canonical @tmonier/tokens/assets/helm.svg source.
// Outputs: public/favicon.svg, public/logo.svg, public/logo-512.png, public/favicon.ico
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const helmSvg = new URL('../../tokens/assets/helm.svg', import.meta.url);
const svg = readFileSync(helmSvg, 'utf-8');

// Copy SVG assets
copyFileSync(helmSvg, new URL('../public/favicon.svg', import.meta.url));
copyFileSync(helmSvg, new URL('../public/logo.svg', import.meta.url));
console.log('✓ favicon.svg + logo.svg copied from @tmonier/tokens');

// PNG 512x512
const png512 = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng();
writeFileSync(new URL('../public/logo-512.png', import.meta.url), png512);
console.log('✓ logo-512.png generated (512px)');

// ICO (16, 32, 48px)
function renderPng(size) {
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng());
}

function buildIco(images) {
  const count = images.length;
  let offset = 6 + count * 16;
  const dirs = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  return Buffer.concat([header, ...dirs, ...images.map((i) => i.data)]);
}

const images = [16, 32, 48].map((size) => ({ size, data: renderPng(size) }));
writeFileSync(new URL('../public/favicon.ico', import.meta.url), buildIco(images));
console.log('✓ favicon.ico generated (16, 32, 48px)');
