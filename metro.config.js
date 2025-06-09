const { getDefaultConfig } = require('@expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// 1) Only watch project folder
config.watchFolders = [projectRoot];

// 2) Add custom asset and source extensions
config.resolver.assetExts.push('bin', 'json', 'tflite', 'csv', 'xml');
config.resolver.sourceExts.push('cjs', 'mjs');

module.exports = config;