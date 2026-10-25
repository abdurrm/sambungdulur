/** Small colour helpers: parsing, compositing, WCAG relative luminance and contrast. Pure functions. */

export type Rgba = { r: number; g: number; b: number; a: number };

/** Parses #rgb, #rrggbb, #rrggbbaa and rgb()/rgba(). */
export function parseColor(input: string): Rgba {
  const s = input.trim().toLowerCase();
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (!m) throw new Error(`Unsupported colour: ${input}`);
  const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { r, g, b, a };
}

/** `top` painted over an opaque `bottom`. */
export function over(top: string | Rgba, bottom: string | Rgba): Rgba {
  const t = typeof top === 'string' ? parseColor(top) : top;
  const b = typeof bottom === 'string' ? parseColor(bottom) : bottom;
  const mix = (x: number, y: number) => x * t.a + y * (1 - t.a);
  return { r: mix(t.r, b.r), g: mix(t.g, b.g), b: mix(t.b, b.b), a: 1 };
}

export function toHex(c: Rgba): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

/** WCAG 2 relative luminance, 0 (black) … 1 (white). */
export function luminance(c: string | Rgba): number {
  const { r, g, b } = typeof c === 'string' ? parseColor(c) : c;
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string | Rgba, b: string | Rgba): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
