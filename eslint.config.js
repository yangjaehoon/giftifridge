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
    //   app     -> may use features, shared, lib
    //   feature -> may use its own feature, shared, lib (never another feature);
    //              may reference the app route-map only as a `import type`
    //   shared  -> may use shared, lib
    //   lib     -> may use lib only
    //
    // Currently set to "warn": there is pre-existing cross-feature debt (mostly
    // gifticons <-> auth for the current-user hook, and settings buttons that
    // call gifticon services). Once those are resolved, bump this to "error".
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
    },
    rules: {
      'boundaries/dependencies': [
        'warn',
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
