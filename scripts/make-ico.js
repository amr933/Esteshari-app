/**
 * Esteshari – build helper: packs build/icon-<size>.png into build/icon.ico
 * © All rights reserved. Nexus Solutions
 * Run:  node scripts/make-ico.js
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'build');
const SIZES = [16, 24, 32, 48, 64, 128, 256];

const images = SIZES.map(size => {
  const file = path.join(DIR, `icon-${size}.png`);
  if (!fs.existsSync(file)) throw new Error('missing ' + file);
  return { size, data: fs.readFileSync(file) };
});

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

const entries = [];
let offset = 6 + images.length * 16;
for (const img of images) {
  const e = Buffer.alloc(16);
  e.writeUInt8(img.size >= 256 ? 0 : img.size, 0);
  e.writeUInt8(img.size >= 256 ? 0 : img.size, 1);
  e.writeUInt8(0, 2);
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(img.data.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += img.data.length;
  entries.push(e);
}

const ico = Buffer.concat([header, ...entries, ...images.map(i => i.data)]);
fs.writeFileSync(path.join(DIR, 'icon.ico'), ico);
console.log('OK -> build/icon.ico (' + ico.length + ' bytes, ' + images.length + ' sizes)');