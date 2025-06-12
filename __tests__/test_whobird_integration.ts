/**
 * Integration test for whoBIRD models with existing pipeline
 * 
 * Tests each model by updating the FastTfliteBirdClassifier configuration
 */

import { fastTfliteBirdClassifier } from '../services/fastTfliteBirdClassifier';
import { AudioPreprocessingTFLite } from '../services/audioPreprocessingTFLite';

interface ModelTestResult {
  modelName: string;
  modelPath: string;
  success: boolean;
  error?: string;
  predictionCount?: number;
  topPredictions?: Array<{
    species: string;
    confidence: number;
  }>;
  inferenceTime?: number;
}

const whoBirdModels = [
  {
    name: 'BirdNET_GLOBAL_6K_V2.4_Model_FP32',
    path: require('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite'),
  },
  {
    name: 'BirdNET_GLOBAL_6K_V2.4_Model_FP16',
    path: require('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_Model_FP16.tflite'),
  },
  {
    name: 'BirdNET_GLOBAL_6K_V2.4_MData_Model_FP16',
    path: require('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_MData_Model_FP16.tflite'),
  },
  {
    name: 'BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16',
    path: require('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16.tflite'),
  },
];

describe('whoBIRD Model Integration Tests', () => {
  const originalModelPath = require('../assets/models/birdnet/birdnet_v24.tflite');
  
  beforeEach(() => {
    // Clear any cached models
    fastTfliteBirdClassifier.dispose();
  });

  afterAll(() => {
    // Restore original model
    fastTfliteBirdClassifier.updateConfig({
      modelPath: originalModelPath
    });
    fastTfliteBirdClassifier.dispose();
  });

  // Test each model
  whoBirdModels.forEach((modelConfig) => {
    test(`should test ${modelConfig.name} compatibility`, async () => {
      const result: ModelTestResult = {
        modelName: modelConfig.name,
        modelPath: modelConfig.path,
        success: false
      };

      try {
        console.log(`\nTesting ${modelConfig.name}...`);
        
        // Update classifier to use this model
        fastTfliteBirdClassifier.updateConfig({
          modelPath: modelConfig.path,
          confidenceThreshold: 0.01, // Lower threshold to see more results
          maxResults: 10
        });

        // Initialize the model
        const initialized = await fastTfliteBirdClassifier.initialize();
        expect(initialized).toBe(true);

        // Create test audio data (3 seconds of simulated bird chirp)
        const sampleRate = 48000;
        const duration = 3;
        const audioData = new Float32Array(sampleRate * duration);
        
        // Generate a simple chirp pattern
        for (let i = 0; i < audioData.length; i++) {
          const t = i / sampleRate;
          // Frequency sweep from 1kHz to 3kHz
          const frequency = 1000 + 2000 * (t / duration);
          // Add some amplitude modulation
          const amplitude = 0.5 * Math.sin(2 * Math.PI * 2 * t);
          audioData[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
        }

        // Process audio through preprocessing pipeline
        const processedData = await AudioPreprocessingTFLite.processAudioFile(
          'test://simulated-audio'
        );

        // For testing, we'll create mock processed data since we can't actually load audio
        const mockProcessedData = new Float32Array(224 * 224 * 3);
        // Fill with test pattern
        for (let i = 0; i < mockProcessedData.length; i++) {
          mockProcessedData[i] = Math.random() * 0.1; // Small random values
        }

        // Run classification
        const startTime = Date.now();
        const { results, metadata } = await fastTfliteBirdClassifier.classifyBirdAudio(
          mockProcessedData
        );
        const inferenceTime = Date.now() - startTime;

        result.success = true;
        result.predictionCount = results.length;
        result.inferenceTime = inferenceTime;
        result.topPredictions = results.slice(0, 3).map(r => ({
          species: r.species,
          confidence: r.confidence
        }));

        console.log(`✅ ${modelConfig.name} test passed`);
        console.log(`   Predictions: ${results.length}`);
        console.log(`   Inference time: ${inferenceTime}ms`);
        if (results.length > 0) {
          console.log(`   Top prediction: ${results[0].species} (${(results[0].confidence * 100).toFixed(2)}%)`);
        }

      } catch (error) {
        result.success = false;
        result.error = error instanceof Error ? error.message : String(error);
        console.error(`❌ ${modelConfig.name} test failed:`, result.error);
      }

      // Store result for summary
      (global as any).whoBirdTestResults = (global as any).whoBirdTestResults || [];
      (global as any).whoBirdTestResults.push(result);

      // Assert test passed
      expect(result.success).toBe(true);
    }, 30000); // 30 second timeout per model
  });

  // Summary test
  test('should provide test summary', () => {
    const results: ModelTestResult[] = (global as any).whoBirdTestResults || [];
    
    console.log('\n========== WHOBIRD MODEL TEST SUMMARY ==========');
    console.log(`Total models tested: ${results.length}`);
    console.log(`Passed: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);
    
    console.log('\nDetailed Results:');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const details = result.success 
        ? `Predictions: ${result.predictionCount}, Time: ${result.inferenceTime}ms`
        : `Error: ${result.error}`;
      console.log(`${status} ${result.modelName} - ${details}`);
    });

    // Find best performing model
    const successfulModels = results.filter(r => r.success);
    if (successfulModels.length > 0) {
      const bestModel = successfulModels.reduce((best, current) => 
        (current.inferenceTime || Infinity) < (best.inferenceTime || Infinity) ? current : best
      );
      
      console.log(`\n🏆 Best performing model: ${bestModel.modelName}`);
      console.log(`   - Inference time: ${bestModel.inferenceTime}ms`);
      console.log(`   - Predictions: ${bestModel.predictionCount}`);
    }
  });
});

// Alternative simple test function for manual testing
export async function testWhoBirdModelManually(modelPath: string, modelName: string): Promise<void> {
  try {
    console.log(`\nManually testing ${modelName}...`);
    
    // Update config
    fastTfliteBirdClassifier.updateConfig({
      modelPath: modelPath,
      confidenceThreshold: 0.01,
      maxResults: 10
    });

    // Initialize
    const initialized = await fastTfliteBirdClassifier.initialize();
    if (!initialized) {
      throw new Error('Failed to initialize model');
    }

    // Create test data
    const testData = new Float32Array(224 * 224 * 3);
    testData.fill(0.1);

    // Run inference
    const { results, metadata } = await fastTfliteBirdClassifier.classifyBirdAudio(testData);

    console.log(`✅ Model loaded and inference successful!`);
    console.log(`Processing time: ${metadata.processingTime}ms`);
    console.log(`Number of predictions: ${results.length}`);
    
    if (results.length > 0) {
      console.log('\nTop 5 predictions:');
      results.slice(0, 5).forEach((r, i) => {
        console.log(`${i + 1}. ${r.species} - ${(r.confidence * 100).toFixed(2)}%`);
      });
    }

  } catch (error) {
    console.error(`❌ Test failed:`, error);
  } finally {
    fastTfliteBirdClassifier.dispose();
  }
}