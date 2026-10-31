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
    // Centre on the glyph's own ink box (measured against the alphabetic baseline — measuring
    // with "middle" and drawing with "alphabetic" pushed every letter upwards), so Thai with
    // vowels / tone marks and Latin letters all sit in the middle of the face.
    x.textBaseline = "alphabetic";
    const m = x.measureText(label);
    const ascent = m.actualBoundingBoxAscent ?? fontSize * 0.72;
    const descent = m.actualBoundingBoxDescent ?? 0;
    const y = size / 2 + (ascent - descent) / 2;
    // ink spans [anchor - left, anchor + right] (textAlign is "center")
    const left = m.actualBoundingBoxLeft ?? m.width / 2;
    const right = m.actualBoundingBoxRight ?? m.width / 2;
    x.fillText(label, size / 2 + (left - right) / 2, y);
  }
  const url = c.toDataURL("image/png");
  cache.set(key, url);
  return url;
}
