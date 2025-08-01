// src/utils/coords.js
export function toCanvasCoords(canvas, clientX, clientY) {
  const { left, top, width, height } = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / width;
  const scaleY = canvas.height / height;
  return {
    x: (clientX - left) * scaleX,
    y: (clientY - top ) * scaleY,
  };
}
