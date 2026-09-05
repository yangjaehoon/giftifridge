import { registerRootComponent } from 'expo';

// Must run in the JS bundle's global scope on every launch — including a
// headless one the OS wakes up to run the gallery-import background task —
// so TaskManager.defineTask has a chance to run before the task fires.
import './src/features/gifticons/services/galleryImportTask';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
