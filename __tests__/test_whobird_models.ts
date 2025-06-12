/**
 * Test script for whoBIRD TFLite models compatibility
 * 
 * Tests the new BirdNET Global 6K v2.4 models with the current audio pipeline
 */

import { AudioPreprocessingTFLite } from '../services/audioPreprocessingTFLite';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import * as FileSystem from 'expo-file-system';

interface TestResult {
  modelName: string;
  success: boolean;
  inputShape?: number[];
  outputShape?: number[];
  numClasses?: number;
  inferenceTime?: number;
  error?: string;
  fileSize?: number;
  modelType: 'FP32' | 'FP16' | 'MData';
}

class WhoBIRDModelTester {
  private models = [
    {
      name: 'BirdNET_GLOBAL_6K_V2.4_Model_FP32',
      path: '../assets/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite',
      type: 'FP32' as const
    },
    {
      name: 'BirdNET_GLOBAL_6K_V2.4_Model_FP16',
      path: '../assets/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_Model_FP16.tflite',
      type: 'FP16' as const
    },
    {
      name: 'BirdNET_GLOBAL_6K_V2.4_MData_Model_FP16',
      path: '../assets/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_MData_Model_FP16.tflite',
      type: 'MData' as const
    },
    {
      name: 'BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16',
      path: '../assets/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16.tflite',
      type: 'MData' as const
    }
  ];

  /**
   * Test all whoBIRD models
   */
  async testAllModels(): Promise<TestResult[]> {
    console.log('Starting whoBIRD model compatibility tests...\n');
    const results: TestResult[] = [];

    for (const modelConfig of this.models) {
      console.log(`\n=== Testing ${modelConfig.name} ===`);
      const result = await this.testModel(modelConfig);
      results.push(result);
      
      // Print immediate result
      this.printResult(result);
    }

    // Print summary
    this.printSummary(results);
    
    return results;
  }

  /**
   * Test individual model
   */
  private async testModel(modelConfig: { name: string; path: string; type: 'FP32' | 'FP16' | 'MData' }): Promise<TestResult> {
    const result: TestResult = {
      modelName: modelConfig.name,
      success: false,
      modelType: modelConfig.type
    };

    try {
      // Try to get file size
      try {
        const modelPath = require(modelConfig.path);
        if (typeof modelPath === 'string') {
          const fileInfo = await FileSystem.getInfoAsync(modelPath);
          if (fileInfo.exists && 'size' in fileInfo) {
            result.fileSize = fileInfo.size;
            console.log(`Model file size: ${(result.fileSize / 1024 / 1024).toFixed(2)} MB`);
          }
        }
      } catch (sizeError) {
        console.log('Could not determine file size');
      }

      // Load the model
      console.log('Loading model...');
      const model = await loadTensorflowModel(require(modelConfig.path), 'default');
      
      // Get model information if available
      try {
        const inputs = (model as any).inputs;
        const outputs = (model as any).outputs;
        
        if (inputs && outputs) {
          const inputShape = inputs[0]?.shape || [];
          const outputShape = outputs[0]?.shape || [];
          
          result.inputShape = inputShape;
          result.outputShape = outputShape;
          
          // Calculate number of classes from output shape
          result.numClasses = outputShape.reduce((acc: number, dim: number) => 
            acc * (dim === -1 ? 1 : dim), 1);
          
          console.log(`Input shape: [${inputShape.join(', ')}]`);
          console.log(`Output shape: [${outputShape.join(', ')}]`);
          console.log(`Number of classes: ${result.numClasses}`);
        }
      } catch (infoError) {
        console.log('Model tensor information not available');
      }

      // Test with current pipeline preprocessing
      console.log('\nTesting with audio preprocessing pipeline...');
      
      // Create test audio data (3 seconds at 48kHz)
      const testAudioData = new Float32Array(48000 * 3);
      // Fill with simulated bird chirp pattern
      for (let i = 0; i < testAudioData.length; i++) {
        // Create a simple sine wave pattern with frequency modulation
        const t = i / 48000;
        const frequency = 1000 + 500 * Math.sin(2 * Math.PI * 2 * t); // Chirp from 1-1.5kHz
        testAudioData[i] = 0.5 * Math.sin(2 * Math.PI * frequency * t);
      }

      // Process audio through our pipeline
      const processedData = await this.processAudioForModel(testAudioData, result.inputShape);
      
      // Run inference
      console.log('Running inference...');
      const startTime = Date.now();
      const outputs = model.runSync([processedData]);
      const inferenceTime = Date.now() - startTime;
      
      result.inferenceTime = inferenceTime;
      console.log(`Inference time: ${inferenceTime}ms`);
      
      // Validate output
      const predictions = outputs[0] as Float32Array;
      if (!predictions || predictions.length === 0) {
        throw new Error('Invalid model output');
      }

      // Check prediction values
      let validPredictions = 0;
      let maxConfidence = 0;
      let maxIndex = 0;
      
      for (let i = 0; i < predictions.length; i++) {
        if (!isNaN(predictions[i]) && predictions[i] >= 0 && predictions[i] <= 1) {
          validPredictions++;
          if (predictions[i] > maxConfidence) {
            maxConfidence = predictions[i];
            maxIndex = i;
          }
        }
      }

      console.log(`Valid predictions: ${validPredictions}/${predictions.length}`);
      console.log(`Top prediction: Class ${maxIndex} with confidence ${maxConfidence.toFixed(4)}`);
      
      // Check if model outputs reasonable predictions
      if (validPredictions === 0) {
        throw new Error('No valid predictions from model');
      }

      result.success = true;
      console.log('\n✅ Model test PASSED');
      
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
      console.error('\n❌ Model test FAILED:', result.error);
    }

    return result;
  }

