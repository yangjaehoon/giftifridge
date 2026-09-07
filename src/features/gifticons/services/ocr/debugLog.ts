// Per-field OCR logging for the add-form and gallery-import flows: it makes a
// mis-filled field traceable to the parser that produced it without stepping
// through each module. On in a dev build, off under tests so the suite output
// stays readable, and stripped entirely from a release build.
const enabled = __DEV__ && process.env.NODE_ENV !== 'test';

export function ocrDebugLog(label: string, detail: Record<string, unknown>): void {
  if (enabled) console.log(`[OCR] ${label}`, detail);
}

interface CorpusCapture {
  text: string;
  isGifticon: boolean;
  brand?: string | null;
  category?: string | null;
  expiresAt?: string | null;
  barcode?: string | null;
  amount?: number | null;
}

const lit = (v: unknown) => (typeof v === 'string' ? `'${v.replace(/'/g, "\\'")}'` : String(v));

/**
 * One gallery-import decision rendered as a ready-to-paste ocr/gifticonCorpus
 * case. The `expect` fields are the pipeline's own guesses and MUST be checked
 * before they go in the corpus — that's the whole point: measure where it's
 * wrong.
 */
export function formatCorpusCase(c: CorpusCapture): string {
  const ocr = c.text
    .split('\n')
    .map((line) => `      ${lit(line)},`)
    .join('\n');
  const expect = [
    `isGifticon: ${c.isGifticon}`,
    c.brand != null && `brand: ${lit(c.brand)}`,
    c.category != null && `category: ${lit(c.category)}`,
    c.expiresAt != null && `expiresAt: ${lit(c.expiresAt)}`,
    c.barcode != null && `barcode: ${lit(c.barcode)}`,
    c.amount != null && `amount: ${c.amount}`,
  ]
    .filter(Boolean)
    .join(', ');
  return `  {\n    id: 'TODO',\n    ocr: [\n${ocr}\n    ].join('\\n'),\n    expect: { ${expect} },\n  },`;
}

export function captureCorpusCase(c: CorpusCapture): void {
  if (!enabled) return;
  console.log(
    `[OCR] corpus-case — verify EVERY field before pasting into gifticonCorpus.test.ts\n${formatCorpusCase(
      c,
    )}`,
  );
}
