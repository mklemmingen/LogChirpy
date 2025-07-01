# Build Exclusions Configuration

This document tracks the exclusions configured to reduce bundle size after implementing GitHub-hosted bird images.

## Files Modified

### 1. `metro.config.js`
Added `blockList` to exclude `assets/images/birds/` from Metro bundling:
```javascript
config.resolver.blockList = [
  /assets\/images\/birds\/.*/
];
```

### 2. `.easignore` 
Added bird images directory to EAS build exclusions:
```
# Bird images directory (now downloaded from GitHub)
assets/images/birds
```

### 3. `app.config.ts`
Updated `assetBundlePatterns` to exclude bird images:
```javascript
assetBundlePatterns: [
  "assets/fonts/**/*",
  "assets/images/**/*",
  "!assets/images/birds/**/*", // Exclude bird images (downloaded from GitHub)
  // ... other patterns
],
```

## Impact

- **Bundle Size Reduction**: Approximately 9,331+ bird images (estimated 100-500MB) excluded from builds
- **Runtime Behavior**: Images downloaded from GitHub during app initialization instead
- **Development**: Images still present in development for generator scripts
- **Compatibility**: Both EAS builds and local builds exclude the directory

## Notes

- Bird images remain in the repository for development scripts
- Download progress tracked in loading screen with dual progress bars
- Network connectivity check prevents download failures
- Graceful fallback when images unavailable