/**
 * React DOM stub for React Native
 *
 * This file provides a minimal stub for react-dom to satisfy
 * peer dependency requirements from @clerk/clerk-react.
 * react-dom is web-only and not used in React Native.
 */

// Stub functions that match react-dom's API surface
const stub = {
  // Common react-dom exports that might be referenced
  render: () => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('react-dom is not available in React Native');
    }
    return null;
  },
  hydrate: () => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('react-dom is not available in React Native');
    }
    return null;
  },
  createPortal: children => children,
  findDOMNode: () => null,
  unmountComponentAtNode: () => false,
  version: '19.2.3-stub',
};

// Support both CommonJS and ES module imports
module.exports = stub;
module.exports.default = stub;
