// The Firestore rules suite is a plain Node test (@firebase/rules-unit-testing
// against the emulator) — it must NOT use the jest-expo preset, whose setup
// files pull in expo-modules-core ESM and whose export conditions resolve the
// firebase SDK to its browser ESM build. A bare node environment lets Jest pick
// the firebase `node`/`require` CJS entries instead; babel only has to strip TS
// types and turn `import` into `require` (Node handles the rest of the syntax).
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/firestore.rules.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'babel-jest',
      {
        configFile: false,
        babelrc: false,
        presets: ['@babel/preset-typescript'],
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      },
    ],
  },
};
