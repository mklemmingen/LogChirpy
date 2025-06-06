const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable package exports
config.resolver.unstable_enablePackageExports = false;

// Add file extensions
config.resolver.sourceExts.push('mjs', 'cjs');
config.resolver.assetExts.push('tflite', 'csv', 'xml', 'bin');

module.exports = config;