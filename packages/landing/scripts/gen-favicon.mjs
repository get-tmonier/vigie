// Generates public/favicon.ico from public/favicon.svg at 16, 32, 48px.
// Uses @resvg/resvg-js (already a devDependency).
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf-8');

function renderPng(size) {
  return Buffer.from(
    new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng(),
  );
}

function buildIco(images) {
  // images = [{ size, data: Buffer }]
  const count = images.length;
  const dirSize = count * 16;
  let offset = 6 + dirSize;

  const dirs = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width  (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height (0 = 256)
    entry.writeUInt8(0, 2);                       // color count
    entry.writeUInt8(0, 3);                       // reserved
    entry.writeUInt16LE(1, 4);                    // planes
    entry.writeUInt16LE(32, 6);                   // bit depth
    entry.writeUInt32LE(data.length, 8);          // image size
    entry.writeUInt32LE(offset, 12);              // image offset
    offset += data.length;
    return entry;
  });

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: ICO
  header.writeUInt16LE(count, 4);

  return Buffer.concat([header, ...dirs, ...images.map((i) => i.data)]);
}

const images = [16, 32, 48].map((size) => ({ size, data: renderPng(size) }));
const ico = buildIco(images);

writeFileSync(new URL('../public/favicon.ico', import.meta.url), ico);
console.log('✓ favicon.ico generated (16, 32, 48px)');
