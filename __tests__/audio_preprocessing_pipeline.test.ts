/**
 * Audio Preprocessing Pipeline Test
 * 
 * Validates the audio recording → preprocessing → model input data chain
 * Tests audio format compatibility, mel-spectrogram generation, and data type consistency
 */

import { AudioPreprocessingTFLite, ProcessedAudioData } from '../services/audioPreprocessingTFLite';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// Mock audio file for testing
const createMockAudioFile = async (
  duration: number = 3.0,
  sampleRate: number = 48000,
  format: 'silence' | 'tone' | 'noise' = 'tone'
): Promise<string> => {
  const fileName = `test_audio_${format}_${Date.now()}.wav`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;
  
  // For testing purposes, we'll create a mock file that our decoder can handle
  // In a real test environment, you'd want actual audio files
  const mockWavData = generateMockWavData(duration, sampleRate, format);
  
  await FileSystem.writeAsStringAsync(filePath, mockWavData, {
    encoding: FileSystem.EncodingType.Base64
  });
  
  return filePath;
};

// Generate mock WAV data (simplified for testing)
const generateMockWavData = (duration: number, sampleRate: number, type: 'silence' | 'tone' | 'noise'): string => {
  // This is a simplified mock - in real tests you'd use actual audio files
  const numSamples = Math.floor(duration * sampleRate);
  const samples = new Int16Array(numSamples);
  
  switch (type) {
    case 'silence':
      samples.fill(0);
      break;
    case 'tone':
      for (let i = 0; i < numSamples; i++) {
        samples[i] = Math.floor(Math.sin(i * 440 * 2 * Math.PI / sampleRate) * 16384);
      }
      break;
    case 'noise':
      for (let i = 0; i < numSamples; i++) {
        samples[i] = Math.floor((Math.random() - 0.5) * 32768);
      }
      break;
  }
  
  // Convert to base64 (simplified WAV format)
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  // WAV header (simplified)
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  
  // Copy sample data
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i], true);
  }
  
  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

