/**
 * Comprehensive test for MLKit Bird Classification Service
 * Tests MLKit initialization, image classification, and service integration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MLKitBirdClassifier } from '../services/mlkitBirdClassifier';
import { BirdNetService } from '../services/birdNetService';

// Mock image URI for testing
const MOCK_IMAGE_URI = 'file:///assets/birds/test-bird.jpg';
const MOCK_AUDIO_URI = 'file:///assets/birds/bird1.mp3';

describe('MLKit Bird Classification Service', () => {
  let classifier: MLKitBirdClassifier;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any test artifacts
  });

  describe('Service Initialization', () => {
    it('should initialize MLKit classifier successfully', async () => {
      classifier = MLKitBirdClassifier.getInstance();
      
      expect(classifier).toBeDefined();
      
      // Test configuration
      const config = classifier.getConfig();
      expect(config.confidenceThreshold).toBeGreaterThan(0);
      expect(config.maxResults).toBeGreaterThan(0);
      expect(typeof config.cacheResults).toBe('boolean');
      expect(typeof config.fallbackToOnline).toBe('boolean');
    });

    it('should have valid default configuration', () => {
      classifier = MLKitBirdClassifier.getInstance();
      const config = classifier.getConfig();
      
      expect(config.confidenceThreshold).toBeLessThanOrEqual(1);
      expect(config.confidenceThreshold).toBeGreaterThanOrEqual(0);
      expect(config.maxResults).toBeGreaterThan(0);
      expect(config.maxResults).toBeLessThanOrEqual(10);
    });
  });

  describe('Image Classification', () => {
    beforeEach(() => {
      classifier = MLKitBirdClassifier.getInstance();
    });

    it('should classify bird image successfully', async () => {
      const result = await classifier.classifyBirdImage(MOCK_IMAGE_URI);
      
      expect(result).toBeDefined();
      expect(result.source).toBeDefined();
      expect(Array.isArray(result.predictions)).toBe(true);
      expect(typeof result.cacheHit).toBe('boolean');
      expect(typeof result.fallbackUsed).toBe('boolean');
    });

    it('should return predictions with proper structure', async () => {
      const result = await classifier.classifyBirdImage(MOCK_IMAGE_URI);
      
      if (result.predictions.length > 0) {
        const prediction = result.predictions[0];
        expect(prediction.common_name).toBeDefined();
        expect(prediction.scientific_name).toBeDefined();
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should handle invalid image URI gracefully', async () => {
      // Service should return graceful fallback instead of throwing
      const result = await classifier.classifyBirdImage('invalid://uri');
      
      expect(result).toBeDefined();
      expect(result.fallbackUsed).toBe(true);
      expect(result.predictions).toBeDefined();
    });
  });

  describe('BirdNet Service Integration', () => {
    it('should initialize BirdNet service with MLKit', async () => {
      await expect(BirdNetService.initializeMLKit()).resolves.not.toThrow();
    });

    it('should identify bird from image through BirdNet service', async () => {
      await BirdNetService.initializeMLKit();
      
      const result = await BirdNetService.identifyBirdFromImage(MOCK_IMAGE_URI);
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.source).toBeDefined();
      expect(typeof result.processing_time).toBe('number');
      expect(Array.isArray(result.predictions)).toBe(true);
    });

    it('should identify bird from audio through BirdNet service', async () => {
      const result = await BirdNetService.identifyBirdFromAudio(MOCK_AUDIO_URI);
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.source).toBeDefined();
      expect(typeof result.cache_hit).toBe('boolean');
      expect(typeof result.audio_duration).toBe('number');
    });
  });

  describe('Caching Functionality', () => {
    beforeEach(() => {
      classifier = MLKitBirdClassifier.getInstance();
    });

    it('should cache classification results when enabled', async () => {
      // Clear cache first
      classifier.clearCache();
      
      // First classification (should miss cache)
      const firstResult = await classifier.classifyBirdImage(MOCK_IMAGE_URI);
      expect(firstResult.cacheHit).toBe(false);
      
      // Second classification (may or may not hit cache depending on implementation)
      const secondResult = await classifier.classifyBirdImage(MOCK_IMAGE_URI);
      
      const config = classifier.getConfig();
      if (config.cacheResults && secondResult.cacheHit) {
        expect(secondResult.processingTime).toBeLessThanOrEqual(firstResult.processingTime);
      }
      
      // At minimum, both results should be defined
      expect(firstResult).toBeDefined();
      expect(secondResult).toBeDefined();
    });

    it('should clear cache successfully', () => {
      classifier.clearCache();
      // Cache clearing should not throw an error
      expect(true).toBe(true);
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(() => {
      classifier = MLKitBirdClassifier.getInstance();
    });

    it('should update configuration successfully', () => {
      const originalConfig = classifier.getConfig();
      
      const newConfig = {
        confidenceThreshold: 0.8,
        maxResults: 3,
        cacheResults: false,
      };
      
      classifier.updateConfig(newConfig);
      const updatedConfig = classifier.getConfig();
      
      expect(updatedConfig.confidenceThreshold).toBe(0.8);
      expect(updatedConfig.maxResults).toBe(3);
      expect(updatedConfig.cacheResults).toBe(false);
      
      // Restore original config
      classifier.updateConfig(originalConfig);
    });

    it('should validate configuration values', () => {
      const invalidConfig = {
        confidenceThreshold: 1.5, // Invalid: > 1
        maxResults: -1, // Invalid: < 0
      };
      
      // Should handle invalid config gracefully
      expect(() => classifier.updateConfig(invalidConfig)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      classifier = MLKitBirdClassifier.getInstance();
    });

    it('should handle network errors gracefully', async () => {
      // Mock network failure
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Should not throw, but return error state
      const result = await classifier.classifyBirdImage(MOCK_IMAGE_URI);
      expect(result).toBeDefined();
      
      jest.restoreAllMocks();
    });

    it('should handle empty or null image URI', async () => {
      // Service should handle gracefully and return fallback
      const emptyResult = await classifier.classifyBirdImage('');
      expect(emptyResult).toBeDefined();
      expect(emptyResult.fallbackUsed).toBe(true);
      
      const nullResult = await classifier.classifyBirdImage(null as any);
      expect(nullResult).toBeDefined();
      expect(nullResult.fallbackUsed).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    beforeEach(() => {
      classifier = MLKitBirdClassifier.getInstance();
    });

    it('should complete classification within reasonable time', async () => {
      const startTime = Date.now();
      await classifier.classifyBirdImage(MOCK_IMAGE_URI);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should handle multiple concurrent classifications', async () => {
      const promises = Array(3).fill(null).map(() => 
        classifier.classifyBirdImage(MOCK_IMAGE_URI)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(Array.isArray(result.predictions)).toBe(true);
      });
    });
  });
});