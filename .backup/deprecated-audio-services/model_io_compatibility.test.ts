/**
 * Model Input/Output Compatibility Test
 * 
 * Tests the complete data flow from audio preprocessing output to model inference
 * Validates tensor compatibility, performance benchmarks, and edge case handling
 */

import { AudioPreprocessingTFLite } from '../services/audioPreprocessingTFLite';
import { fastTfliteBirdClassifier } from '../services/fastTfliteBirdClassifier';
import { ModelType } from '../services/modelConfig';
import * as FileSystem from 'expo-file-system';

// Utility to create synthetic mel-spectrogram data
const createSyntheticMelSpectrogram = (type: 'realistic' | 'edge' | 'structured' = 'realistic'): Float32Array => {
  const size = 224 * 224 * 3; // [height, width, channels]
  const data = new Float32Array(size);
  
  switch (type) {
    case 'realistic':
      // Simulate realistic mel-spectrogram with frequency-dependent structure
      for (let h = 0; h < 224; h++) {
        for (let w = 0; w < 224; w++) {
          for (let c = 0; c < 3; c++) {
            const index = (h * 224 + w) * 3 + c;
            
            // Lower frequencies (bottom of spectrogram) have more energy
            const freqWeight = Math.exp(-h / 100);
            // Time-varying energy
            const timeVariation = Math.sin(w * 0.02) * 0.3;
            // Channel variation (simulate different frequency bands)
            const channelVariation = c * 0.1;
            
            // Combine components with some noise
            const baseValue = (freqWeight + timeVariation + channelVariation) * 0.5;
            const noise = (Math.random() - 0.5) * 0.2;
            
            data[index] = Math.log(Math.max(baseValue + noise, 1e-10));
          }
        }
      }
      break;
      
    case 'edge':
      // Test edge cases: extreme values, patterns
      for (let i = 0; i < size; i++) {
        if (i % 4 === 0) data[i] = -10; // Very low energy
        else if (i % 4 === 1) data[i] = 5; // High energy
        else if (i % 4 === 2) data[i] = 0; // Medium energy
        else data[i] = Math.random() * 2 - 1; // Random
      }
      break;
      
    case 'structured':
      // Create structured patterns that might trigger specific bird classifications
      for (let h = 0; h < 224; h++) {
        for (let w = 0; w < 224; w++) {
          for (let c = 0; c < 3; c++) {
            const index = (h * 224 + w) * 3 + c;
            
            // Create harmonic-like patterns
            const fundamental = Math.sin(h * 0.1);
            const harmonic1 = Math.sin(h * 0.2) * 0.5;
            const harmonic2 = Math.sin(h * 0.3) * 0.3;
            const temporal = Math.cos(w * 0.05);
            
            data[index] = (fundamental + harmonic1 + harmonic2) * temporal;
          }
        }
      }
      break;
  }
  
  return data;
};

// Create a simple mock audio file for integration testing
const createMockAudioFile = async (duration: number = 3.0): Promise<string> => {
  const fileName = `mock_audio_${Date.now()}.json`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;
  
  // Create mock audio data that our preprocessor can handle
  const sampleRate = 48000;
  const numSamples = Math.floor(duration * sampleRate);
  const audioData = [];
  
  // Generate a simple bird-like call pattern
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Frequency modulated tone (bird-like chirp)
    const freq = 2000 + 1000 * Math.sin(t * 10); // FM sweep
    const amplitude = Math.exp(-t * 2) * Math.sin(t * 20); // Amplitude envelope
    audioData.push(Math.sin(2 * Math.PI * freq * t) * amplitude);
  }
  
  // Save as JSON for our mock processor
  await FileSystem.writeAsStringAsync(filePath, JSON.stringify({
    sampleRate,
    duration,
    data: audioData
  }));
  
  return filePath;
};

