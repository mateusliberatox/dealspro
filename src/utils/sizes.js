const CLOTHING_MAP = {
  xs: 'XS', s: 'S', m: 'M', l: 'L',
  xl: 'XL', xxl: 'XXL', xxxl: 'XXXL',
  '2xl': 'XXL', '3xl': 'XXXL', '4xl': '4XL', '5xl': '5XL',
};

// Letter sizes (clothing)
const CLOTHING_RE = /^(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|5xl)$/i;

// Numeric sizes — covers EU shoes (34-50), BR/EU clothing (34-60), US shoes (4-15)
// Accepts whole numbers and .5 halves
const NUMERIC_SIZE_RE = /^([4-9]|1[0-5]|3[4-9]|4[0-9]|5[0-9]|60)(\.5)?$/;

/**
 * Parses a raw SKU/variant text block and returns normalised sizes.
 * Handles common delimiters and Chinese label prefixes (颜色:, 尺寸:, etc.)
 */
export function parseSizes(rawText) {
  if (!rawText) return [];

  const tokens = rawText
    .replace(/[;；，、/\\|]/g, ',')
    .split(',')
    .flatMap((t) => {
      // Strip "颜色:" / "尺寸:" / "Size:" type prefixes then split remaining
      const stripped = t.trim().replace(/^[^:：]+[:：]/, '').trim();
      // Also handle slash-separated lists within a token e.g. "S/M/L"
      return stripped.split(/[/\\]/).map((x) => x.trim());
    })
    .filter(Boolean);

  const found = new Set();

  for (const token of tokens) {
    if (CLOTHING_RE.test(token)) {
      found.add(CLOTHING_MAP[token.toLowerCase()] ?? token.toUpperCase());
    } else if (NUMERIC_SIZE_RE.test(token)) {
      found.add(token);
    }
  }

  return [...found];
}
