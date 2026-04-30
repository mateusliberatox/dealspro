const CLOTHING_MAP = {
  xs: 'XS', s: 'S', m: 'M', l: 'L',
  xl: 'XL', xxl: 'XXL', xxxl: 'XXXL', '2xl': 'XXL', '3xl': 'XXXL',
};

const CLOTHING_RE = /^(xs|s|m|l|xl|xxl|xxxl|2xl|3xl)$/i;
const SHOE_EU_RE  = /^(3[4-9]|4[0-9]|50)$/;      // EU 34–50
const SHOE_US_RE  = /^([4-9]|1[0-5])(\.5)?$/;     // US 4–15

/**
 * Parses a raw text block (e.g. from .mn-sku) and returns normalised sizes.
 * Returns [] if nothing size-like is found.
 */
export function parseSizes(rawText) {
  if (!rawText) return [];

  // Split on common delimiters used in Chinese product listings
  const tokens = rawText
    .replace(/[;；，、/\\|]/g, ',')
    .split(',')
    .map((t) => t.trim().replace(/^.*[:：]/, '').trim()) // strip "颜色:" prefixes
    .filter(Boolean);

  const found = new Set();

  for (const token of tokens) {
    if (CLOTHING_RE.test(token)) {
      found.add(CLOTHING_MAP[token.toLowerCase()] ?? token.toUpperCase());
    } else if (SHOE_EU_RE.test(token) || SHOE_US_RE.test(token)) {
      found.add(token);
    }
  }

  return [...found];
}
