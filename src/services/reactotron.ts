import { NativeModules } from 'react-native';
import Reactotron from 'reactotron-react-native';

let reactotron: typeof Reactotron;

if (__DEV__) {
  // Get the device's local IP for Android development
  const host = NativeModules.SourceCode?.scriptURL
    ? NativeModules.SourceCode.scriptURL
        .split('://')[1]
        .split('/')[0]
        .split(':')[0]
    : 'localhost';

  reactotron = Reactotron.configure({
    name: 'CreativeBridge',
    host, // Use detected host or fallback to localhost for iOS simulator
  })
    .useReactNative({
      asyncStorage: false, // if you use @react-native-async-storage/async-storage, disable this
      networking: {
        // optionally, you can turn it off with false.
        ignoreUrls: /symbolicate/,
      },
      editor: false, // there are more options to editor
      errors: { veto: _stackFrame => false }, // or turn it off with false
      overlay: false, // just turning off overlay
    })
    .connect();

  // Clear Reactotron on load
  reactotron.clear?.();

  console.log('Reactotron configured and connected');
} else {
  // Production-safe mock for Reactotron
  reactotron = {
    log: () => {},
    warn: () => {},
    error: () => {},
    display: () => {},
    clear: () => {},
    connect: () => {},
    configure: () => reactotron,
    useReactNative: () => reactotron,
  } as any;
}

// Export the configured instance
export default reactotron;

// Augment console to send logs to Reactotron in development
if (__DEV__) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    reactotron.log?.(args.join(' '));
    originalLog(...args);
  };

  console.warn = (...args: unknown[]) => {
    reactotron.warn?.(args.join(' '));
    originalWarn(...args);
  };

  console.error = (...args: unknown[]) => {
    reactotron.error?.(args.join(' '), '');
    originalError(...args);
  };
}
