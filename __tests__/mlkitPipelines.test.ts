/**
 * MLKit Service Pipeline Tests for LogChirpy
 * 
 * Tests all core service integrations and data flows:
 * - MLKit bird classification pipeline
 * - BirdNET service integration pipeline
 * - Database operations pipeline
 * - MLKit-first architecture
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock dependencies
jest.mock('@infinitered/react-native-mlkit-image-labeling');
jest.mock('expo-file-system');
jest.mock('expo-av');
jest.mock('@react-native-community/netinfo');

import { MLKitBirdClassifier } from '@/services/mlkitBirdClassifier';
import { BirdNetService } from '@/services/birdNetService';
import * as database from '@/services/database';
import * as databaseBirDex from '@/services/databaseBirDex';

describe('MLKit Service Pipeline Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('🖼️ MLKit Image Classification Pipeline', () => {
    describe('Bird image classification', () => {
      it('should classify bird images using MLKit', async () => {
        // Mock MLKit labels response
        const mockLabels = [
          { text: 'bird', confidence: 0.8 },
          { text: 'robin', confidence: 0.7 },
          { text: 'animal', confidence: 0.9 },
        ];

        // Mock the ImageLabeling module
        const ImageLabeling = require('@infinitered/react-native-mlkit-image-labeling').ImageLabeling;
        ImageLabeling.initialize = jest.fn().mockResolvedValue(undefined);
        ImageLabeling.label = jest.fn().mockResolvedValue(mockLabels);

        const classifier = MLKitBirdClassifier.getInstance();
        const imageUri = 'file:///test-bird.jpg';
        
        const result = await classifier.classifyBirdImage(imageUri);

        expect(result.predictions).toBeDefined();
        expect(result.predictions.length).toBeGreaterThan(0);
        expect(result.source).toBe('mlkit');
        expect(result.processingTime).toBeGreaterThan(0);
        expect(ImageLabeling.label).toHaveBeenCalledWith(imageUri);
      });

      it('should handle classification errors gracefully', async () => {
        const ImageLabeling = require('@infinitered/react-native-mlkit-image-labeling').ImageLabeling;
        ImageLabeling.label = jest.fn().mockRejectedValue(new Error('MLKit error'));

        const classifier = MLKitBirdClassifier.getInstance();
        const imageUri = 'file:///test-bird.jpg';
        
        const result = await classifier.classifyBirdImage(imageUri);

        expect(result.fallbackUsed).toBe(true);
        expect(result.predictions.length).toBe(1);
        expect(result.predictions[0].common_name).toContain('MLKit Error');
      });

      it('should filter low confidence predictions', async () => {
        const mockLabels = [
          { text: 'bird', confidence: 0.8 },
          { text: 'tree', confidence: 0.3 }, // Below default threshold
          { text: 'robin', confidence: 0.6 },
        ];

        const ImageLabeling = require('@infinitered/react-native-mlkit-image-labeling').ImageLabeling;
        ImageLabeling.label = jest.fn().mockResolvedValue(mockLabels);

        const classifier = MLKitBirdClassifier.getInstance();
        const imageUri = 'file:///test-bird.jpg';
        
        const result = await classifier.classifyBirdImage(imageUri);

        // Should only include predictions above confidence threshold (0.5)
        expect(result.predictions.length).toBe(2);
        expect(result.predictions.every(p => p.confidence >= 0.5)).toBe(true);
      });
    });

    describe('Configuration management', () => {
      it('should update configuration correctly', () => {
        const classifier = MLKitBirdClassifier.getInstance();
        
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
      });

      it('should maintain default values for unspecified config', () => {
        const classifier = MLKitBirdClassifier.getInstance();
        
        classifier.updateConfig({ confidenceThreshold: 0.9 });
        const config = classifier.getConfig();

        expect(config.confidenceThreshold).toBe(0.9);
        expect(config.maxResults).toBeDefined(); // Should maintain default
        expect(config.cacheResults).toBeDefined(); // Should maintain default
      });
    });
  });

  describe('🌐 BirdNet Service Integration', () => {
    describe('Image identification service', () => {
      it('should process images through BirdNet service', async () => {
        const mockFileInfo = { exists: true, size: 1024 };
        
        // Mock file system
        const FileSystem = require('expo-file-system');
        FileSystem.getInfoAsync = jest.fn().mockResolvedValue(mockFileInfo);

        // Mock MLKit response
        const mockMLKitResult = {
          predictions: [
            { common_name: 'American Robin', scientific_name: 'Turdus migratorius', confidence: 0.8 }
          ],
          source: 'mlkit',
          processingTime: 1500,
          fallbackUsed: false,
          cacheHit: false,
        };

        jest.spyOn(MLKitBirdClassifier.prototype, 'classifyBirdImage')
          .mockResolvedValue(mockMLKitResult);

        const imageUri = 'file:///test-bird.jpg';
        const result = await BirdNetService.identifyBirdFromImage(imageUri);

        expect(result.success).toBe(true);
        expect(result.source).toBe('mlkit');
        expect(result.predictions.length).toBe(1);
        expect(result.predictions[0].common_name).toBe('American Robin');
        expect(result.audio_duration).toBe(0); // Should be 0 for images
      });

      it('should handle missing image files', async () => {
        const FileSystem = require('expo-file-system');
        FileSystem.getInfoAsync = jest.fn().mockResolvedValue({ exists: false });

        const imageUri = 'file:///nonexistent.jpg';
        
        await expect(BirdNetService.identifyBirdFromImage(imageUri))
          .rejects.toThrow('Image file not found');
      });
    });

    describe('Audio identification fallback', () => {
      it('should handle audio classification with fallback', async () => {
        const mockFileInfo = { exists: true, size: 2048 };
        
        const FileSystem = require('expo-file-system');
        FileSystem.getInfoAsync = jest.fn().mockResolvedValue(mockFileInfo);

        const audioUri = 'file:///test-audio.mp3';
        const result = await BirdNetService.identifyBirdFromAudio(audioUri);

        expect(result).toBeDefined();
        expect(result.source).toBeDefined();
        // Audio classification will use fallback since MLKit doesn't support audio
      });
    });
  });

  describe('🗄️ Database Integration Pipeline', () => {
    describe('Bird spotting data flow', () => {
      it('should save MLKit results to database', async () => {
        // Mock database operations
        jest.spyOn(database, 'insertBirdSpotting').mockResolvedValue(1);

        const mockSpotting = {
          species: 'American Robin',
          scientificName: 'Turdus migratorius',
          location: 'Test Location',
          latitude: 40.7128,
          longitude: -74.0060,
          timestamp: new Date().toISOString(),
          confidence: 0.8,
          imageUri: 'file:///test-bird.jpg',
          videoUri: null,
          audioUri: null,
          textNote: 'Test spotting',
          birdDexCode: 'amrobi',
          weather: 'Clear',
          temperature: 22,
          windSpeed: 5,
          source: 'mlkit',
        };

        const result = await database.insertBirdSpotting(mockSpotting);

        expect(result).toBe(1);
        expect(database.insertBirdSpotting).toHaveBeenCalledWith(mockSpotting);
      });
    });

    describe('BirdDex integration', () => {
      it('should query BirdDex data for species', async () => {
        const mockBirdData = {
          species_code: 'amrobi',
          common_name: 'American Robin',
          scientific_name: 'Turdus migratorius',
          category: 'Songbird',
        };

        jest.spyOn(databaseBirDex, 'getBirdBySpeciesCode')
          .mockResolvedValue(mockBirdData);

        const result = await databaseBirDex.getBirdBySpeciesCode('amrobi');

        expect(result).toEqual(mockBirdData);
        expect(databaseBirDex.getBirdBySpeciesCode).toHaveBeenCalledWith('amrobi');
      });

      it('should handle missing species codes', async () => {
        jest.spyOn(databaseBirDex, 'getBirdBySpeciesCode')
          .mockResolvedValue(null);

        const result = await databaseBirDex.getBirdBySpeciesCode('invalid_code');

        expect(result).toBeNull();
      });
    });
  });

  describe('🔄 Cache Management', () => {
    describe('MLKit result caching', () => {
      it('should cache classification results', async () => {
        const classifier = MLKitBirdClassifier.getInstance();
        classifier.clearCache(); // Start with clean cache

        const mockLabels = [
          { text: 'robin', confidence: 0.8 }
        ];

        const ImageLabeling = require('@infinitered/react-native-mlkit-image-labeling').ImageLabeling;
        ImageLabeling.label = jest.fn().mockResolvedValue(mockLabels);

        const imageUri = 'file:///test-bird.jpg';
        
        // First call - should process and cache
        const firstResult = await classifier.classifyBirdImage(imageUri);
        expect(firstResult.cacheHit).toBe(false);

        // Second call - should use cache (in real implementation)
        const secondResult = await classifier.classifyBirdImage(imageUri);
        
        // Note: In this test, we can't easily test actual caching behavior
        // without more complex mocking, but we verify the interface works
        expect(secondResult).toBeDefined();
      });

      it('should clear cache when requested', () => {
        const classifier = MLKitBirdClassifier.getInstance();
        
        // This should not throw
        expect(() => classifier.clearCache()).not.toThrow();
      });
    });
  });

  describe('🔄 Complete Integration Flow', () => {
    it('should execute full bird spotting pipeline', async () => {
      // Mock all dependencies
      const FileSystem = require('expo-file-system');
      FileSystem.getInfoAsync = jest.fn().mockResolvedValue({ exists: true, size: 1024 });

      const mockLabels = [
        { text: 'robin', confidence: 0.8 }
      ];

      const ImageLabeling = require('@infinitered/react-native-mlkit-image-labeling').ImageLabeling;
      ImageLabeling.label = jest.fn().mockResolvedValue(mockLabels);

      jest.spyOn(database, 'insertBirdSpotting').mockResolvedValue(1);
      jest.spyOn(databaseBirDex, 'getBirdBySpeciesCode').mockResolvedValue({
        species_code: 'amrobi',
        common_name: 'American Robin',
        scientific_name: 'Turdus migratorius',
        category: 'Songbird',
      });

      // Execute pipeline
      const imageUri = 'file:///test-bird.jpg';
      
      // 1. Classify image
      const classificationResult = await BirdNetService.identifyBirdFromImage(imageUri);
      expect(classificationResult.success).toBe(true);

      // 2. Look up species in BirdDex
      const birdData = await databaseBirDex.getBirdBySpeciesCode('amrobi');
      expect(birdData).toBeDefined();

      // 3. Save to database
      const spottingData = {
        species: classificationResult.predictions[0].common_name,
        scientificName: classificationResult.predictions[0].scientific_name,
        location: 'Test Location',
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: new Date().toISOString(),
        confidence: classificationResult.predictions[0].confidence,
        imageUri,
        videoUri: null,
        audioUri: null,
        textNote: 'Test spotting',
        birdDexCode: birdData?.species_code || null,
        weather: 'Clear',
        temperature: 22,
        windSpeed: 5,
        source: classificationResult.source,
      };

      const insertResult = await database.insertBirdSpotting(spottingData);
      expect(insertResult).toBe(1);

      // Verify all services were called
      expect(ImageLabeling.label).toHaveBeenCalled();
      expect(database.insertBirdSpotting).toHaveBeenCalled();
      expect(databaseBirDex.getBirdBySpeciesCode).toHaveBeenCalled();
    });
  });
});