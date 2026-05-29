const CLOTHING_MAP: Record<string, string> = {
  xs: 'XS', s: 'S', m: 'M', l: 'L',
  xl: 'XL', xxl: 'XXL', xxxl: 'XXXL',
  '2xl': 'XXL', '3xl': 'XXXL', '4xl': '4XL', '5xl': '5XL',
};

const CLOTHING_RE    = /^(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|5xl)$/i;
const NUMERIC_SIZE_RE = /^([4-9]|1[0-5]|3[4-9]|4[0-9]|5[0-9]|60)(\.5)?$/;

/**
 * Parses a raw SKU/variant text block and returns normalised sizes.
 * Handles common delimiters and Chinese label prefixes (颜色:, 尺寸:, etc.)
 */
export function parseSizes(rawText: string | null | undefined): string[] {
  if (!rawText) return [];

  const tokens = rawText
    .replace(/[;；，、/\\|]/g, ',')
    .split(',')
    .flatMap((t) => {
      const stripped = t.trim().replace(/^[^:：]+[:：]/, '').trim();
      return stripped.split(/[/\\]/).map((x) => x.trim());
    })
    .filter(Boolean);

  const found = new Set<string>();

  for (const token of tokens) {
    if (CLOTHING_RE.test(token)) {
      found.add(CLOTHING_MAP[token.toLowerCase()] ?? token.toUpperCase());
    } else if (NUMERIC_SIZE_RE.test(token)) {
      found.add(token);
    }
  }

  return [...found];
}