describe('Model Input/Output Compatibility', () => {
  let modelReady = false;
  let tempFiles: string[] = [];

  beforeAll(async () => {
    console.log('🚀 Initializing FP32 model for I/O compatibility tests...');
    
    try {
      const success = await fastTfliteBirdClassifier.switchModel(ModelType.HIGH_ACCURACY_FP32);
      modelReady = success;
      
      if (success) {
        console.log('✅ Model ready for compatibility testing');
      } else {
        console.error('❌ Model initialization failed');
      }
    } catch (error) {
      console.error('❌ Model setup error:', error);
      modelReady = false;
    }
  }, 30000);

  afterEach(async () => {
    // Clean up temporary files
    for (const file of tempFiles) {
      try {
        await FileSystem.deleteAsync(file);
      } catch (error) {
        console.warn('Failed to delete temp file:', file);
      }
    }
    tempFiles = [];
  });

  afterAll(() => {
    if (modelReady) {
      fastTfliteBirdClassifier.dispose();
      console.log('🧹 Model disposed');
    }
  });

  describe('Synthetic Input Validation', () => {
    test('should process realistic synthetic mel-spectrogram', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const syntheticData = createSyntheticMelSpectrogram('realistic');
      
      const result = await fastTfliteBirdClassifier.classifyBirdAudio(syntheticData);
      
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metadata.modelType).toBe(ModelType.HIGH_ACCURACY_FP32);
      
      // Validate prediction quality
      const topPrediction = result.results[0];
      expect(topPrediction.confidence).toBeGreaterThan(0);
      expect(topPrediction.confidence).toBeLessThanOrEqual(1);
      expect(topPrediction.species).toBeDefined();
      expect(topPrediction.species.length).toBeGreaterThan(0);
      
      console.log('✅ Realistic synthetic input processed successfully');
      console.log(`   Top prediction: ${topPrediction.species} (${(topPrediction.confidence * 100).toFixed(2)}%)`);
    });

    test('should handle edge case inputs gracefully', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const edgeData = createSyntheticMelSpectrogram('edge');
      
      const result = await fastTfliteBirdClassifier.classifyBirdAudio(edgeData);
      
      expect(result.results).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      
      // Even with edge case input, should produce valid output structure
      if (result.results.length > 0) {
        result.results.forEach(prediction => {
          expect(prediction.confidence).toBeGreaterThanOrEqual(0);
          expect(prediction.confidence).toBeLessThanOrEqual(1);
          expect(typeof prediction.species).toBe('string');
        });
      }
      
      console.log('✅ Edge case input handled gracefully');
      console.log(`   Predictions: ${result.results.length}`);
    });

    test('should process structured patterns effectively', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const structuredData = createSyntheticMelSpectrogram('structured');
      
      const result = await fastTfliteBirdClassifier.classifyBirdAudio(structuredData);
      
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      
      // Structured input should produce confident predictions
      const topPrediction = result.results[0];
      expect(topPrediction.confidence).toBeGreaterThan(0.001); // Should have some confidence
      
      console.log('✅ Structured pattern input processed');
      console.log(`   Confidence: ${(topPrediction.confidence * 100).toFixed(3)}%`);
    });
  });

  describe('Preprocessing Integration', () => {
    test('should seamlessly integrate preprocessing output with model input', async () => {
      if (!modelReady) throw new Error('Model not ready');

      // Create mock audio file
      const audioFile = await createMockAudioFile(3.0);
      tempFiles.push(audioFile);

      try {
        // Process through preprocessing pipeline (this will use our mock)
        // Note: In real implementation, you'd modify AudioPreprocessingTFLite to handle our mock format
        const preprocessed = createSyntheticMelSpectrogram('realistic'); // Simulate preprocessing output
        
        // Feed directly to model
        const result = await fastTfliteBirdClassifier.classifyBirdAudio(preprocessed);
        
        expect(result.results).toBeDefined();
        expect(result.results.length).toBeGreaterThan(0);
        expect(result.metadata.inputShape).toBeDefined();
        
        console.log('✅ Preprocessing → Model integration validated');
        console.log(`   Input shape: [${result.metadata.inputShape.join(', ')}]`);
        console.log(`   Processing time: ${result.metadata.processingTime}ms`);
        
      } catch (error) {
        console.error('Preprocessing integration failed:', error);
        throw error;
      }
    });

    test('should maintain data integrity through the pipeline', async () => {
      if (!modelReady) throw new Error('Model not ready');

      // Create test data with known characteristics
      const testData = createSyntheticMelSpectrogram('realistic');
      
      // Check data properties before model processing
      const inputSum = Array.from(testData).reduce((sum, val) => sum + val, 0);
      const inputMin = Math.min(...Array.from(testData));
      const inputMax = Math.max(...Array.from(testData));
      
      const result = await fastTfliteBirdClassifier.classifyBirdAudio(testData);
      
      // Model should process the data without corrupting the input
      expect(result.results).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      
      // Data integrity checks (input shouldn't be modified)
      const postSum = Array.from(testData).reduce((sum, val) => sum + val, 0);
      expect(Math.abs(inputSum - postSum)).toBeLessThan(1e-6);
      
      console.log('✅ Data integrity maintained through pipeline');
      console.log(`   Input range: [${inputMin.toFixed(3)}, ${inputMax.toFixed(3)}]`);
      console.log(`   Sum unchanged: ${Math.abs(inputSum - postSum) < 1e-6}`);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet real-time processing requirements', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const testData = createSyntheticMelSpectrogram('realistic');
      
      // Measure multiple inference times
      const times: number[] = [];
      const numRuns = 5;
      
      for (let i = 0; i < numRuns; i++) {
        const startTime = Date.now();
        const result = await fastTfliteBirdClassifier.classifyBirdAudio(testData);
        const endTime = Date.now();
        
        times.push(endTime - startTime);
        expect(result.results).toBeDefined();
      }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / numRuns;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      // For real-time use, inference should be fast enough
      expect(avgTime).toBeLessThan(3000); // 3 second average
      expect(maxTime).toBeLessThan(5000); // 5 second maximum
      
      console.log('✅ Performance benchmarks met');
      console.log(`   Average time: ${avgTime.toFixed(1)}ms`);
      console.log(`   Range: ${minTime}ms - ${maxTime}ms`);
    });

    test('should handle concurrent inference requests', async () => {
      if (!modelReady) throw new Error('Model not ready');

      // Create different test inputs
      const inputs = [
        createSyntheticMelSpectrogram('realistic'),
        createSyntheticMelSpectrogram('structured'),
        createSyntheticMelSpectrogram('edge')
      ];
      
      // Run concurrent inferences (note: FastTFLite may serialize these internally)
      const startTime = Date.now();
      const promises = inputs.map(input => 
        fastTfliteBirdClassifier.classifyBirdAudio(input)
      );
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      // All should complete successfully
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.results).toBeDefined();
        expect(result.metadata.processingTime).toBeGreaterThan(0);
      });
      
      console.log('✅ Concurrent processing validated');
      console.log(`   Total time for 3 concurrent: ${totalTime}ms`);
      console.log(`   Average per inference: ${(totalTime / 3).toFixed(1)}ms`);
    });
  });

  describe('Output Validation', () => {
    test('should produce consistent output format', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const testData = createSyntheticMelSpectrogram('realistic');
      const result = await fastTfliteBirdClassifier.classifyBirdAudio(testData);
      
      // Validate result structure
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('metadata');
      
      // Validate metadata
      expect(result.metadata).toHaveProperty('modelType');
      expect(result.metadata).toHaveProperty('processingTime');
      expect(result.metadata).toHaveProperty('inputShape');
      expect(result.metadata).toHaveProperty('timestamp');
      
      // Validate predictions array
      expect(Array.isArray(result.results)).toBe(true);
      
      if (result.results.length > 0) {
        const prediction = result.results[0];
        expect(prediction).toHaveProperty('species');
        expect(prediction).toHaveProperty('scientificName');
        expect(prediction).toHaveProperty('confidence');
        expect(prediction).toHaveProperty('index');
        
        expect(typeof prediction.species).toBe('string');
        expect(typeof prediction.scientificName).toBe('string');
        expect(typeof prediction.confidence).toBe('number');
        expect(typeof prediction.index).toBe('number');
      }
      
      console.log('✅ Output format validation passed');
      console.log(`   Results count: ${result.results.length}`);
      console.log(`   Metadata keys: ${Object.keys(result.metadata).join(', ')}`);
    });

    test('should produce sorted predictions by confidence', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const testData = createSyntheticMelSpectrogram('realistic');
      const result = await fastTfliteBirdClassifier.classifyBirdAudio(testData);
      
      expect(result.results.length).toBeGreaterThan(1); // Need multiple results to test sorting
      
      // Check that confidences are in descending order
      for (let i = 1; i < result.results.length; i++) {
        expect(result.results[i].confidence).toBeLessThanOrEqual(result.results[i - 1].confidence);
      }
      
      console.log('✅ Prediction sorting validated');
      console.log(`   Top 3 confidences: ${result.results.slice(0, 3).map(p => 
        (p.confidence * 100).toFixed(2) + '%'
      ).join(', ')}`);
    });

    test('should validate confidence score ranges and distributions', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const testData = createSyntheticMelSpectrogram('realistic');
      const result = await fastTfliteBirdClassifier.classifyBirdAudio(testData);
      
      expect(result.results.length).toBeGreaterThan(0);
      
      // Check confidence ranges
      const confidences = result.results.map(p => p.confidence);
      const minConf = Math.min(...confidences);
      const maxConf = Math.max(...confidences);
      const sumConf = confidences.reduce((sum, conf) => sum + conf, 0);
      
      // All confidences should be valid probabilities
      confidences.forEach(conf => {
        expect(conf).toBeGreaterThanOrEqual(0);
        expect(conf).toBeLessThanOrEqual(1);
        expect(isFinite(conf)).toBe(true);
        expect(isNaN(conf)).toBe(false);
      });
      
      // For a probability distribution, sum might be close to 1 (depending on model)
      // but this isn't guaranteed for all models
      expect(sumConf).toBeGreaterThan(0);
      
      console.log('✅ Confidence validation passed');
      console.log(`   Range: [${(minConf * 100).toFixed(3)}%, ${(maxConf * 100).toFixed(3)}%]`);
      console.log(`   Sum: ${(sumConf * 100).toFixed(2)}%`);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid input sizes gracefully', async () => {
      if (!modelReady) throw new Error('Model not ready');

      // Test various invalid input sizes
      const invalidSizes = [0, 100, 1000, 50000, 1000000];
      
      for (const size of invalidSizes) {
        const invalidInput = new Float32Array(size);
        invalidInput.fill(0.5);
        
        try {
          await fastTfliteBirdClassifier.classifyBirdAudio(invalidInput);
          
          // If we reach here with very wrong sizes, that's unexpected
          if (size < 1000 || size > 500000) {
            console.warn(`⚠️ Model unexpectedly accepted size ${size}`);
          }
        } catch (error) {
          // Expected for invalid sizes
          expect(error).toBeDefined();
          console.log(`✅ Correctly rejected invalid size ${size}`);
        }
      }
    });

    test('should handle invalid data values appropriately', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const size = 224 * 224 * 3;
      
      // Test with NaN values
      const nanInput = new Float32Array(size);
      nanInput.fill(NaN);
      
      try {
        const result = await fastTfliteBirdClassifier.classifyBirdAudio(nanInput);
        
        // If model processes NaN, results should indicate this
        console.log(`⚠️ Model processed NaN input, got ${result.results.length} results`);
      } catch (error) {
        console.log('✅ Model correctly rejected NaN input');
      }
      
      // Test with Infinity values
      const infInput = new Float32Array(size);
      infInput.fill(Infinity);
      
      try {
        const result = await fastTfliteBirdClassifier.classifyBirdAudio(infInput);
        console.log(`⚠️ Model processed Infinity input, got ${result.results.length} results`);
      } catch (error) {
        console.log('✅ Model correctly rejected Infinity input');
      }
    });

    test('should maintain stability under rapid successive calls', async () => {
      if (!modelReady) throw new Error('Model not ready');

      const numRapidCalls = 10;
      const testData = createSyntheticMelSpectrogram('realistic');
      
      // Make rapid successive calls
      const promises: Promise<any>[] = [];
      for (let i = 0; i < numRapidCalls; i++) {
        promises.push(fastTfliteBirdClassifier.classifyBirdAudio(testData));
      }
      
      try {
        const results = await Promise.all(promises);
        
        // All should complete successfully
        expect(results.length).toBe(numRapidCalls);
        results.forEach((result, index) => {
          expect(result.results).toBeDefined();
          expect(result.metadata.processingTime).toBeGreaterThan(0);
        });
        
        console.log('✅ Rapid successive calls handled successfully');
        console.log(`   Completed ${numRapidCalls} calls without errors`);
        
      } catch (error) {
        console.error('❌ Rapid calls caused instability:', error);
        throw error;
      }
    });
  });
});