// Draw a face label (letter / short word, Thai OK) as a picture for a face.
const cache = new Map();

export function makeLabelTexture(label, { background = "#ffffff", color = "#0f172a" } = {}) {
  const key = `${label}|${background}|${color}`;
  if (cache.has(key)) return cache.get(key);
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  x.fillStyle = background;
  x.fillRect(0, 0, size, size);
  if (label) {
    x.fillStyle = color;
    x.textAlign = "center";
    x.textBaseline = "middle";
    let fontSize = 320;
    const font = (s) => `700 ${s}px "Noto Sans Thai", "Leelawadee UI", Tahoma, system-ui, sans-serif`;
    x.font = font(fontSize);
    while (fontSize > 60 && x.measureText(label).width > size * 0.8) {
      fontSize -= 10;
      x.font = font(fontSize);
    }
    // Centre on the glyph box, not the font box, so Thai and Latin both sit in the middle
    const m = x.measureText(label);
    const glyphH = (m.actualBoundingBoxAscent || fontSize * 0.7) + (m.actualBoundingBoxDescent || 0);
    const y = size / 2 + (m.actualBoundingBoxAscent ? m.actualBoundingBoxAscent - glyphH / 2 : 0);
    x.textBaseline = "alphabetic";
    x.fillText(label, size / 2, y);
  }
  const url = c.toDataURL("image/png");
  cache.set(key, url);
  return url;
}
