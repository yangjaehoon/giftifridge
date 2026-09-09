// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const boundaries = require('eslint-plugin-boundaries');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    // functions/ is a separate Node (CommonJS) package with its own runtime;
    // the Expo/React config here doesn't apply to it.
    ignores: ['dist/*', 'functions/**'],
  },
  {
    // Architecture boundaries: enforce the layering described in AGENTS.md.
    //   app     -> anything
    //   feature -> its own feature, shared, lib (never another feature);
    //              may reference the app route-map only as a `import type`
    //   screen  -> a *Screen.tsx file is the composition layer: it may assemble
    //              any feature (this is where feature slices meet a route)
    //   shared  -> shared, lib
    //   lib     -> lib
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/ignore': ['**/*.test.{ts,tsx}', '**/*.d.ts'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        { type: 'shared', pattern: 'src/shared' },
        { type: 'lib', pattern: 'src/lib' },
        {
          type: 'feature',
          pattern: 'src/features/*',
          capture: ['featureName'],
        },
      ],
      'boundaries/files': [
        { category: 'screen', pattern: 'src/features/*/**/*Screen.tsx' },
        { category: 'screen', pattern: 'src/features/*/**/*Screen.ts' },
      ],
    },
    rules: {
      // No import cycles between modules (incl. type-only edges) — keeps the
      // layering above from being satisfied on paper while modules still knot
      // together at runtime.
      'import/no-cycle': ['error', { ignoreExternal: true }],
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message:
            "'{{from.element.type}}' is not allowed to import '{{to.element.type}}' (see AGENTS.md folder structure)",
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: {
                to: [
                  { element: { type: 'app' } },
                  { element: { type: 'feature' } },
                  { element: { type: 'shared' } },
                  { element: { type: 'lib' } },
                ],
              },
            },
            {
              from: { element: { type: 'feature' } },
              allow: {
                to: [
                  {
                    element: {
                      type: 'feature',
                      captured: {
                        featureName: '{{from.element.captured.featureName}}',
                      },
                    },
                  },
                  { element: { type: 'shared' } },
                  { element: { type: 'lib' } },
                ],
              },
            },
            {
              // Screens need the app's route-map for typing navigation props.
              // The type carries no runtime coupling, so allow it as `import type`.
              from: { element: { type: 'feature' } },
              allow: {
                to: { element: { type: 'app' } },
                dependency: { kind: 'type' },
              },
            },
            {
              // A *Screen.tsx is the composition layer — it wires several
              // features' slices into one route, so it may import from any
              // feature. The layering rule still governs everything else
              // (components, hooks, services).
              from: { file: { categories: ['screen'] } },
              allow: {
                to: [
                  { element: { type: 'feature' } },
                  { element: { type: 'app' } },
                  { element: { type: 'shared' } },
                  { element: { type: 'lib' } },
                ],
              },
            },
            {
              from: { element: { type: 'shared' } },
              allow: {
                to: [{ element: { type: 'shared' } }, { element: { type: 'lib' } }],
              },
            },
            {
              from: { element: { type: 'lib' } },
              allow: { to: [{ element: { type: 'lib' } }] },
            },
          ],
        },
      ],
    },
  },
]);
