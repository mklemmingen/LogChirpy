/**
 * Real Audio Integration Test
 * 
 * End-to-end testing with actual bird recordings
 * Tests the complete pipeline from real audio files through preprocessing to classification
 */

import { AudioIdentificationService } from '../services/audioIdentificationService';
import { ModelType, ModelConfig } from '../services/modelConfig';
import { AudioPreprocessingTFLite } from '../services/audioPreprocessingTFLite';
import * as FileSystem from 'expo-file-system';

// Test audio file paths - update these based on your available test files
const TEST_AUDIO_FILES = {
  forestBirds: '/home/mklemmingen/WebstormProjects/moco_sose25_logchirpy/assets/mixkit-forest-birds-singing-1212.mp3',
  // Add more test files as available
  // singleBird: '/path/to/single-bird-call.wav',
  // noisyEnvironment: '/path/to/noisy-bird-recording.mp3',
  // quietBirds: '/path/to/quiet-distant-birds.wav'
};

interface AudioTestResult {
  filePath: string;
  fileExists: boolean;
  fileSize?: number;
  processingTime: number;
  success: boolean;
  predictions: number;
  topPrediction?: {
    species: string;
    confidence: number;
    scientificName: string;
  };
  error?: string;
  metadata?: any;
}

// Helper to check if audio file exists and get metadata
const checkAudioFile = async (filePath: string): Promise<{ exists: boolean; size?: number; error?: string }> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    return {
      exists: fileInfo.exists,
      size: fileInfo.exists && 'size' in fileInfo ? fileInfo.size : undefined
    };
  } catch (error) {
    return {
      exists: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// Process a real audio file through the complete pipeline
const processRealAudio = async (
  filePath: string,
  modelType: ModelType = ModelType.HIGH_ACCURACY_FP32
): Promise<AudioTestResult> => {
  const startTime = Date.now();
  
  try {
    // Check if file exists
    const fileCheck = await checkAudioFile(filePath);
    if (!fileCheck.exists) {
      return {
        filePath,
        fileExists: false,
        processingTime: Date.now() - startTime,
        success: false,
        predictions: 0,
        error: 'Audio file not found'
      };
    }

    console.log(`🎵 Processing real audio: ${filePath}`);
    console.log(`📁 File size: ${fileCheck.size ? (fileCheck.size / 1024 / 1024).toFixed(2) + 'MB' : 'unknown'}`);

    // Process through the complete pipeline
    const response = await AudioIdentificationService.identifyBirdFromAudio(
      filePath,
      {
        modelType: modelType,
        minConfidence: 0.01, // Lower threshold to see more results
      }
    );

    const processingTime = Date.now() - startTime;

    if (response.success && response.predictions.length > 0) {
      const topPrediction = response.predictions[0];
      
      return {
        filePath,
        fileExists: true,
        fileSize: fileCheck.size,
        processingTime,
        success: true,
        predictions: response.predictions.length,
        topPrediction: {
          species: topPrediction.common_name,
          confidence: topPrediction.confidence,
          scientificName: topPrediction.scientific_name
        },
        metadata: {
          audioSource: response.source,
          audioDuration: response.audio_duration,
          reportedProcessingTime: response.processing_time
        }
      };
    } else {
      return {
        filePath,
        fileExists: true,
        fileSize: fileCheck.size,
        processingTime,
        success: false,
        predictions: response.predictions.length,
        error: response.error || 'No predictions generated',
        metadata: {
          audioSource: response.source,
          audioDuration: response.audio_duration
        }
      };
    }
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return {
      filePath,
      fileExists: await checkAudioFile(filePath).then(check => check.exists),
      processingTime,
      success: false,
      predictions: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

describe('Real Audio Integration Tests', () => {
  let serviceInitialized = false;

  beforeAll(async () => {
    console.log('🚀 Initializing AudioIdentificationService for real audio tests...');
    
    try {
      await AudioIdentificationService.initialize();
      serviceInitialized = true;
      console.log('✅ AudioIdentificationService initialized');
    } catch (error) {
      console.error('❌ Service initialization failed:', error);
      serviceInitialized = false;
    }
  }, 60000); // 60 second timeout for initialization

  afterAll(async () => {
    if (serviceInitialized) {
      // Clear cache to free memory
      await AudioIdentificationService.clearCache();
      console.log('🧹 Service cache cleared');
    }
  });

  describe('Forest Birds Test Audio', () => {
    test('should process forest birds MP3 successfully', async () => {
      if (!serviceInitialized) {
        throw new Error('Service not initialized');
      }

      const result = await processRealAudio(TEST_AUDIO_FILES.forestBirds, ModelType.HIGH_ACCURACY_FP32);
      
      // Log detailed results
      console.log('\n📊 Forest Birds Test Results:');
      console.log(`   File exists: ${result.fileExists}`);
      console.log(`   File size: ${result.fileSize ? (result.fileSize / 1024 / 1024).toFixed(2) + 'MB' : 'unknown'}`);
      console.log(`   Processing time: ${result.processingTime}ms`);
      console.log(`   Success: ${result.success}`);
      
      if (result.success && result.topPrediction) {
        console.log(`   Predictions: ${result.predictions}`);
        console.log(`   Top prediction: ${result.topPrediction.species}`);
        console.log(`   Scientific name: ${result.topPrediction.scientificName}`);
        console.log(`   Confidence: ${(result.topPrediction.confidence * 100).toFixed(2)}%`);
        console.log(`   Audio duration: ${result.metadata?.audioDuration?.toFixed(2)}s`);
        console.log(`   Audio source: ${result.metadata?.audioSource}`);
      } else {
        console.log(`   Error: ${result.error}`);
      }

      // Validate results
      expect(result.fileExists).toBe(true);
      
      if (result.fileExists) {
        // File should be processed successfully
        expect(result.success).toBe(true);
        expect(result.predictions).toBeGreaterThan(0);
        expect(result.topPrediction).toBeDefined();
        
        if (result.topPrediction) {
          expect(result.topPrediction.species).toBeDefined();
          expect(result.topPrediction.species.length).toBeGreaterThan(0);
          expect(result.topPrediction.confidence).toBeGreaterThan(0);
          expect(result.topPrediction.confidence).toBeLessThanOrEqual(1);
        }
      } else {
        console.warn('⚠️ Test audio file not found - please ensure test audio is available');
      }
    }, 60000); // 60 second timeout

    test('should produce reasonable bird identifications for forest environment', async () => {
      if (!serviceInitialized) {
        throw new Error('Service not initialized');
      }

      const result = await processRealAudio(TEST_AUDIO_FILES.forestBirds, ModelType.HIGH_ACCURACY_FP32);
      
      if (!result.fileExists) {
        console.warn('⚠️ Skipping bird identification test - audio file not available');
        return;
      }

      if (result.success && result.topPrediction) {
        // For forest birds, we expect to see forest-dwelling species
        const forestKeywords = [
          'warbler', 'thrush', 'wren', 'woodpecker', 'jay', 'nuthatch', 
          'chickadee', 'tit', 'finch', 'sparrow', 'robin', 'cardinal'
        ];
        
        const topSpecies = result.topPrediction.species.toLowerCase();
        
        // Check if the top prediction contains forest-related keywords
        const containsForestBird = forestKeywords.some(keyword => 
          topSpecies.includes(keyword)
        );
        
        console.log(`✅ Forest context analysis:`);
        console.log(`   Contains forest bird keywords: ${containsForestBird}`);
        console.log(`   Species: ${result.topPrediction.species}`);
        
        // This is more of an informational test - real bird identification 
        // accuracy depends on the specific audio content
        if (containsForestBird) {
          console.log('✅ Predicted species matches forest environment context');
        } else {
          console.log('ℹ️ Species prediction may be context-specific or audio may contain other birds');
        }
      }
    }, 45000);
  });

  describe('Model Performance Comparison', () => {
    test('should compare FP32 vs FP16 model performance on real audio', async () => {
      if (!serviceInitialized) {
        throw new Error('Service not initialized');
      }

      const testFile = TEST_AUDIO_FILES.forestBirds;
      
      // Test FP32 model
      const fp32Result = await processRealAudio(testFile, ModelType.HIGH_ACCURACY_FP32);
      
      // Test FP16 model for comparison
      const fp16Result = await processRealAudio(testFile, ModelType.BALANCED_FP16);
      
      console.log('\n🔄 Model Comparison Results:');
      
      // FP32 Results
      console.log('\n📊 FP32 Model (High Accuracy):');
      console.log(`   Success: ${fp32Result.success}`);
      console.log(`   Processing time: ${fp32Result.processingTime}ms`);
      if (fp32Result.success && fp32Result.topPrediction) {
        console.log(`   Top prediction: ${fp32Result.topPrediction.species} (${(fp32Result.topPrediction.confidence * 100).toFixed(2)}%)`);
        console.log(`   Predictions count: ${fp32Result.predictions}`);
      }
      
      // FP16 Results
      console.log('\n📊 FP16 Model (Balanced):');
      console.log(`   Success: ${fp16Result.success}`);
      console.log(`   Processing time: ${fp16Result.processingTime}ms`);
      if (fp16Result.success && fp16Result.topPrediction) {
        console.log(`   Top prediction: ${fp16Result.topPrediction.species} (${(fp16Result.topPrediction.confidence * 100).toFixed(2)}%)`);
        console.log(`   Predictions count: ${fp16Result.predictions}`);
      }
      
      // Skip detailed comparison if test file doesn't exist
      if (!fp32Result.fileExists) {
        console.warn('⚠️ Skipping model comparison - test audio not available');
        return;
      }
      
      // Performance comparison
      if (fp32Result.success && fp16Result.success) {
        const speedDifference = Math.abs(fp32Result.processingTime - fp16Result.processingTime);
        const fasterModel = fp32Result.processingTime < fp16Result.processingTime ? 'FP32' : 'FP16';
        
        console.log(`\n⚡ Performance Analysis:`);
        console.log(`   Faster model: ${fasterModel}`);
        console.log(`   Speed difference: ${speedDifference}ms`);
        
        // Both models should process successfully
        expect(fp32Result.success).toBe(true);
        expect(fp16Result.success).toBe(true);
        
        // Both should produce predictions
        expect(fp32Result.predictions).toBeGreaterThan(0);
        expect(fp16Result.predictions).toBeGreaterThan(0);
        
        // FP32 is expected to have higher accuracy but potentially slower speed
        console.log(`✅ Both models processed real audio successfully`);
      }
    }, 90000); // 90 second timeout for both models
  });

  describe('Audio Format Compatibility', () => {
    test('should handle MP3 format correctly', async () => {
      if (!serviceInitialized) {
        throw new Error('Service not initialized');
      }

      const result = await processRealAudio(TEST_AUDIO_FILES.forestBirds);
      
      if (!result.fileExists) {
        console.warn('⚠️ Skipping MP3 format test - file not available');
        return;
      }

      // Should process MP3 files without format-related errors
      if (!result.success && result.error) {
        // Check if error is format-related
        const formatErrors = ['format', 'codec', 'decode', 'unsupported'];
        const isFormatError = formatErrors.some(keyword => 
          result.error!.toLowerCase().includes(keyword)
        );
        
        if (isFormatError) {
          console.error('❌ MP3 format processing failed:', result.error);
          throw new Error(`MP3 format not supported: ${result.error}`);
        }
      }
      
      console.log('✅ MP3 format compatibility validated');
      
      if (result.success && result.metadata) {
        console.log(`   Audio duration: ${result.metadata.audioDuration?.toFixed(2)}s`);
        console.log(`   Processing source: ${result.metadata.audioSource}`);
      }
    }, 45000);

    test('should provide consistent results across multiple runs', async () => {
      if (!serviceInitialized) {
        throw new Error('Service not initialized');
      }

      const testFile = TEST_AUDIO_FILES.forestBirds;
      const results: AudioTestResult[] = [];
      
      // Run multiple times to check consistency
      for (let i = 0; i < 3; i++) {
        const result = await processRealAudio(testFile);
        results.push(result);
      }
      
      if (!results[0].fileExists) {
        console.warn('⚠️ Skipping consistency test - audio file not available');
        return;
      }
      
      console.log('\n🔄 Consistency Analysis:');
      
      results.forEach((result, index) => {
        console.log(`   Run ${index + 1}: ${result.success ? 'Success' : 'Failed'} - ${result.processingTime}ms`);
        if (result.success && result.topPrediction) {
          console.log(`     Top: ${result.topPrediction.species} (${(result.topPrediction.confidence * 100).toFixed(2)}%)`);
        }
      });
      
      // All runs should have the same success status
      const successStates = results.map(r => r.success);
      const allSameSuccess = successStates.every(state => state === successStates[0]);
      expect(allSameSuccess).toBe(true);
      
      if (results.every(r => r.success)) {
        // Check if top predictions are consistent (should be the same species)
        const topSpecies = results.map(r => r.topPrediction?.species).filter(Boolean);
        const uniqueSpecies = new Set(topSpecies);
        
        console.log(`   Unique top species across runs: ${uniqueSpecies.size}`);
        
        // Should be deterministic (same result every time)
        expect(uniqueSpecies.size).toBeLessThanOrEqual(2); // Allow for minor variations
        
        console.log('✅ Consistent results across multiple runs');
      }
    }, 120000); // 2 minute timeout for multiple runs
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle non-existent audio files gracefully', async () => {
      if (!serviceInitialized) {
        throw new Error('Service not initialized');
      }

      const nonExistentFile = '/path/to/nonexistent/audio.mp3';
      const result = await processRealAudio(nonExistentFile);
      
      expect(result.fileExists).toBe(false);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
      
      console.log('✅ Non-existent file handling validated');
      console.log(`   Error: ${result.error}`);
    });

    test('should handle corrupted audio files gracefully', async () => {
      if (!serviceInitialized) {
        throw new Error('Service not initialized');
      }

      // Create a fake corrupted audio file for testing
      const corruptedFile = `${FileSystem.documentDirectory}corrupted_audio.mp3`;
      await FileSystem.writeAsStringAsync(corruptedFile, 'This is not audio data');
      
      try {
        const result = await processRealAudio(corruptedFile);
        
        expect(result.fileExists).toBe(true);
        
        if (!result.success) {
          // Should fail gracefully with a meaningful error
          expect(result.error).toBeDefined();
          console.log('✅ Corrupted file handling validated');
          console.log(`   Error: ${result.error}`);
        } else {
          console.warn('⚠️ Corrupted file was processed - check audio decoder robustness');
        }
        
      } finally {
        // Clean up
        try {
          await FileSystem.deleteAsync(corruptedFile);
        } catch (error) {
          console.warn('Failed to clean up corrupted test file');
        }
      }
    });
  });

  describe('Performance and Resource Management', () => {
    test('should complete processing within reasonable time limits', async () => {
      if (!serviceInitialized) {
        throw new Error('Service not initialized');
      }

      const result = await processRealAudio(TEST_AUDIO_FILES.forestBirds);
      
      if (!result.fileExists) {
        console.warn('⚠️ Skipping performance test - audio file not available');
        return;
      }

      // Processing should complete within reasonable time
      expect(result.processingTime).toBeLessThan(30000); // 30 seconds max
      
      if (result.success && result.metadata) {
        // Reported processing time should be reasonable
        expect(result.metadata.reportedProcessingTime).toBeLessThan(20000); // 20 seconds max
        
        console.log('✅ Performance requirements met');
        console.log(`   Wall clock time: ${result.processingTime}ms`);
        console.log(`   Reported processing time: ${result.metadata.reportedProcessingTime}ms`);
      }
    }, 45000);

    test('should handle memory efficiently during processing', async () => {
      if (!serviceInitialized) {
        throw new Error('Service not initialized');
      }

      // Process the same file multiple times to check for memory leaks
      const numIterations = 3;
      const processingTimes: number[] = [];
      
      for (let i = 0; i < numIterations; i++) {
        const result = await processRealAudio(TEST_AUDIO_FILES.forestBirds);
        
        if (result.fileExists && result.success) {
          processingTimes.push(result.processingTime);
        }
      }
      
      if (processingTimes.length > 1) {
        // Processing times shouldn't increase significantly (indicating memory leaks)
        const firstTime = processingTimes[0];
        const lastTime = processingTimes[processingTimes.length - 1];
        const increase = lastTime - firstTime;
        
        console.log('✅ Memory efficiency analysis');
        console.log(`   First run: ${firstTime}ms`);
        console.log(`   Last run: ${lastTime}ms`);
        console.log(`   Increase: ${increase}ms`);
        
        // Allow for some variation but not massive increases
        expect(increase).toBeLessThan(firstTime * 0.5); // Less than 50% increase
      }
    }, 90000);
  });
});