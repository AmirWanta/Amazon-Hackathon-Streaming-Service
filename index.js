/**
 * @format
 */

// Some Fire OS runtimes (including the TV React Native fork used here) do not
// install the legacy immediate timer before React Native's LogBox is loaded.
// LogBox uses this API during startup, so install a small compatible fallback
// before requiring any React Native modules.
if (typeof global.window === 'undefined') {
  global.window = global;
}

if (typeof global.self === 'undefined') {
  global.self = global;
}

if (typeof global.setImmediate !== 'function') {
  global.setImmediate = (callback, ...args) =>
    global.setTimeout(callback, 0, ...args);
}

if (typeof global.clearImmediate !== 'function') {
  global.clearImmediate = handle => global.clearTimeout(handle);
}

const {AppRegistry} = require('react-native');
const App = require('./App').default;
const {name: appName} = require('./app.json');
// Keep startup errors visible while Fire OS compatibility is being validated.
// Do not suppress native/module initialization failures behind a blank screen.

AppRegistry.registerComponent(appName, () => App);
