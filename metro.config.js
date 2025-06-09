const { getDefaultConfig } = require('@expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// 1) Only watch project folder
config.watchFolders = [projectRoot];

// 2) Add custom asset and source extensions
config.resolver.assetExts.push('bin', 'json', 'tflite', 'csv', 'xml');
config.resolver.sourceExts.push('cjs', 'mjs');

// 3) Redirect react-native-fs to expo-file-system
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-fs': require.resolve('expo-file-system'),
};

module.exports = config;