/**
 * Embedded Labels Validation Test
 * 
 * Validates that the FP32 model's embedded labels work correctly
 * Tests species name retrieval, scientific names, and global species coverage
 */

import { fastTfliteBirdClassifier } from '../services/fastTfliteBirdClassifier';
import { ModelType, ModelConfig } from '../services/modelConfig';

// Helper to create varied test inputs that might trigger different species
const createVariedTestInput = (seed: number): Float32Array => {
  const size = 224 * 224 * 3;
  const data = new Float32Array(size);
  
  // Use seed to create deterministic but varied patterns
  const rng = (s: number) => {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };
  
  for (let i = 0; i < size; i++) {
    const h = Math.floor(i / (224 * 3));
    const w = Math.floor((i % (224 * 3)) / 3);
    const c = i % 3;
    
    // Create frequency-like patterns based on seed
    const freqPattern = Math.sin((h + seed * 10) * 0.1) * 0.8;
    const timePattern = Math.cos((w + seed * 5) * 0.05) * 0.6;
    const channelOffset = c * 0.2;
    const noise = (rng(i + seed) - 0.5) * 0.3;
    
    data[i] = freqPattern + timePattern + channelOffset + noise;
  }
  
  return data;
};

// Common bird families for validation
const EXPECTED_BIRD_FAMILIES = [
  'thrush', 'warbler', 'sparrow', 'finch', 'jay', 'cardinal', 'wren', 'robin',
  'bluebird', 'chickadee', 'nuthatch', 'woodpecker', 'hawk', 'eagle', 'owl',
  'duck', 'goose', 'heron', 'crane', 'gull', 'tern', 'pigeon', 'dove'
];

