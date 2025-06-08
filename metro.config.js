const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable package exports
config.resolver.unstable_enablePackageExports = false;

// Add file extensions
config.resolver.sourceExts.push('mjs', 'cjs');
config.resolver.assetExts.push('tflite', 'csv', 'xml', 'bin');

// Android view hierarchy stability fixes
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_fnames: true, // Keep function names for better native stack traces
    mangle: {
      keep_classnames: true, // Prevent class name mangling that can cause view conflicts
    },
  },
  // Enable require.context for better compatibility
  unstable_allowRequireContext: true,
};

// Platform-specific optimizations
config.resolver.platforms = ['android', 'ios', 'native', 'web'];

module.exports = config;