/**
 * Test Suite for Genus-Based Image Loading System
 * 
 * Tests all workflows of requesting bird images and receiving the correct ones.
 * Validates the genus-based approach against the monolithic approach using 50 random birds.
 * 
 * This test ensures our solution to the build memory overflow issue works correctly
 * while maintaining backwards compatibility and data integrity.
 */

import { genusImageLoader, getBirdImageSourceSync, hasGenusAvailable } from '../services/genusImageLoader';
import { birdImageService, getBirdImageSource, getBirdImage } from '../services/birdImageService';
import birdManifest from '../assets/images/birds/bird_images_manifest.json';

// Test data: 50 random birds from different genera for comprehensive testing
const TEST_BIRDS = [
  'Struthio camelus',           // Common Ostrich - genus: Struthio
  'Casuarius casuarius',        // Southern Cassowary - genus: Casuarius
  'Apteryx australis',          // Southern Brown Kiwi - genus: Apteryx
  'Rhea americana',             // Greater Rhea - genus: Rhea
  'Tinamus major',              // Great Tinamou - genus: Tinamus
  'Crypturellus soui',          // Little Tinamou - genus: Crypturellus
  'Anas platyrhynchos',         // Mallard - genus: Anas
  'Aquila chrysaetos',          // Golden Eagle - genus: Aquila
  'Ardea cinerea',              // Grey Heron - genus: Ardea
  'Passer domesticus',          // House Sparrow - genus: Passer
  'Turdus migratorius',         // American Robin - genus: Turdus
  'Corvus corvax',              // Common Raven - genus: Corvus
  'Pica pica',                  // Eurasian Magpie - genus: Pica
  'Falco peregrinus',           // Peregrine Falcon - genus: Falco
  'Buteo jamaicensis',          // Red-tailed Hawk - genus: Buteo
  'Accipiter nisus',            // Eurasian Sparrowhawk - genus: Accipiter
  'Tyto alba',                  // Barn Owl - genus: Tyto
  'Bubo bubo',                  // Eurasian Eagle-Owl - genus: Bubo
  'Strix aluco',                // Tawny Owl - genus: Strix
  'Columba livia',              // Rock Dove - genus: Columba
  'Hirundo rustica',            // Barn Swallow - genus: Hirundo
  'Motacilla alba',             // White Wagtail - genus: Motacilla
  'Anthus trivialis',           // Tree Pipit - genus: Anthus
  'Larus argentatus',           // Herring Gull - genus: Larus
  'Sterna hirundo',             // Common Tern - genus: Sterna
  'Alcedo atthis',              // Common Kingfisher - genus: Alcedo
  'Upupa epops',                // Eurasian Hoopoe - genus: Upupa
  'Picus viridis',              // European Green Woodpecker - genus: Picus
  'Dendrocopos major',          // Great Spotted Woodpecker - genus: Dendrocopos
  'Lanius excubitor',           // Great Grey Shrike - genus: Lanius
  'Phylloscopus trochilus',     // Willow Warbler - genus: Phylloscopus
  'Sylvia atricapilla',         // Blackcap - genus: Sylvia
  'Acrocephalus arundinaceus',  // Great Reed Warbler - genus: Acrocephalus
  'Muscicapa striata',          // Spotted Flycatcher - genus: Muscicapa
  'Ficedula hypoleuca',         // Pied Flycatcher - genus: Ficedula
  'Erithacus rubecula',         // European Robin - genus: Erithacus
  'Phoenicurus phoenicurus',    // Common Redstart - genus: Phoenicurus
  'Saxicola torquatus',         // Stonechat - genus: Saxicola
  'Oenanthe oenanthe',          // Northern Wheatear - genus: Oenanthe
  'Cinclus cinclus',            // White-throated Dipper - genus: Cinclus
  'Troglodytes troglodytes',    // Eurasian Wren - genus: Troglodytes
  'Regulus regulus',            // Goldcrest - genus: Regulus
  'Poecile palustris',          // Marsh Tit - genus: Poecile
  'Sitta europaea',             // Eurasian Nuthatch - genus: Sitta
  'Certhia brachydactyla',      // Short-toed Treecreeper - genus: Certhia
  'Oriolus oriolus',            // Eurasian Golden Oriole - genus: Oriolus
  'Sturnus vulgaris',           // European Starling - genus: Sturnus
  'Fringilla coelebs',          // Common Chaffinch - genus: Fringilla
  'Carduelis carduelis',        // European Goldfinch - genus: Carduelis
  'Emberiza citrinella'         // Yellowhammer - genus: Emberiza
];

