// Per-field OCR logging for the add-form and gallery-import flows: it makes a
// mis-filled field traceable to the parser that produced it without stepping
// through each module. On in a dev build, off under tests so the suite output
// stays readable, and stripped entirely from a release build.
const enabled = __DEV__ && process.env.NODE_ENV !== 'test';

export function ocrDebugLog(label: string, detail: Record<string, unknown>): void {
  if (enabled) console.log(`[OCR] ${label}`, detail);
}
