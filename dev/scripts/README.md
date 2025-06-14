# Bird Image Pipeline Scripts

This directory contains scripts for managing the bird image pipeline in LogChirpy.

## Scripts

### `generateBirdImageMap.js`

Generates a TypeScript file with hardcoded `require()` statements for all bird images to ensure they are bundled by Metro bundler.

**Features:**
- Reads `download_progress.json` to get the list of bird images
- Prefers `.webp` over `.jpg` for smaller bundle sizes
- Validates file existence before adding require statements
- Generates clean, formatted TypeScript code
- Provides detailed statistics and progress reporting

**Usage:**
```bash
node dev/scripts/generateBirdImageMap.js
```

**Output:**
- Creates `/services/generated/BirdImageMap.ts` with 5000+ require statements
- Updates bird image service to use all available images
- Enables offline access to bird images in the mobile app

### `testBirdImageService.js`

Tests the integration between the generated bird image map and the bird image service.

**Usage:**
```bash
node dev/scripts/testBirdImageService.js
```

**Tests:**
- Validates generated TypeScript structure
- Checks service integration
- Verifies specific bird images are included
- Reports coverage statistics

## Pipeline Architecture

```
download_progress.json → generateBirdImageMap.js → BirdImageMap.ts → birdImageService.ts
```

1. **Input**: `download_progress.json` (maps Latin names to filenames)
2. **Processing**: Script validates files and generates require statements
3. **Output**: `BirdImageMap.ts` with hardcoded requires for Metro bundler
4. **Integration**: Service uses generated map for image lookups

## File Locations

- **Input**: `/dev/image_getters/download_progress.json`
- **Assets**: `/assets/images/birds/`
- **Generated**: `/services/generated/BirdImageMap.ts`
- **Service**: `/services/birdImageService.ts`

## Statistics

Current pipeline status:
- **Total species**: 5,930
- **Images found**: 5,035 (85% coverage)
- **Format**: All WebP (optimized for mobile)
- **Bundle impact**: ~5,000 images included in app bundle

## Updating Images

When new bird images are downloaded:

1. The image fetcher updates `download_progress.json`
2. Run `generateBirdImageMap.js` to update the TypeScript map
3. The service automatically gains access to new images
4. No code changes required in the service layer

## Notes

- All images are bundled at build time for offline access
- WebP format preferred for smaller bundle sizes
- Missing images are handled gracefully with null returns
- TypeScript ensures type safety throughout the pipeline