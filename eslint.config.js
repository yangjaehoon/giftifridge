// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    // functions/ is a separate Node (CommonJS) package with its own runtime;
    // the Expo/React config here doesn't apply to it.
    ignores: ['dist/*', 'functions/**'],
  },
]);
