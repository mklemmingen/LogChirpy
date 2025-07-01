# Genus-Based Image Loading System - Test Suite

## Overview

This test suite validates the genus-based image loading system that replaced the monolithic `BirdImageMap.ts` to solve build memory overflow issues.

## Problem Solved

**Original Issue**: Metro bundler crashed when processing one massive file with 9,331 `require()` statements simultaneously, causing Android AAPT2 memory overflow during APK builds.

**Solution**: Split into 2,374 genus-specific TypeScript files, allowing Metro to process smaller chunks and preventing memory overflow.

## Test Files

### 1. `genusImageLoader.test.ts`
Comprehensive Jest test suite covering all aspects of the genus-based system.

**Test Categories:**
- Core System Functionality
- Image Retrieval Workflows  
- Genus Grouping Validation
- Error Handling and Edge Cases
- Performance and Memory Optimization
- Backwards Compatibility
- Data Integrity Verification
- Complete Integration Workflow

### 2. `genus-test-runner.js`
Simplified validation script that checks the implementation without requiring full test environment setup.

**Validation Points:**
- Genus file generation (2,374 files)
- Genus index structure
- Specific genus files for test birds
- Bird manifest data integrity
- Service file completeness
- Backup system verification

## Test Data

### 50 Random Test Birds
Selected from diverse genera to ensure comprehensive coverage:

```typescript
const TEST_BIRDS = [
  'Struthio camelus',           // Common Ostrich - genus: Struthio
  'Casuarius casuarius',        // Southern Cassowary - genus: Casuarius
  'Apteryx australis',          // Southern Brown Kiwi - genus: Apteryx
  'Rhea americana',             // Greater Rhea - genus: Rhea
  'Tinamus major',              // Great Tinamou - genus: Tinamus
  // ... 45 more diverse species
];
```

## Key Test Scenarios

### 1. **Backwards Compatibility**
```typescript
// These APIs must work exactly as before
const birdInfo = getBirdImage(latinName);
const imageSource = getBirdImageSource(latinName);
```

### 2. **Genus-Based Loading**
```typescript
// New efficient loading
const imageSource = await genusImageLoader.getBirdImageSource(latinName);
const syncSource = getBirdImageSourceSync(latinName); // after caching
```

### 3. **Memory Efficiency**
```typescript
// Should not load all images at once
const stats = genusImageLoader.getCacheStats();
expect(stats.loadedGenera).toBeLessThan(totalGenera);
```

### 4. **Error Handling**
```typescript
// Graceful handling of invalid inputs
const result = getBirdImage('Fakeus nonexistentus');
expect(result.found).toBe(false);
```

### 5. **Subspecies Support**
```typescript
// Subspecies should fall back to base species
const subspecies = 'Anas platyrhynchos domesticus';
const baseSpecies = 'Anas platyrhynchos';
// Should return same image
```

## Running Tests

### Quick Validation
```bash
node __tests__/genus-test-runner.js
```

### Full Test Suite
```bash
npm test __tests__/genusImageLoader.test.ts
```

### With Coverage
```bash
npm test -- --coverage __tests__/genusImageLoader.test.ts
```

## Expected Results

### ✅ Success Criteria
- All 6 validation tests pass (100% success rate)
- 2,374 genus files generated correctly
- Backwards compatibility maintained
- Memory efficiency improved
- Error handling robust
- Data integrity verified

### 📊 Performance Metrics
- **Build Memory**: Reduced from single 937KB file to 2,374 smaller files
- **Runtime Memory**: Only loads needed genera (on-demand)
- **Cache Efficiency**: Genus-based caching reduces duplicate loading
- **Load Time**: Faster initial load, progressive loading as needed

## System Architecture Validation

### File Structure
```
services/
├── genusImageLoader.ts          # New genus-based loader
├── birdImageService.ts          # Updated with genus integration
└── generated/
    ├── genusIndex.ts           # Dynamic import index
    └── genus/                  # 2,374 genus-specific files
        ├── Struthio.ts         # 2 species
        ├── Crypturellus.ts     # 21 species  
        ├── Anas.ts             # 47 species
        └── ...                 # 2,371 more
```

### API Compatibility
```typescript
// Legacy API (unchanged)
export const getBirdImageSource = (latinName: string) => any;
export const getBirdImage = (latinName: string) => BirdImageResult;

// New API (optional)
export const getBirdImageSourceAsync = (latinName: string) => Promise<any>;
export const getBirdImageSourceSync = (latinName: string) => any;
```

## Troubleshooting

### Common Issues

1. **Test Timeout**: Increase timeout for async operations
2. **Missing Genus Files**: Run `generateGenusImageMaps.js` script
3. **Cache Issues**: Clear genus cache between tests
4. **Import Errors**: Check TypeScript compilation

### Debug Commands
```bash
# Check genus file count
ls services/generated/genus/ | wc -l

# Verify genus index
cat services/generated/genusIndex.ts | head -20

# Test specific genus
node -e "console.log(require('./services/generated/genus/Struthio.js'))"
```

## Success Metrics

### Build Performance
- ✅ No more Metro bundler memory crashes
- ✅ Android APK builds complete successfully  
- ✅ Build time improved due to parallel processing

### Runtime Performance
- ✅ Faster app startup (no massive image bundle)
- ✅ Progressive loading based on usage
- ✅ Memory usage scales with accessed genera

### Developer Experience
- ✅ Backwards compatible APIs
- ✅ Optional async methods for better performance
- ✅ Clear error messages and fallbacks
- ✅ Comprehensive test coverage

## Conclusion

The genus-based image loading system successfully solves the build memory overflow issue while maintaining full backwards compatibility and improving runtime performance. The test suite ensures reliability and correctness across all use cases.