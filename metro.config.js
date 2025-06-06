const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

// Get the default Expo config (includes React Native defaults)
const defaultConfig = getDefaultConfig(__dirname);


// Merge default Expo config with custom config
module.exports = (() => {
  const config = defaultConfig;
  
  // Windows-specific path resolution fixes
  config.resolver.platforms = ['ios', 'android', 'native', 'web'];
  
  // Disable new exports resolution that causes issues with expo-router
  config.resolver.unstable_enablePackageExports = false;
  config.resolver.unstable_conditionNames = ['require', 'import'];

  // Windows path normalization
  const originalResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    // Fix the expo-router entry module resolution
    if (moduleName === './node_modules/expo-router/entry') {
      moduleName = 'expo-router/entry';
    }

    // Normalize Windows paths
    const normalizedModuleName = moduleName.replace(/\\/g, '/');

    return originalResolveRequest
        ? originalResolveRequest(context, normalizedModuleName, platform)
        : context.resolveRequest(context, normalizedModuleName, platform);
  };
  
  // Apply custom resolver settings
  config.resolver.assetExts.push('bin', 'json', 'tflite', 'csv', 'xml');
  config.resolver.sourceExts.push('cjs', 'mjs');
  
  // Apply custom extraNodeModules
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'react-native-fs': require.resolve('expo-file-system'),
  };
  
  // Apply custom blockList
  const exclusionList = require('metro-config/src/defaults/exclusionList');
  config.resolver.blockList = exclusionList([
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
  
  // Apply custom server middleware
  config.server = {
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        // Skip if req doesn't have required properties
        if (!req || typeof req !== 'object') {
          return next();
        }
        return middleware(req, res, next);
      };
    },
  };
  
  return config;
})();