// src/utils/assetLoader.js
const cache = new Map();
export function loadImage(path) {
  if (cache.has(path)) return cache.get(path);
  const img = new Image();
  img.src = path;
  cache.set(path, img);
  return img;
}
