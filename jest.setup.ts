// Every themed component imports the ThemeProvider, which reads the saved theme
// preference from AsyncStorage. Give the whole suite the in-memory mock so the
// individual component tests don't each have to declare it.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
