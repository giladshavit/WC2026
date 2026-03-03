/**
 * Makes the white background of trophy.png transparent using flood-fill from corners.
 * Preserves white elements inside the trophy (e.g. continents on the globe).
 *
 * Run: npm run make-trophy-transparent
 * Requires: npm install jimp --save-dev
 */

const Jimp = require('jimp');
const path = require('path');

const INPUT = path.join(__dirname, '../assets/trophy.png');
const OUTPUT = path.join(__dirname, '../assets/trophy.png');

const WHITE_THRESHOLD = 248;

async function main() {
  const img = await Jimp.read(INPUT);
  const { width, height } = img.bitmap;

  const getColor = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return null;
    const idx = (width * y + x) << 2;
    const r = img.bitmap.data[idx];
    const g = img.bitmap.data[idx + 1];
    const b = img.bitmap.data[idx + 2];
    const a = img.bitmap.data[idx + 3];
    return { r, g, b, a };
  };

  const isWhite = (x, y) => {
    const c = getColor(x, y);
    if (!c) return false;
    return c.r >= WHITE_THRESHOLD && c.g >= WHITE_THRESHOLD && c.b >= WHITE_THRESHOLD;
  };

  const setTransparent = (x, y) => {
    const idx = (width * y + x) << 2;
    img.bitmap.data[idx + 3] = 0;
  };

  const visited = new Set();
  const queue = [];

  for (let x = 0; x < width; x++) {
    if (isWhite(x, 0)) queue.push([x, 0]);
    if (isWhite(x, height - 1)) queue.push([x, height - 1]);
  }
  for (let y = 0; y < height; y++) {
    if (isWhite(0, y)) queue.push([0, y]);
    if (isWhite(width - 1, y)) queue.push([width - 1, y]);
  }

  const key = (x, y) => `${x},${y}`;

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (visited.has(key(x, y))) continue;
    visited.add(key(x, y));
    setTransparent(x, y);

    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (isWhite(nx, ny) && !visited.has(key(nx, ny))) {
        queue.push([nx, ny]);
      }
    }
  }

  await img.writeAsync(OUTPUT);
  console.log('Done. trophy.png background is now transparent.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
