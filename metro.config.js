const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { getDefaultConfig: getExpoConfig } = require('@expo/metro-config');
const path = require('path');

// Get the default React Native config
const defaultConfig = getDefaultConfig(__dirname);

// Get Expo's config
const expoConfig = getExpoConfig(__dirname);

// Custom configuration
const customConfig = {
  watchFolders: [__dirname],
  resolver: {
    // Add custom asset extensions
    assetExts: [...defaultConfig.resolver.assetExts, 'bin', 'tflite', 'csv', 'xml'],
    // Add custom source extensions
    sourceExts: [...defaultConfig.resolver.sourceExts, 'cjs', 'mjs'],
    // Redirect react-native-fs to expo-file-system
    extraNodeModules: {
      'react-native-fs': require.resolve('expo-file-system'),
    },
    // Use blockList to exclude problematic directories
    blockList: (() => {
      const exclusionList = require('metro-config/src/defaults/exclusionList');
      return exclusionList([
        // PRIMARY FIX: Exclude temporary files in node_modules/.bin
        /node_modules\/\.bin\/\..*$/,
        /.*\.tmp$/,
        /.*\.temp$/,
        
        // Exclude all directories starting with underscore
        /^.*\/_.*$/,
        /_.*\/.*/,
        
        // Specific non-essential directories
        /model_conversion_env\/.*/,
        /_birdNetH5toTFlite\/.*/,
        /_birdyDex_massTranslationScripts\/.*/,
        /_deprecatedComps\/.*/,
        /_model_conversion_scripts\/.*/,
        
        // Build and cache directories
        /android\/build\/.*/,
        /android\/\.gradle\/.*/,
        /ios\/build\/.*/,
        /\.git\/.*/,
        /\.expo\/.*/,
        /dist\/.*/,
        /coverage\/.*/,
        /\.next\/.*/,
        /\.turbo\/.*/,
        
        // Node modules subdirectories
        /node_modules\/.*\/android\/.*/,
        /node_modules\/.*\/ios\/.*/,
        /node_modules\/.*\/windows\/.*/,
        /node_modules\/.*\/macos\/.*/,
        
        // File patterns to exclude
        /.*\.log$/,
        /.*\.lock$/,
        /.*\.pid$/,
        /.*\.seed$/,
        /.*\.pid\.lock$/,
        
        // Test and temporary files
        /.*\.test\.js$/,
        /.*\.spec\.js$/,
        /temp\/.*/,
        /tmp\/.*/,
        /cache\/.*/,
        
        // IDE and editor files
        /\.idea\/.*/,
        /\.vscode\/.*/,
        /\.vs\/.*/,
        
        // OS specific files
        /\.DS_Store$/,
        /Thumbs\.db$/,
        /desktop\.ini$/,
      ]);
    })(),
  },
  // Fix for the middleware error
  server: {
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        // Skip if req doesn't have required properties
        if (!req || typeof req !== 'object') {
          return next();
        }
        return middleware(req, res, next);
      };
    },
  },
};

// Merge all configs: React Native defaults -> Expo defaults -> Custom config
module.exports = mergeConfig(defaultConfig, mergeConfig(expoConfig, customConfig));