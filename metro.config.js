const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('bin');
config.resolver.assetExts.push('json');
config.resolver.assetExts.push('tflite');

config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'react-native-fs': require.resolve('expo-file-system'),
};

module.exports = config;
