const { getDefaultConfig } = require('@expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// 1) Only watch project folder
config.watchFolders = [projectRoot];

// 2) Add custom asset and source extensions
config.resolver.assetExts.push('bin', 'json', 'tflite', 'csv', 'xml', 'txt');
config.resolver.sourceExts.push('cjs', 'mjs');

// 3) Exclude bird images directory from bundling (images now downloaded from GitHub)
config.resolver.blockList = [
  /assets\/images\/birds\/.*/
];

module.exports = config;