// /Users/jesse/ExpoStackNativewindTest/index.js
// Import polyfill before anything else
import './src/lib/polyfills';
import { registerRootComponent } from 'expo';

import App from './App'; // Import the App component we copied over

// register the App component as the main entry
registerRootComponent(App);
