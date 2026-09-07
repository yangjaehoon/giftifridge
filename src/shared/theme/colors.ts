// Two palettes with identical keys, so a style factory written against `Palette`
// renders correctly in either theme. Roles — not literal shades — are what stay
// constant: `surface` is "a card sitting on `background`", `gray900` is "primary
// body text on `surface`", `surfaceStrong` is "a high-contrast bar that stands
// against everything else" (dark chip in light mode, light chip in dark mode).
//
// Prefer `useColors()` / `useThemedStyles()` so the value follows the active
// theme. The `colors` export below is the light palette, kept for the handful
// of spots that are provably theme-independent (e.g. text drawn on the brand
// colour).

export interface Palette {
  primary: string;
  primaryBright: string;
  /** Text/icons drawn on top of the `primary` fill — near-white in both themes,
   *  because the fill itself doesn't change with the theme. */
  onPrimary: string;
  amber: string;
  amberText: string;
  danger: string;

  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceSubtle: string;
  surfaceStrong: string;
  border: string;
  shadow: string;

  gray900: string;
  gray700: string;
  gray600: string;
  gray500: string;
  gray450: string;
  gray400: string;
  gray350: string;
}

export const lightColors: Palette = {
  primary: '#2FAF9E',
  primaryBright: '#4ECDC4',
  onPrimary: '#F7FFFD',
  amber: '#F2994A',
  // Darker amber for small "please double-check this" text — the bright amber
  // above fails WCAG AA contrast at body sizes on the light backgrounds.
  amberText: '#8A5200',
  danger: '#E0554F',

  background: '#F4FAF9',
  surface: '#ffffff',
  surfaceMuted: '#E3F7F4',
  surfaceSubtle: '#E8F1EF',
  surfaceStrong: '#24302F',
  border: '#D9E8E6',
  shadow: '#000000',

  // Text on white/surface. gray900–gray450 all clear WCAG AA (>=4.5:1) for
  // body text; gray400 is for large/bold text and input placeholders; gray350
  // is decoration only (skeletons, dividers) — never text.
  gray900: '#1E2B2A',
  gray700: '#3E4D4B',
  gray600: '#4B5A58',
  gray500: '#586664',
  gray450: '#647270',
  gray400: '#7C8A87',
  gray350: '#98A4A1',
};

export const darkColors: Palette = {
  primary: '#35B7A6',
  primaryBright: '#4ECDC4',
  onPrimary: '#F7FFFD',
  amber: '#E8944A',
  // Light amber for the same "double-check this" text on dark surfaces.
  amberText: '#F0B27A',
  danger: '#F2726C',

  background: '#0F1615',
  surface: '#1A2523',
  surfaceMuted: '#22322F',
  surfaceSubtle: '#1E2A28',
  // Inverted role: a bright bar that stands out against the dark ground.
  surfaceStrong: '#E3F7F4',
  border: '#2C3B39',
  shadow: '#000000',

  // Text on `surface` (#1A2523). gray900–gray450 clear WCAG AA for body text;
  // gray400 for large/bold + placeholders; gray350 is decoration only.
  gray900: '#ECF3F1',
  gray700: '#C7D2D0',
  gray600: '#B0BCBA',
  gray500: '#94A2A0',
  gray450: '#889593',
  gray400: '#74817E',
  gray350: '#55625F',
};

/** Light palette. Use only where the colour is provably theme-independent;
 *  otherwise reach for `useColors()`. */
export const colors = lightColors;