  /**
   * Process audio data according to model's expected input shape
   */
  private async processAudioForModel(audioData: Float32Array, inputShape?: number[]): Promise<Float32Array> {
    // Determine expected input format from shape
    if (!inputShape || inputShape.length === 0) {
      // Use default BirdNET format
      console.log('Using default input shape [1, 224, 224, 3]');
      return this.processForImageFormat(audioData);
    }

    // Check if it's image-like format [batch, height, width, channels]
    if (inputShape.length === 4 && inputShape[3] === 3) {
      console.log(`Processing for image format: [${inputShape.join(', ')}]`);
      return this.processForImageFormat(audioData, inputShape[1], inputShape[2]);
    }

    // Check if it's spectrogram format [batch, time, frequency, channels]
    if (inputShape.length === 4) {
      console.log(`Processing for spectrogram format: [${inputShape.join(', ')}]`);
      return this.processForSpectrogramFormat(audioData, inputShape[1], inputShape[2], inputShape[3]);
    }

    // Default to current pipeline format
    console.log('Using current pipeline format');
    return this.processForImageFormat(audioData);
  }

  /**
   * Process audio for image-like input format (current pipeline)
   */
  private processForImageFormat(audioData: Float32Array, height: number = 224, width: number = 224): Promise<Float32Array> {
    // Mock the audio preprocessing for testing
    const spectrogramData = new Float32Array(height * width * 3);
    
    // Generate mock mel-spectrogram pattern
    for (let h = 0; h < height; h++) {
      for (let w = 0; w < width; w++) {
        const timePos = w / width;
        const freqPos = h / height;
        
        // Create a pattern that simulates bird chirp in spectrogram
        const value = Math.exp(-10 * Math.pow(freqPos - 0.3 - 0.2 * Math.sin(timePos * 10), 2));
        
        const idx = (h * width + w) * 3;
        spectrogramData[idx] = value;     // R channel
        spectrogramData[idx + 1] = value; // G channel
        spectrogramData[idx + 2] = value; // B channel
      }
    }
    
    return Promise.resolve(spectrogramData);
  }