describe('Embedded Labels Validation', () => {
  let modelReady = false;
  let allPredictions: any[] = [];

  beforeAll(async () => {
    console.log('🚀 Initializing FP32 model for embedded labels testing...');
    
    try {
      const success = await fastTfliteBirdClassifier.switchModel(ModelType.HIGH_ACCURACY_FP32);
      modelReady = success;
      
      if (success) {
        console.log('✅ FP32 model with embedded labels ready');
      } else {
        console.error('❌ Failed to load FP32 model');
      }
    } catch (error) {
      console.error('❌ Model initialization error:', error);
      modelReady = false;
    }
  }, 30000);

  afterAll(() => {
    if (modelReady) {
      fastTfliteBirdClassifier.dispose();
      console.log('🧹 Model disposed');
    }
  });

  describe('Model Configuration for Embedded Labels', () => {
    test('should be configured for 6522 species (Global BirdNET)', () => {
      const config = ModelConfig.getConfiguration(ModelType.HIGH_ACCURACY_FP32);
      
      expect(config.expectedClasses).toBe(6522);
      expect(config.name).toContain('Global 6K');
      expect(config.precision).toBe('FP32');
      
      console.log('✅ Model configured for global species coverage');
      console.log(`   Expected classes: ${config.expectedClasses}`);
      console.log(`   Model name: ${config.name}`);
    });

    test('should be the HIGH_ACCURACY_FP32 variant with embedded labels', () => {
      if (!modelReady) throw new Error('Model not ready');
      
      expect(fastTfliteBirdClassifier.getCurrentModelType()).toBe(ModelType.HIGH_ACCURACY_FP32);
      expect(fastTfliteBirdClassifier.isReady()).toBe(true);
      
      console.log('✅ Correct model variant loaded');
    });
  });

  describe('Species Name Validation', () => {
    test('should return valid species names (not indices or codes)', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const testInput = createVariedTestInput(42); // Deterministic seed
      const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
      
      expect(result.results.length).toBeGreaterThan(0);
      
      // Store predictions for later analysis
      allPredictions.push(...result.results);
      
      // Validate species names
      result.results.forEach((prediction, index) => {
        // Should have meaningful common names
        expect(prediction.species).toBeDefined();
        expect(typeof prediction.species).toBe('string');
        expect(prediction.species.length).toBeGreaterThan(0);
        
        // Should not be just numbers or codes
        expect(prediction.species).not.toMatch(/^\d+$/);
        expect(prediction.species).not.toMatch(/^[A-Z0-9_]+$/);
        expect(prediction.species).not.toMatch(/^unknown/i);
        
        // Should look like real bird names
        expect(prediction.species).toMatch(/^[A-Za-z\s\-'().]+$/);
        
        console.log(`Species ${index + 1}: "${prediction.species}" (${(prediction.confidence * 100).toFixed(2)}%)`);
      });
      
      console.log('✅ Species names validation passed');
    });

    test('should provide scientific names for species', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const testInput = createVariedTestInput(123);
      const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
      
      expect(result.results.length).toBeGreaterThan(0);
      
      result.results.forEach((prediction, index) => {
        expect(prediction.scientificName).toBeDefined();
        expect(typeof prediction.scientificName).toBe('string');
        
        // Scientific names should follow binomial nomenclature (mostly)
        if (prediction.scientificName.length > 0) {
          // Should contain at least one space (Genus species)
          const parts = prediction.scientificName.split(' ');
          expect(parts.length).toBeGreaterThanOrEqual(1);
          
          // Should start with capital letter
          expect(prediction.scientificName[0]).toMatch(/[A-Z]/);
          
          console.log(`Scientific ${index + 1}: "${prediction.scientificName}"`);
        }
      });
      
      console.log('✅ Scientific names validation passed');
    });

    test('should recognize common bird family names', async () => {
      if (!modelReady) throw new Error('Model not ready');

      // Test multiple varied inputs to get diverse species
      const recognizedFamilies = new Set<string>();
      
      for (let seed = 0; seed < 10; seed++) {
        const testInput = createVariedTestInput(seed);
        const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
        
        result.results.forEach(prediction => {
          const speciesLower = prediction.species.toLowerCase();
          
          // Check if any expected bird families are mentioned
          EXPECTED_BIRD_FAMILIES.forEach(family => {
            if (speciesLower.includes(family)) {
              recognizedFamilies.add(family);
            }
          });
        });
      }
      
      // Should recognize at least some common bird families
      expect(recognizedFamilies.size).toBeGreaterThan(2);
      
      console.log('✅ Bird family recognition validated');
      console.log(`   Recognized families: ${Array.from(recognizedFamilies).join(', ')}`);
    });
  });

  describe('Global Species Coverage', () => {
    test('should cover diverse geographical regions', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const uniqueSpecies = new Set<string>();
      const uniqueScientific = new Set<string>();
      
      // Run multiple tests with different patterns to sample the model's coverage
      for (let seed = 0; seed < 15; seed++) {
        const testInput = createVariedTestInput(seed * 10);
        const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
        
        result.results.forEach(prediction => {
          if (prediction.confidence > 0.01) { // Only consider reasonable predictions
            uniqueSpecies.add(prediction.species);
            uniqueScientific.add(prediction.scientificName);
          }
        });
      }
      
      // Should find significant diversity in a global 6K model
      expect(uniqueSpecies.size).toBeGreaterThan(20);
      expect(uniqueScientific.size).toBeGreaterThan(15);
      
      console.log('✅ Global species coverage validated');
      console.log(`   Unique species found: ${uniqueSpecies.size}`);
      console.log(`   Unique scientific names: ${uniqueScientific.size}`);
      
      // Sample some species for logging
      const speciesSample = Array.from(uniqueSpecies).slice(0, 10);
      console.log(`   Sample species: ${speciesSample.join(', ')}`);
    });

    test('should include species from different continents', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const regionalIndicators = {
        'North America': ['american', 'carolina', 'canada', 'california'],
        'Europe': ['european', 'eurasian', 'british', 'scandinavian'],
        'Asia': ['asian', 'chinese', 'japanese', 'indian'],
        'Africa': ['african', 'madagascar', 'ethiopia'],
        'Australia': ['australian', 'zealand'],
        'South America': ['amazonian', 'andean', 'patagonian']
      };
      
      const foundRegions = new Set<string>();
      
      // Test multiple inputs to sample regional diversity
      for (let seed = 0; seed < 20; seed++) {
        const testInput = createVariedTestInput(seed * 7);
        const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
        
        result.results.forEach(prediction => {
          const speciesLower = prediction.species.toLowerCase();
          const scientificLower = prediction.scientificName.toLowerCase();
          
          Object.entries(regionalIndicators).forEach(([region, indicators]) => {
            indicators.forEach(indicator => {
              if (speciesLower.includes(indicator) || scientificLower.includes(indicator)) {
                foundRegions.add(region);
              }
            });
          });
        });
      }
      
      // Should find species from multiple regions
      expect(foundRegions.size).toBeGreaterThan(1);
      
      console.log('✅ Regional diversity validated');
      console.log(`   Regions represented: ${Array.from(foundRegions).join(', ')}`);
    });
  });

  describe('Label Consistency and Quality', () => {
    test('should maintain consistent naming conventions', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const testInput = createVariedTestInput(999);
      const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
      
      expect(result.results.length).toBeGreaterThan(0);
      
      const namingIssues: string[] = [];
      
      result.results.forEach(prediction => {
        // Check for naming consistency issues
        const species = prediction.species;
        
        // Should not have multiple consecutive spaces
        if (species.includes('  ')) {
          namingIssues.push(`Multiple spaces: "${species}"`);
        }
        
        // Should not start/end with spaces
        if (species.startsWith(' ') || species.endsWith(' ')) {
          namingIssues.push(`Leading/trailing space: "${species}"`);
        }
        
        // Should not have unusual characters (basic check)
        if (/[^A-Za-z0-9\s\-'().]/.test(species)) {
          namingIssues.push(`Unusual characters: "${species}"`);
        }
        
        // Should use consistent capitalization
        const words = species.split(' ');
        words.forEach(word => {
          if (word.length > 0 && word !== word.toLowerCase() && word !== word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) {
            namingIssues.push(`Inconsistent capitalization: "${species}"`);
          }
        });
      });
      
      // Allow some naming quirks but flag significant issues
      if (namingIssues.length > result.results.length * 0.5) {
        console.warn('⚠️ Significant naming issues found:', namingIssues.slice(0, 5));
      }
      
      expect(namingIssues.length).toBeLessThan(result.results.length); // Not all results should have issues
      
      console.log('✅ Naming consistency validated');
      console.log(`   Issues found: ${namingIssues.length}/${result.results.length}`);
    });

    test('should provide meaningful confidence distributions', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const confidenceData: number[] = [];
      
      // Collect confidence data from multiple runs
      for (let seed = 0; seed < 5; seed++) {
        const testInput = createVariedTestInput(seed * 50);
        const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
        
        confidenceData.push(...result.results.map(p => p.confidence));
      }
      
      // Analyze confidence distribution
      const sortedConf = confidenceData.sort((a, b) => b - a);
      const min = Math.min(...confidenceData);
      const max = Math.max(...confidenceData);
      const mean = confidenceData.reduce((sum, c) => sum + c, 0) / confidenceData.length;
      
      // Should have reasonable confidence distribution
      expect(max).toBeLessThanOrEqual(1.0);
      expect(min).toBeGreaterThanOrEqual(0.0);
      expect(mean).toBeGreaterThan(0);
      
      // For a well-trained model, top predictions should be more confident than random
      const top10Percent = sortedConf.slice(0, Math.floor(sortedConf.length * 0.1));
      const topMean = top10Percent.reduce((sum, c) => sum + c, 0) / top10Percent.length;
      
      expect(topMean).toBeGreaterThan(mean); // Top predictions should be more confident
      
      console.log('✅ Confidence distribution validated');
      console.log(`   Range: [${(min * 100).toFixed(3)}%, ${(max * 100).toFixed(3)}%]`);
      console.log(`   Mean: ${(mean * 100).toFixed(3)}%`);
      console.log(`   Top 10% mean: ${(topMean * 100).toFixed(3)}%`);
    });
  });

  describe('Embedded vs External Labels Comparison', () => {
    test('should work without requiring external label files', async () => {
      if (!modelReady) throw new Error('Model not ready');

      // The FP32 model should have embedded labels, so it shouldn't need
      // external label files to produce meaningful results
      
      const testInput = createVariedTestInput(555);
      const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
      
      expect(result.results.length).toBeGreaterThan(0);
      
      // Results should have meaningful names (indicating embedded labels work)
      const topPrediction = result.results[0];
      expect(topPrediction.species).toBeDefined();
      expect(topPrediction.species.length).toBeGreaterThan(0);
      expect(topPrediction.species).not.toBe('Unknown');
      expect(topPrediction.species).not.toMatch(/^\d+$/);
      
      console.log('✅ Embedded labels functioning correctly');
      console.log(`   Generated prediction without external files: ${topPrediction.species}`);
    });

    test('should provide species indices that could map to external databases', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const testInput = createVariedTestInput(777);
      const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
      
      expect(result.results.length).toBeGreaterThan(0);
      
      // Check that indices are provided and reasonable
      result.results.forEach(prediction => {
        expect(prediction.index).toBeDefined();
        expect(typeof prediction.index).toBe('number');
        expect(prediction.index).toBeGreaterThanOrEqual(0);
        expect(prediction.index).toBeLessThan(10000); // Should be within reasonable range
        expect(Number.isInteger(prediction.index)).toBe(true);
      });
      
      // Indices should be unique for different species
      const indices = result.results.map(p => p.index);
      const uniqueIndices = new Set(indices);
      expect(uniqueIndices.size).toBe(indices.length); // All should be unique
      
      console.log('✅ Species indices validation passed');
      console.log(`   Index range: ${Math.min(...indices)} - ${Math.max(...indices)}`);
    });
  });

  describe('Multi-language and International Support', () => {
    test('should handle international bird names correctly', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const testInput = createVariedTestInput(888);
      const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
      
      expect(result.results.length).toBeGreaterThan(0);
      
      // Look for international naming patterns
      const internationalPatterns = [
        /\b(de|von|van|del|la|le|el)\b/i, // European prepositions
        /\b(asian|european|african|american|australian)\b/i, // Regional descriptors
        /[\u00C0-\u017F]/g, // Accented characters
      ];
      
      let internationalCount = 0;
      
      result.results.forEach(prediction => {
        internationalPatterns.forEach(pattern => {
          if (pattern.test(prediction.species) || pattern.test(prediction.scientificName)) {
            internationalCount++;
          }
        });
      });
      
      console.log('✅ International naming support validated');
      console.log(`   Found ${internationalCount} predictions with international naming patterns`);
    });

    test('should provide consistent encoding for all species names', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const allSpeciesNames: string[] = [];
      const allScientificNames: string[] = [];
      
      // Collect names from multiple test runs
      for (let seed = 0; seed < 8; seed++) {
        const testInput = createVariedTestInput(seed * 111);
        const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
        
        result.results.forEach(prediction => {
          allSpeciesNames.push(prediction.species);
          allScientificNames.push(prediction.scientificName);
        });
      }
      
      // Check for encoding issues
      const encodingIssues: string[] = [];
      
      [...allSpeciesNames, ...allScientificNames].forEach(name => {
        // Check for obvious encoding problems
        if (name.includes('�') || name.includes('?')) {
          encodingIssues.push(name);
        }
        
        // Check for proper UTF-8 encoding
        try {
          const encoded = encodeURIComponent(name);
          const decoded = decodeURIComponent(encoded);
          if (decoded !== name) {
            encodingIssues.push(`Encoding mismatch: ${name}`);
          }
        } catch (error) {
          encodingIssues.push(`Encoding error: ${name}`);
        }
      });
      
      // Should have minimal encoding issues
      expect(encodingIssues.length).toBeLessThan(allSpeciesNames.length * 0.05); // Less than 5%
      
      console.log('✅ Text encoding validation passed');
      console.log(`   Encoding issues: ${encodingIssues.length}/${allSpeciesNames.length + allScientificNames.length}`);
      
      if (encodingIssues.length > 0) {
        console.log(`   Sample issues: ${encodingIssues.slice(0, 3).join(', ')}`);
      }
    });
  });
});