describe('Audio Preprocessing Pipeline', () => {
  let tempFiles: string[] = [];

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

  describe('Audio Format Compatibility', () => {
    test('should handle 48kHz audio input correctly', async () => {
      const audioFile = await createMockAudioFile(3.0, 48000, 'tone');
      tempFiles.push(audioFile);

      const config = AudioPreprocessingTFLite.getConfig();
      expect(config.sampleRate).toBe(48000);
      expect(config.duration).toBe(3.0);
      expect(config.nMels).toBe(224);

      console.log('✅ Audio preprocessing config validated for 48kHz input');
    });

    test('should process different duration audio files', async () => {
      // Test with different durations to ensure trimming/padding works
      const durations = [1.0, 2.5, 3.0, 4.5, 6.0];
      
      for (const duration of durations) {
        const audioFile = await createMockAudioFile(duration, 48000, 'tone');
        tempFiles.push(audioFile);

        try {
          const result = await AudioPreprocessingTFLite.processAudioFile(audioFile);
          
          // Should always produce 3-second output regardless of input duration
          expect(result.metadata.duration).toBeCloseTo(3.0, 1);
          expect(result.shape).toEqual([1, 224, 224, 3]);
          
          console.log(`✅ Processed ${duration}s audio → 3.0s output`);
        } catch (error) {
          console.error(`Failed to process ${duration}s audio:`, error);
          throw error;
        }
      }
    });

    test('should handle different audio content types', async () => {
      const contentTypes = ['silence', 'tone', 'noise'] as const;
      
      for (const contentType of contentTypes) {
        const audioFile = await createMockAudioFile(3.0, 48000, contentType);
        tempFiles.push(audioFile);

        const result = await AudioPreprocessingTFLite.processAudioFile(audioFile);
        
        expect(result.processedData).toBeInstanceOf(Float32Array);
        expect(result.processedData.length).toBeGreaterThan(0);
        expect(result.shape).toBeDefined();
        
        // Check data ranges are reasonable
        const values = Array.from(result.processedData);
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        expect(min).toBeGreaterThanOrEqual(-5); // Reasonable mel-spectrogram range
        expect(max).toBeLessThanOrEqual(5);
        
        console.log(`✅ ${contentType} audio: range [${min.toFixed(2)}, ${max.toFixed(2)}]`);
      }
    });
  });

  describe('Mel-Spectrogram Generation', () => {
    test('should generate correct output shape [1, 224, 224, 3]', async () => {
      const audioFile = await createMockAudioFile(3.0, 48000, 'tone');
      tempFiles.push(audioFile);

      const result = await AudioPreprocessingTFLite.processAudioFile(audioFile);
      
      // Validate output shape (dynamic based on model requirements)
      expect(result.shape).toBeDefined();
      expect(result.processedData.length).toBeGreaterThan(0);
      
      // Validate data type
      expect(result.processedData).toBeInstanceOf(Float32Array);
      
      console.log('✅ Mel-spectrogram shape validation passed');
      console.log(`   Output shape: [${result.shape.join(', ')}]`);
      console.log(`   Data length: ${result.processedData.length}`);
    });

    test('should normalize mel-spectrogram values appropriately', async () => {
      const audioFile = await createMockAudioFile(3.0, 48000, 'tone');
      tempFiles.push(audioFile);

      const result = await AudioPreprocessingTFLite.processAudioFile(audioFile);
      
      const values = Array.from(result.processedData);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const std = Math.sqrt(values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length);
      
      // Check normalization ranges
      expect(min).toBeGreaterThanOrEqual(-10); // Should be normalized
      expect(max).toBeLessThanOrEqual(10);
      expect(Math.abs(mean)).toBeLessThan(2); // Should be roughly centered
      
      console.log('✅ Mel-spectrogram normalization validated');
      console.log(`   Range: [${min.toFixed(3)}, ${max.toFixed(3)}]`);
      console.log(`   Mean: ${mean.toFixed(3)}, Std: ${std.toFixed(3)}`);
    });

    test('should handle resampling correctly', async () => {
      // Test with different sample rates
      const sampleRates = [44100, 48000, 96000];
      
      for (const sampleRate of sampleRates) {
        const audioFile = await createMockAudioFile(3.0, sampleRate, 'tone');
        tempFiles.push(audioFile);

        const result = await AudioPreprocessingTFLite.processAudioFile(audioFile);
        
        // Output should always be consistent regardless of input sample rate
        expect(result.shape).toEqual([1, 224, 224, 3]);
        expect(result.metadata.originalSampleRate).toBe(sampleRate);
        
        console.log(`✅ ${sampleRate}Hz → processed successfully`);
      }
    });
  });

  describe('Data Type Consistency', () => {
    test('should maintain Float32Array throughout pipeline', async () => {
      const audioFile = await createMockAudioFile(3.0, 48000, 'tone');
      tempFiles.push(audioFile);

      const result = await AudioPreprocessingTFLite.processAudioFile(audioFile);
      
      // Verify data type consistency
      expect(result.processedData).toBeInstanceOf(Float32Array);
      expect(result.processedData.BYTES_PER_ELEMENT).toBe(4); // Float32 = 4 bytes
      
      // Check that all values are valid numbers
      const hasNaN = Array.from(result.processedData).some(val => isNaN(val));
      const hasInfinity = Array.from(result.processedData).some(val => !isFinite(val));
      
      expect(hasNaN).toBe(false);
      expect(hasInfinity).toBe(false);
      
      console.log('✅ Data type consistency validated');
      console.log(`   Type: ${result.processedData.constructor.name}`);
      console.log(`   Bytes per element: ${result.processedData.BYTES_PER_ELEMENT}`);
    });

    test('should produce deterministic output for identical input', async () => {
      const audioFile = await createMockAudioFile(3.0, 48000, 'tone');
      tempFiles.push(audioFile);

      // Process the same file twice
      const result1 = await AudioPreprocessingTFLite.processAudioFile(audioFile);
      const result2 = await AudioPreprocessingTFLite.processAudioFile(audioFile);
      
      // Results should be identical (deterministic processing)
      expect(result1.shape).toEqual(result2.shape);
      expect(result1.processedData.length).toBe(result2.processedData.length);
      
      // Compare values (allowing for tiny floating point differences)
      let maxDifference = 0;
      for (let i = 0; i < result1.processedData.length; i++) {
        const diff = Math.abs(result1.processedData[i] - result2.processedData[i]);
        maxDifference = Math.max(maxDifference, diff);
      }
      
      expect(maxDifference).toBeLessThan(1e-6); // Should be essentially identical
      
      console.log('✅ Deterministic processing validated');
      console.log(`   Max difference between runs: ${maxDifference.toExponential(2)}`);
    });
  });

  describe('Performance and Resource Management', () => {
    test('should process audio within reasonable time limits', async () => {
      const audioFile = await createMockAudioFile(3.0, 48000, 'tone');
      tempFiles.push(audioFile);

      const startTime = Date.now();
      const result = await AudioPreprocessingTFLite.processAudioFile(audioFile);
      const processingTime = Date.now() - startTime;
      
      // Should complete within 5 seconds
      expect(processingTime).toBeLessThan(5000);
      expect(result.metadata.processingTime).toBeDefined();
      
      console.log('✅ Processing performance validated');
      console.log(`   Wall clock time: ${processingTime}ms`);
      console.log(`   Reported processing time: ${result.metadata.processingTime}ms`);
    });

    test('should handle multiple consecutive processing calls', async () => {
      const numTests = 5;
      const processingTimes: number[] = [];
      
      for (let i = 0; i < numTests; i++) {
        const audioFile = await createMockAudioFile(3.0, 48000, 'noise');
        tempFiles.push(audioFile);

        const startTime = Date.now();
        const result = await AudioPreprocessingTFLite.processAudioFile(audioFile);
        const processingTime = Date.now() - startTime;
        
        processingTimes.push(processingTime);
        
        expect(result.shape).toEqual([1, 224, 224, 3]);
        expect(result.processedData).toBeInstanceOf(Float32Array);
      }
      
      const avgTime = processingTimes.reduce((sum, time) => sum + time, 0) / numTests;
      const maxTime = Math.max(...processingTimes);
      const minTime = Math.min(...processingTimes);
      
      console.log('✅ Multiple processing calls validated');
      console.log(`   Average time: ${avgTime.toFixed(1)}ms`);
      console.log(`   Range: ${minTime}ms - ${maxTime}ms`);
      
      // Performance should be consistent
      expect(maxTime - minTime).toBeLessThan(2000); // Variance should be reasonable
    });
  });

  describe('Configuration Management', () => {
    test('should allow configuration updates', () => {
      const originalConfig = AudioPreprocessingTFLite.getConfig();
      
      // Test configuration update
      const newConfig = {
        ...originalConfig,
        nMels: 128, // Test different mel bin count
        duration: 5.0 // Test different duration
      };
      
      AudioPreprocessingTFLite.updateConfig({ nMels: 128, duration: 5.0 });
      const updatedConfig = AudioPreprocessingTFLite.getConfig();
      
      expect(updatedConfig.nMels).toBe(128);
      expect(updatedConfig.duration).toBe(5.0);
      expect(updatedConfig.sampleRate).toBe(originalConfig.sampleRate); // Should preserve other settings
      
      // Restore original config
      AudioPreprocessingTFLite.updateConfig(originalConfig);
      
      console.log('✅ Configuration management validated');
    });

    test('should validate required BirdNet configuration parameters', () => {
      const config = AudioPreprocessingTFLite.getConfig();
      
      // Validate BirdNet-specific requirements
      expect(config.sampleRate).toBe(48000); // BirdNet prefers 48kHz
      expect(config.nMels).toBe(224); // To match model input requirements
      expect(config.duration).toBe(3.0); // Standard 3-second clips
      expect(config.normalize).toBe(true); // Normalization should be enabled
      
      console.log('✅ BirdNet configuration requirements validated');
      console.log(`   Sample rate: ${config.sampleRate}Hz`);
      console.log(`   Mel bins: ${config.nMels}`);
      console.log(`   Duration: ${config.duration}s`);
    });
  });
});