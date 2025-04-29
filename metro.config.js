const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('bin'); // allow .bin files
config.resolver.assetExts.push('json'); // allow model.json files

config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'react-native-fs': require.resolve('expo-file-system'),
};

module.exports = config;