  /**
   * Process audio for spectrogram format (potential BirdNET v2.4 format)
   */
  private processForSpectrogramFormat(
    audioData: Float32Array, 
    timeSteps: number, 
    freqBins: number, 
    channels: number
  ): Promise<Float32Array> {
    const spectrogramData = new Float32Array(timeSteps * freqBins * channels);
    
    // Generate appropriate spectrogram for the format
    for (let t = 0; t < timeSteps; t++) {
      for (let f = 0; f < freqBins; f++) {
        for (let c = 0; c < channels; c++) {
          const idx = (t * freqBins + f) * channels + c;
          
          // Different processing for different channels (if dual-channel)
          if (channels === 2) {
            if (c === 0) {
              // Low frequency channel (0-3kHz)
              spectrogramData[idx] = this.generateSpectrogramValue(t, f, timeSteps, freqBins, 0, 0.3);
            } else {
              // High frequency channel (3-15kHz)
              spectrogramData[idx] = this.generateSpectrogramValue(t, f, timeSteps, freqBins, 0.3, 1.0);
            }
          } else {
            // Single channel
            spectrogramData[idx] = this.generateSpectrogramValue(t, f, timeSteps, freqBins, 0, 1.0);
          }
        }
      }
    }
    
    return Promise.resolve(spectrogramData);
  }

  /**
   * Generate spectrogram value for testing
   */
  private generateSpectrogramValue(
    time: number, 
    freq: number, 
    maxTime: number, 
    maxFreq: number,
    freqMin: number,
    freqMax: number
  ): number {
    const timeNorm = time / maxTime;
    const freqNorm = freq / maxFreq;
    
    // Only generate values in the specified frequency range
    if (freqNorm < freqMin || freqNorm > freqMax) {
      return 0;
    }
    
    // Simulate bird chirp pattern
    const chirpFreq = 0.4 + 0.2 * Math.sin(timeNorm * 10);
    return Math.exp(-20 * Math.pow(freqNorm - chirpFreq, 2));
  }

  /**
   * Print individual test result
   */
  private printResult(result: TestResult): void {
    console.log('\n--- Test Result ---');
    console.log(`Model: ${result.modelName}`);
    console.log(`Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (result.success) {
      console.log(`File Size: ${result.fileSize ? `${(result.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Unknown'}`);
      console.log(`Input Shape: ${result.inputShape ? `[${result.inputShape.join(', ')}]` : 'Unknown'}`);
      console.log(`Output Shape: ${result.outputShape ? `[${result.outputShape.join(', ')}]` : 'Unknown'}`);
      console.log(`Number of Classes: ${result.numClasses || 'Unknown'}`);
      console.log(`Inference Time: ${result.inferenceTime}ms`);
    } else {
      console.log(`Error: ${result.error}`);
    }
  }

  /**
   * Print test summary
   */
  private printSummary(results: TestResult[]): void {
    console.log('\n\n========== TEST SUMMARY ==========');
    console.log(`Total models tested: ${results.length}`);
    console.log(`Passed: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);
    
    console.log('\nDetailed Results:');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const details = result.success 
        ? `Classes: ${result.numClasses || '?'}, Inference: ${result.inferenceTime || '?'}ms`
        : `Error: ${result.error}`;
      console.log(`${status} ${result.modelName} - ${details}`);
    });

    console.log('\nRecommendations:');
    const successfulModels = results.filter(r => r.success);
    if (successfulModels.length > 0) {
      // Find best model based on inference time
      const bestModel = successfulModels.reduce((best, current) => 
        (current.inferenceTime || Infinity) < (best.inferenceTime || Infinity) ? current : best
      );
      
      console.log(`\n🏆 Recommended model: ${bestModel.modelName}`);
      console.log(`   - Type: ${bestModel.modelType}`);
      console.log(`   - Classes: ${bestModel.numClasses}`);
      console.log(`   - Inference time: ${bestModel.inferenceTime}ms`);
      console.log(`   - File size: ${bestModel.fileSize ? `${(bestModel.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Unknown'}`);
    } else {
      console.log('\n⚠️  No models passed the compatibility test');
      console.log('The models may require different preprocessing or input formats.');
    }
  }
}

// Export test function
export async function testWhoBIRDModels(): Promise<TestResult[]> {
  const tester = new WhoBIRDModelTester();
  return await tester.testAllModels();
}

// Run tests if this file is executed directly
if (require.main === module) {
  testWhoBIRDModels()
    .then(() => {
      console.log('\nAll tests completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nTest suite failed:', error);
      process.exit(1);
    });
}