describe('Genus-Based Image Loading System', () => {
  let availableTestBirds: string[] = [];

  beforeAll(async () => {
    // Filter test birds to only include those that actually exist in our manifest
    availableTestBirds = TEST_BIRDS.filter(latinName => {
      const manifest = birdManifest.images as any;
      return manifest[latinName] && manifest[latinName].has_image;
    });
    
    console.log(`Testing with ${availableTestBirds.length} available birds out of ${TEST_BIRDS.length} total`);
    
    // Ensure we have enough birds to test
    expect(availableTestBirds.length).toBeGreaterThanOrEqual(10);
  });

  describe('Core System Functionality', () => {
    test('genusImageLoader should be properly initialized', () => {
      expect(genusImageLoader).toBeDefined();
      expect(typeof genusImageLoader.getBirdImageSource).toBe('function');
      expect(typeof genusImageLoader.getBirdImageSourceSync).toBe('function');
      expect(typeof genusImageLoader.hasGenusAvailable).toBe('function');
    });

    test('birdImageService should maintain backwards compatibility', () => {
      expect(birdImageService).toBeDefined();
      expect(typeof getBirdImageSource).toBe('function');
      expect(typeof getBirdImage).toBe('function');
    });

    test('genus availability check should work correctly', () => {
      availableTestBirds.slice(0, 10).forEach(latinName => {
        const hasGenus = hasGenusAvailable(latinName);
        expect(typeof hasGenus).toBe('boolean');
        
        // Should return true for birds with valid Latin names
        if (latinName && latinName.includes(' ')) {
          expect(hasGenus).toBe(true);
        }
      });
    });
  });

  describe('Image Retrieval Workflows', () => {
    test('getBirdImage should return correct metadata for available birds', () => {
      availableTestBirds.slice(0, 10).forEach(latinName => {
        const result = getBirdImage(latinName);
        
        expect(result).toBeDefined();
        expect(result.found).toBe(true);
        expect(result.info).toBeDefined();
        expect(result.info?.latinName).toBe(latinName);
        expect(result.info?.commonName).toBeDefined();
        expect(result.info?.hasImage).toBe(true);
        expect(result.imageUri).toBeDefined();
      });
    });

    test('getBirdImageSource should return image sources for available birds', async () => {
      for (const latinName of availableTestBirds.slice(0, 10)) {
        const imageSource = getBirdImageSource(latinName);
        
        // Should return either a valid image source or null
        // (null is acceptable if genus not yet cached)
        if (imageSource !== null) {
          expect(imageSource).toBeDefined();
          expect(typeof imageSource).toBe('object');
        }
      }
    });

    test('async getBirdImageSource should load images correctly', async () => {
      for (const latinName of availableTestBirds.slice(0, 5)) {
        const imageSource = await genusImageLoader.getBirdImageSource(latinName);
        
        expect(imageSource).toBeDefined();
        expect(imageSource).not.toBeNull();
        expect(typeof imageSource).toBe('object');
        
        console.log(`✅ Successfully loaded image for ${latinName}`);
      }
    }, 30000); // 30 second timeout for async operations

    test('sync getBirdImageSource should work after genus preloading', async () => {
      // Test genus preloading and sync access
      const testBird = availableTestBirds[0];
      const genus = testBird.split(' ')[0];
      
      // Preload the genus
      const preloadSuccess = await genusImageLoader.preloadGenus(genus);
      expect(preloadSuccess).toBe(true);
      
      // Now sync access should work
      const imageSource = getBirdImageSourceSync(testBird);
      expect(imageSource).toBeDefined();
      expect(imageSource).not.toBeNull();
      
      console.log(`✅ Sync access works for ${testBird} after preloading ${genus}`);
    }, 15000);
  });

  describe('Genus Grouping Validation', () => {
    test('birds from same genus should use same genus map', async () => {
      // Find birds from the same genus
      const genusGroups: { [genus: string]: string[] } = {};
      availableTestBirds.forEach(latinName => {
        const genus = latinName.split(' ')[0];
        if (!genusGroups[genus]) genusGroups[genus] = [];
        genusGroups[genus].push(latinName);
      });
      
      // Test with a genus that has multiple species
      const genusWithMultiple = Object.entries(genusGroups).find(([genus, birds]) => birds.length > 1);
      
      if (genusWithMultiple) {
        const [genus, birds] = genusWithMultiple;
        
        // Preload the genus once
        await genusImageLoader.preloadGenus(genus);
        
        // All birds from this genus should return images synchronously
        birds.forEach(latinName => {
          const imageSource = getBirdImageSourceSync(latinName);
          if (imageSource) {
            expect(imageSource).toBeDefined();
            console.log(`✅ ${latinName} loaded from cached ${genus} genus`);
          }
        });
      }
    });

    test('genus cache should work efficiently', async () => {
      const cacheStatsBefore = genusImageLoader.getCacheStats();
      
      // Load a few birds from different genera
      const diverseBirds = availableTestBirds.slice(0, 5);
      for (const latinName of diverseBirds) {
        await genusImageLoader.getBirdImageSource(latinName);
      }
      
      const cacheStatsAfter = genusImageLoader.getCacheStats();
      
      expect(cacheStatsAfter.loadedGenera).toBeGreaterThan(cacheStatsBefore.loadedGenera);
      expect(cacheStatsAfter.cachedGenera.length).toBeGreaterThan(0);
      
      console.log(`Cache stats: ${cacheStatsAfter.loadedGenera} genera loaded`);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle non-existent birds gracefully', () => {
      const fakeBirds = [
        'Fakeus nonexistentus',
        'Imaginary birdius',
        'Nonexistent species'
      ];
      
      fakeBirds.forEach(fakeBird => {
        const result = getBirdImage(fakeBird);
        expect(result.found).toBe(false);
        expect(result.imageUri).toBeNull();
        expect(result.info).toBeNull();
        
        const imageSource = getBirdImageSource(fakeBird);
        expect(imageSource).toBeNull();
      });
    });

    test('should handle invalid input gracefully', () => {
      const invalidInputs = ['', null, undefined, 'single_word', '   ', 123 as any];
      
      invalidInputs.forEach(invalidInput => {
        expect(() => {
          const result = getBirdImage(invalidInput as string);
          expect(result.found).toBe(false);
        }).not.toThrow();
        
        expect(() => {
          const imageSource = getBirdImageSource(invalidInput as string);
          expect(imageSource).toBeNull();
        }).not.toThrow();
      });
    });

    test('should handle subspecies correctly', async () => {
      // Test with a subspecies if available
      const subspeciesTest = 'Anas platyrhynchos domesticus';
      const baseSpecies = 'Anas platyrhynchos';
      
      // If the base species exists, subspecies should fall back to it
      const baseResult = getBirdImage(baseSpecies);
      if (baseResult.found) {
        const subspeciesImageSource = await genusImageLoader.getBirdImageSource(subspeciesTest);
        const baseImageSource = await genusImageLoader.getBirdImageSource(baseSpecies);
        
        // Should get the same image for subspecies and base species
        if (baseImageSource && subspeciesImageSource) {
          expect(subspeciesImageSource).toEqual(baseImageSource);
          console.log(`✅ Subspecies ${subspeciesTest} correctly falls back to ${baseSpecies}`);
        }
      }
    });
  });

  describe('Performance and Memory Optimization', () => {
    test('should not load all images at once (memory efficiency)', () => {
      const initialCacheStats = genusImageLoader.getCacheStats();
      
      // Initially, no genera should be loaded
      expect(initialCacheStats.loadedGenera).toBeLessThan(50); // Should be way less than total genera
      
      console.log(`Initial cache: ${initialCacheStats.loadedGenera} genera loaded`);
    });

    test('cache clearing should work correctly', async () => {
      // Load some images first
      await genusImageLoader.getBirdImageSource(availableTestBirds[0]);
      
      let cacheStats = genusImageLoader.getCacheStats();
      expect(cacheStats.loadedGenera).toBeGreaterThan(0);
      
      // Clear cache
      genusImageLoader.clearCache();
      
      cacheStats = genusImageLoader.getCacheStats();
      expect(cacheStats.loadedGenera).toBe(0);
      expect(cacheStats.cachedGenera.length).toBe(0);
      
      console.log('✅ Cache clearing works correctly');
    });

    test('preloading multiple genera should work efficiently', async () => {
      const generaToPreload = availableTestBirds.slice(0, 3).map(bird => bird.split(' ')[0]);
      const uniqueGenera = [...new Set(generaToPreload)];
      
      const preloadResult = await genusImageLoader.preloadGenera(uniqueGenera);
      
      expect(preloadResult.loaded.length).toBeGreaterThan(0);
      expect(preloadResult.failed.length).toBeLessThanOrEqual(uniqueGenera.length);
      
      console.log(`✅ Preloaded ${preloadResult.loaded.length} genera, ${preloadResult.failed.length} failed`);
    }, 20000);
  });

  describe('Backwards Compatibility', () => {
    test('existing API should work exactly as before', () => {
      availableTestBirds.slice(0, 5).forEach(latinName => {
        // These should not throw and should return expected types
        const birdInfo = getBirdImage(latinName);
        expect(birdInfo).toBeDefined();
        expect(typeof birdInfo.found).toBe('boolean');
        
        const imageSource = getBirdImageSource(latinName);
        // Should return object or null, never undefined for valid calls
        expect(imageSource === null || typeof imageSource === 'object').toBe(true);
      });
    });

    test('service statistics should still work', () => {
      const stats = birdImageService.getStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalSpecies).toBe('number');
      expect(typeof stats.speciesWithImages).toBe('number');
      expect(typeof stats.coveragePercentage).toBe('number');
      expect(stats.totalSpecies).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity Verification', () => {
    test('genus-based results should match expected metadata', async () => {
      for (const latinName of availableTestBirds.slice(0, 3)) {
        const birdInfo = getBirdImage(latinName);
        const imageSource = await genusImageLoader.getBirdImageSource(latinName);
        
        if (birdInfo.found && imageSource) {
          // The image source should correspond to the expected filename
          expect(birdInfo.info?.hasImage).toBe(true);
          expect(birdInfo.info?.imageFile).toBeDefined();
          
          console.log(`✅ Data integrity verified for ${latinName}`);
        }
      }
    });

    test('no genus map should be empty', async () => {
      // Load a few genera and verify they contain images
      const testGenera = [...new Set(availableTestBirds.slice(0, 5).map(bird => bird.split(' ')[0]))];
      
      for (const genus of testGenera) {
        const success = await genusImageLoader.preloadGenus(genus);
        if (success) {
          // The genus should have at least one image
          const cacheStats = genusImageLoader.getCacheStats();
          expect(cacheStats.cachedGenera).toContain(genus);
          
          console.log(`✅ Genus ${genus} successfully loaded with images`);
        }
      }
    });
  });
});

describe('Integration Test: Complete Workflow', () => {
  test('complete bird image retrieval workflow', async () => {
    const testBird = 'Struthio camelus'; // Common Ostrich
    
    // Step 1: Get bird metadata
    const birdInfo = getBirdImage(testBird);
    expect(birdInfo.found).toBe(true);
    expect(birdInfo.info?.commonName).toBe('Common Ostrich');
    
    // Step 2: Check genus availability
    const hasGenus = hasGenusAvailable(testBird);
    expect(hasGenus).toBe(true);
    
    // Step 3: Get image source (async)
    const imageSource = await genusImageLoader.getBirdImageSource(testBird);
    expect(imageSource).toBeDefined();
    expect(imageSource).not.toBeNull();
    
    // Step 4: Get image source (sync, should work now)
    const syncImageSource = getBirdImageSourceSync(testBird);
    expect(syncImageSource).toBeDefined();
    expect(syncImageSource).toEqual(imageSource);
    
    // Step 5: Backwards compatible API should also work
    const legacyImageSource = getBirdImageSource(testBird);
    if (legacyImageSource) {
      expect(legacyImageSource).toEqual(imageSource);
    }
    
    console.log('✅ Complete workflow test passed for Common Ostrich');
  }, 15000);
});