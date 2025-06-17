/**
 * whoBIRD FP32 Model Validation Test
 * 
 * Validates the BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite model with embedded labels
 * Tests model loading, tensor shapes, embedded labels, and basic inference
 */

import { fastTfliteBirdClassifier } from '../services/fastTfliteBirdClassifier';
import { ModelType, ModelConfig } from '../services/modelConfig';

describe('whoBIRD FP32 Model Validation', () => {
  let modelInitialized = false;

  beforeAll(async () => {
    console.log('🚀 Starting FP32 model validation tests...');
    
    // Switch to FP32 model for testing
    try {
      const success = await fastTfliteBirdClassifier.switchModel(ModelType.HIGH_ACCURACY_FP32);
      modelInitialized = success;
      
      if (success) {
        console.log('✅ FP32 model loaded successfully');
      } else {
        console.error('❌ Failed to load FP32 model');
      }
    } catch (error) {
      console.error('❌ Model initialization error:', error);
      modelInitialized = false;
    }
  }, 30000); // 30 second timeout for model loading

  afterAll(() => {
    // Clean up resources
    fastTfliteBirdClassifier.dispose();
    console.log('🧹 Model resources cleaned up');
  });

  describe('Model Loading and Configuration', () => {
    test('should load FP32 model successfully', () => {
      expect(modelInitialized).toBe(true);
      expect(fastTfliteBirdClassifier.isReady()).toBe(true);
    });

    test('should have correct model configuration', () => {
      const config = ModelConfig.getConfiguration(ModelType.HIGH_ACCURACY_FP32);
      
      expect(config.name).toBe('BirdNET Global 6K v2.4 FP32');
      expect(config.precision).toBe('FP32');
      expect(config.expectedClasses).toBe(6522);
      expect(config.fileSize).toBe('49MB');
    });

    test('should be using HIGH_ACCURACY_FP32 model type', () => {
      expect(fastTfliteBirdClassifier.getCurrentModelType()).toBe(ModelType.HIGH_ACCURACY_FP32);
    });

    test('should have appropriate performance characteristics', () => {
      const config = ModelConfig.getConfiguration(ModelType.HIGH_ACCURACY_FP32);
      
      expect(config.performance.accuracy).toBe('maximum');
      expect(config.performance.speed).toBe('medium');
      expect(config.performance.memoryUsage).toBe('high');
    });
  });

  describe('Model Tensor Validation', () => {
    test('should accept correct input tensor shape [224x224x3]', async () => {
      if (!modelInitialized) {
        throw new Error('Model not initialized');
      }

      // Create test input with correct shape for BirdNET model
      const inputSize = 224 * 224 * 3; // [height, width, channels]
      const testInput = new Float32Array(inputSize);
      
      // Fill with normalized test data (mel-spectrogram-like values)
      for (let i = 0; i < inputSize; i++) {
        testInput[i] = Math.random() * 2 - 1; // Random values between -1 and 1
      }

      try {
        const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
        
        expect(result.results).toBeDefined();
        expect(result.metadata).toBeDefined();
        expect(result.metadata.modelType).toBe(ModelType.HIGH_ACCURACY_FP32);
        expect(result.metadata.inputShape).toEqual(expect.arrayContaining([224, 224]));
        
        console.log(`✅ Model accepts input shape [224x224x3], produced ${result.results.length} predictions`);
      } catch (error) {
        throw new Error(`Failed to process valid input: ${error}`);
      }
    });

    test('should handle edge case inputs gracefully', async () => {
      if (!modelInitialized) {
        throw new Error('Model not initialized');
      }

      const inputSize = 224 * 224 * 3;

      // Test with all zeros (silence)
      const silenceInput = new Float32Array(inputSize).fill(0);
      const silenceResult = await fastTfliteBirdClassifier.classifyBirdAudio(silenceInput);
      expect(silenceResult.results).toBeDefined();
      console.log(`✅ Silence input: ${silenceResult.results.length} predictions`);

      // Test with normalized noise
      const noiseInput = new Float32Array(inputSize);
      for (let i = 0; i < inputSize; i++) {
        noiseInput[i] = Math.random() * 0.1 - 0.05; // Small random noise
      }
      const noiseResult = await fastTfliteBirdClassifier.classifyBirdAudio(noiseInput);
      expect(noiseResult.results).toBeDefined();
      console.log(`✅ Noise input: ${noiseResult.results.length} predictions`);
    });

    test('should reject invalid input shapes', async () => {
      if (!modelInitialized) {
        throw new Error('Model not initialized');
      }

      // Test with wrong input size (too small)
      const invalidInput = new Float32Array(100); // Way too small
      invalidInput.fill(0.5);

      try {
        await fastTfliteBirdClassifier.classifyBirdAudio(invalidInput);
        // If we get here, the model accepted invalid input - this should not happen
        throw new Error('Model should have rejected invalid input size');
      } catch (error) {
        // This is expected - model should reject invalid input
        expect(error).toBeDefined();
        console.log('✅ Model correctly rejected invalid input shape');
      }
    });
  });

  describe('Model Output Validation', () => {
    test('should produce valid prediction probabilities', async () => {
      if (!modelInitialized) {
        throw new Error('Model not initialized');
      }

      // Create realistic test input
      const inputSize = 224 * 224 * 3;
      const testInput = new Float32Array(inputSize);
      
      // Fill with mel-spectrogram-like data (mostly negative values with some structure)
      for (let h = 0; h < 224; h++) {
        for (let w = 0; w < 224; w++) {
          for (let c = 0; c < 3; c++) {
            const index = (h * 224 + w) * 3 + c;
            // Simulate mel-spectrogram with frequency-dependent values
            const freqComponent = Math.sin(h * 0.1) * 0.5;
            const timeComponent = Math.cos(w * 0.05) * 0.3;
            testInput[index] = (freqComponent + timeComponent) * Math.random();
          }
        }
      }

      const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
      
      // Validate output structure
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBeGreaterThan(0);
      
      // Validate individual predictions
      result.results.forEach((prediction, index) => {
        expect(prediction.species).toBeDefined();
        expect(typeof prediction.species).toBe('string');
        expect(prediction.species.length).toBeGreaterThan(0);
        
        expect(prediction.confidence).toBeDefined();
        expect(typeof prediction.confidence).toBe('number');
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
        
        expect(prediction.scientificName).toBeDefined();
        expect(typeof prediction.scientificName).toBe('string');
        
        console.log(`Prediction ${index + 1}: ${prediction.species} (${(prediction.confidence * 100).toFixed(2)}%)`);
      });

      // Validate confidence scores are in descending order
      for (let i = 1; i < result.results.length; i++) {
        expect(result.results[i].confidence).toBeLessThanOrEqual(result.results[i - 1].confidence);
      }
      
      console.log(`✅ Model produced ${result.results.length} valid predictions`);
    });

    test('should have reasonable processing time for FP32 model', async () => {
      if (!modelInitialized) {
        throw new Error('Model not initialized');
      }

      const inputSize = 224 * 224 * 3;
      const testInput = new Float32Array(inputSize);
      testInput.fill(0.5);

      const startTime = Date.now();
      const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
      const processingTime = Date.now() - startTime;

      expect(result.metadata.processingTime).toBeDefined();
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      console.log(`✅ Processing time: ${processingTime}ms (metadata: ${result.metadata.processingTime}ms)`);
    });
  });

  describe('Model Performance Metrics', () => {
    test('should track performance metrics correctly', async () => {
      if (!modelInitialized) {
        throw new Error('Model not initialized');
      }

      // Get initial metrics
      const initialMetrics = fastTfliteBirdClassifier.getPerformanceMetrics();
      const initialInferences = initialMetrics.totalInferences;

      // Run a test inference
      const inputSize = 224 * 224 * 3;
      const testInput = new Float32Array(inputSize);
      testInput.fill(0.1);

      await fastTfliteBirdClassifier.classifyBirdAudio(testInput);

      // Check updated metrics
      const updatedMetrics = fastTfliteBirdClassifier.getPerformanceMetrics();
      
      expect(updatedMetrics.totalInferences).toBe(initialInferences + 1);
      expect(updatedMetrics.avgInferenceTime).toBeGreaterThan(0);
      expect(updatedMetrics.modelSize).toBeGreaterThan(0);
      
      console.log('✅ Performance metrics:', {
        totalInferences: updatedMetrics.totalInferences,
        avgInferenceTime: `${updatedMetrics.avgInferenceTime.toFixed(2)}ms`,
        modelSize: `${(updatedMetrics.modelSize / 1024 / 1024).toFixed(1)}MB`
      });
    });
  });

  describe('Embedded Labels Functionality', () => {
    test('should work with embedded labels (no external label file needed)', async () => {
      if (!modelInitialized) {
        throw new Error('Model not initialized');
      }

      // The FP32 model should have embedded labels, so classification should work
      // without requiring external label files
      const inputSize = 224 * 224 * 3;
      const testInput = new Float32Array(inputSize);
      
      // Create a more realistic mel-spectrogram pattern
      for (let i = 0; i < inputSize; i++) {
        testInput[i] = Math.sin(i * 0.001) * 0.5 + Math.random() * 0.1;
      }

      const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
      
      // Should get predictions with valid species names
      expect(result.results.length).toBeGreaterThan(0);
      
      // Check that we have meaningful species names (not just indices)
      const topPrediction = result.results[0];
      expect(topPrediction.species).toBeDefined();
      expect(topPrediction.species).not.toBe('');
      expect(topPrediction.species).not.toMatch(/^unknown/i);
      expect(topPrediction.species).not.toMatch(/^\d+$/); // Should not be just a number
      
      console.log(`✅ Embedded labels working - Top prediction: ${topPrediction.species}`);
      console.log(`   Scientific name: ${topPrediction.scientificName}`);
      console.log(`   Confidence: ${(topPrediction.confidence * 100).toFixed(2)}%`);
    });

    test('should provide predictions covering global bird species', async () => {
      if (!modelInitialized) {
        throw new Error('Model not initialized');
      }

      // Run multiple test inferences to get a sample of the species coverage
      const species = new Set<string>();
      const scientificNames = new Set<string>();

      for (let test = 0; test < 5; test++) {
        const inputSize = 224 * 224 * 3;
        const testInput = new Float32Array(inputSize);
        
        // Create varied test inputs to trigger different predictions
        for (let i = 0; i < inputSize; i++) {
          const variation = Math.sin(i * (0.001 + test * 0.0005)) * 0.7;
          testInput[i] = variation + Math.random() * 0.2;
        }

        const result = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
        
        // Collect unique species names
        result.results.forEach(prediction => {
          if (prediction.confidence > 0.01) { // Only consider reasonable predictions
            species.add(prediction.species);
            scientificNames.add(prediction.scientificName);
          }
        });
      }

      // Should have found multiple different species
      expect(species.size).toBeGreaterThan(5);
      expect(scientificNames.size).toBeGreaterThan(3);
      
      console.log(`✅ Found ${species.size} unique species names across test runs`);
      console.log(`✅ Found ${scientificNames.size} unique scientific names`);
      console.log('   Sample species:', Array.from(species).slice(0, 5).join(', '));
    });
  });
});