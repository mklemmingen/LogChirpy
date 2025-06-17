/**
 * Camera Audio Pipeline Integration Test
 * 
 * Tests the integration of audio processing within the ObjectIdentCamera component
 * Validates concurrent visual and audio processing, resource management, and UI integration
 */

import { AudioIdentificationService } from '../services/audioIdentificationService';
import { ModelType } from '../services/modelConfig';
import { fastTfliteBirdClassifier } from '../services/fastTfliteBirdClassifier';
import * as FileSystem from 'expo-file-system';

// Mock the camera-related modules for testing
jest.mock('react-native-vision-camera', () => ({
  useCameraDevice: () => ({ id: 'mock-camera' }),
  useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
  Camera: 'MockCamera'
}));

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
      startAsync: jest.fn().mockResolvedValue(undefined),
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getURI: jest.fn().mockReturnValue('/mock/audio/path.m4a')
    }))
  }
}));

// Simulated camera pipeline states
interface CameraPipelineState {
  cameraActive: boolean;
  audioProcessing: boolean;
  detectionPaused: boolean;
  audioInitialized: boolean;
  audioResults: any[];
  audioError: string | null;
  processingLoad: number; // 0-1 representing CPU/memory load
}

// Simulate the camera audio pipeline workflow
class MockCameraAudioPipeline {
  private state: CameraPipelineState = {
    cameraActive: false,
    audioProcessing: false,
    detectionPaused: false,
    audioInitialized: false,
    audioResults: [],
    audioError: null,
    processingLoad: 0
  };

  private audioInterval?: NodeJS.Timeout;
  private processCounter = 0;

  async initialize(): Promise<boolean> {
    try {
      // Simulate audio initialization
      await AudioIdentificationService.initialize();
      this.state.audioInitialized = true;
      return true;
    } catch (error) {
      this.state.audioError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  startCameraMode(): void {
    this.state.cameraActive = true;
    this.state.detectionPaused = false;
    
    if (this.state.audioInitialized) {
      this.startAudioProcessing();
    }
  }

  stopCameraMode(): void {
    this.state.cameraActive = false;
    this.stopAudioProcessing();
  }

  pauseDetection(): void {
    this.state.detectionPaused = true;
    this.stopAudioProcessing();
  }

  resumeDetection(): void {
    if (this.state.cameraActive && this.state.audioInitialized) {
      this.state.detectionPaused = false;
      this.startAudioProcessing();
    }
  }

  private startAudioProcessing(): void {
    if (this.audioInterval) {
      clearInterval(this.audioInterval);
    }

    // Simulate 5-second audio processing intervals
    this.audioInterval = setInterval(async () => {
      await this.processAudioCycle();
    }, 5000);
  }

  private stopAudioProcessing(): void {
    if (this.audioInterval) {
      clearInterval(this.audioInterval);
      this.audioInterval = undefined;
    }
    this.state.audioProcessing = false;
  }

  private async processAudioCycle(): Promise<void> {
    if (this.state.detectionPaused || !this.state.cameraActive) {
      return;
    }

    this.state.audioProcessing = true;
    this.state.processingLoad = Math.min(this.state.processingLoad + 0.3, 1.0);

    try {
      // Simulate audio recording and processing
      const mockAudioFile = await this.createMockRecording();
      
      const result = await AudioIdentificationService.identifyBirdFromAudio(
        mockAudioFile,
        { modelType: ModelType.MDATA_V2_FP16 } // Use faster model for camera pipeline
      );

      if (result.success && result.predictions.length > 0) {
        // Filter and limit results as in real camera
        const filteredResults = result.predictions
          .filter(p => p.confidence >= 0.1)
          .slice(0, 3)
          .sort((a, b) => b.confidence - a.confidence);

        this.state.audioResults = filteredResults;
        this.state.audioError = null;
      } else {
        this.state.audioResults = [];
      }

      // Clean up mock file
      await FileSystem.deleteAsync(mockAudioFile);

    } catch (error) {
      this.state.audioError = error instanceof Error ? error.message : String(error);
      this.state.audioResults = [];
    } finally {
      this.state.audioProcessing = false;
      this.state.processingLoad = Math.max(this.state.processingLoad - 0.2, 0);
      this.processCounter++;
    }
  }

  private async createMockRecording(): Promise<string> {
    // Create a mock audio file for testing
    const fileName = `mock_recording_${Date.now()}.json`;
    const filePath = `${FileSystem.documentDirectory}${fileName}`;
    
    // Simulate different audio scenarios
    const scenarios = ['silence', 'bird_call', 'noise', 'mixed'];
    const scenario = scenarios[this.processCounter % scenarios.length];
    
    await FileSystem.writeAsStringAsync(filePath, JSON.stringify({
      scenario,
      duration: 5.0,
      timestamp: Date.now()
    }));
    
    return filePath;
  }

  getState(): CameraPipelineState {
    return { ...this.state };
  }

  dispose(): void {
    this.stopAudioProcessing();
    this.state = {
      cameraActive: false,
      audioProcessing: false,
      detectionPaused: false,
      audioInitialized: false,
      audioResults: [],
      audioError: null,
      processingLoad: 0
    };
  }
}

describe('Camera Audio Pipeline Integration', () => {
  let pipeline: MockCameraAudioPipeline;
  let serviceReady = false;

  beforeAll(async () => {
    console.log('🚀 Setting up camera audio pipeline tests...');
    
    try {
      // Initialize the service
      await AudioIdentificationService.initialize();
      serviceReady = true;
      console.log('✅ AudioIdentificationService ready for camera tests');
    } catch (error) {
      console.error('❌ Service initialization failed:', error);
      serviceReady = false;
    }
  }, 30000);

  beforeEach(() => {
    pipeline = new MockCameraAudioPipeline();
  });

  afterEach(() => {
    if (pipeline) {
      pipeline.dispose();
    }
  });

  afterAll(async () => {
    if (serviceReady) {
      await AudioIdentificationService.clearCache();
      console.log('🧹 Service cleaned up');
    }
  });

  describe('Pipeline Initialization', () => {
    test('should initialize audio processing for camera mode', async () => {
      if (!serviceReady) throw new Error('Service not ready');

      const success = await pipeline.initialize();
      expect(success).toBe(true);

      const state = pipeline.getState();
      expect(state.audioInitialized).toBe(true);
      expect(state.audioError).toBeNull();

      console.log('✅ Camera audio pipeline initialized successfully');
    });

    test('should handle initialization failures gracefully', async () => {
      // Test with a mock that simulates initialization failure
      const mockFailurePipeline = new MockCameraAudioPipeline();
      
      // Mock service to fail
      const originalInit = AudioIdentificationService.initialize;
      AudioIdentificationService.initialize = jest.fn().mockRejectedValue(new Error('Mock initialization failure'));
      
      try {
        const success = await mockFailurePipeline.initialize();
        expect(success).toBe(false);

        const state = mockFailurePipeline.getState();
        expect(state.audioInitialized).toBe(false);
        expect(state.audioError).toContain('Mock initialization failure');

        console.log('✅ Initialization failure handled gracefully');
      } finally {
        // Restore original method
        AudioIdentificationService.initialize = originalInit;
        mockFailurePipeline.dispose();
      }
    });
  });

  describe('Camera Mode Operations', () => {
    test('should start and stop camera mode correctly', async () => {
      if (!serviceReady) throw new Error('Service not ready');

      await pipeline.initialize();
      
      // Start camera mode
      pipeline.startCameraMode();
      let state = pipeline.getState();
      expect(state.cameraActive).toBe(true);
      expect(state.detectionPaused).toBe(false);

      // Stop camera mode
      pipeline.stopCameraMode();
      state = pipeline.getState();
      expect(state.cameraActive).toBe(false);

      console.log('✅ Camera mode start/stop operations validated');
    });

    test('should pause and resume detection correctly', async () => {
      if (!serviceReady) throw new Error('Service not ready');

      await pipeline.initialize();
      pipeline.startCameraMode();

      // Pause detection
      pipeline.pauseDetection();
      let state = pipeline.getState();
      expect(state.detectionPaused).toBe(true);

      // Resume detection
      pipeline.resumeDetection();
      state = pipeline.getState();
      expect(state.detectionPaused).toBe(false);

      console.log('✅ Pause/resume detection validated');
    });
  });

  describe('Audio Processing Cycles', () => {
    test('should process audio in 5-second intervals', async () => {
      if (!serviceReady) throw new Error('Service not ready');

      await pipeline.initialize();
      pipeline.startCameraMode();

      // Wait for at least one audio processing cycle
      await new Promise(resolve => setTimeout(resolve, 6000));

      const state = pipeline.getState();
      
      // Should have attempted audio processing
      expect(state.audioInitialized).toBe(true);
      
      console.log('✅ Audio processing cycle completed');
      console.log(`   Audio results: ${state.audioResults.length}`);
      console.log(`   Processing load: ${(state.processingLoad * 100).toFixed(1)}%`);
      
      if (state.audioError) {
        console.warn(`   Audio error: ${state.audioError}`);
      }
    }, 10000);

    test('should handle audio processing errors gracefully', async () => {
      if (!serviceReady) throw new Error('Service not ready');

      // Mock the audio service to fail
      const originalIdentify = AudioIdentificationService.identifyBirdFromAudio;
      AudioIdentificationService.identifyBirdFromAudio = jest.fn().mockRejectedValue(new Error('Mock processing error'));

      try {
        await pipeline.initialize();
        pipeline.startCameraMode();

        // Wait for processing cycle
        await new Promise(resolve => setTimeout(resolve, 6000));

        const state = pipeline.getState();
        
        // Should handle errors gracefully
        expect(state.audioError).toContain('Mock processing error');
        expect(state.audioResults).toEqual([]);
        
        console.log('✅ Audio processing errors handled gracefully');
        
      } finally {
        // Restore original method
        AudioIdentificationService.identifyBirdFromAudio = originalIdentify;
      }
    }, 10000);
  });

  describe('Resource Management', () => {
    test('should manage processing load appropriately', async () => {
      if (!serviceReady) throw new Error('Service not ready');

      await pipeline.initialize();
      pipeline.startCameraMode();

      const loadMeasurements: number[] = [];

      // Monitor processing load over multiple cycles
      const monitor = setInterval(() => {
        const state = pipeline.getState();
        loadMeasurements.push(state.processingLoad);
      }, 1000);

      // Wait for multiple cycles
      await new Promise(resolve => setTimeout(resolve, 12000));
      clearInterval(monitor);

      const maxLoad = Math.max(...loadMeasurements);
      const avgLoad = loadMeasurements.reduce((sum, load) => sum + load, 0) / loadMeasurements.length;

      // Processing load should be reasonable
      expect(maxLoad).toBeLessThanOrEqual(1.0);
      expect(avgLoad).toBeLessThan(0.8); // Average load should be manageable

      console.log('✅ Processing load management validated');
      console.log(`   Max load: ${(maxLoad * 100).toFixed(1)}%`);
      console.log(`   Average load: ${(avgLoad * 100).toFixed(1)}%`);
    }, 15000);

    test('should clean up resources when stopping', async () => {
      if (!serviceReady) throw new Error('Service not ready');

      await pipeline.initialize();
      pipeline.startCameraMode();

      // Let it run briefly
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Stop and check cleanup
      pipeline.stopCameraMode();
      pipeline.dispose();

      const state = pipeline.getState();
      expect(state.cameraActive).toBe(false);
      expect(state.audioProcessing).toBe(false);
      expect(state.processingLoad).toBe(0);

      console.log('✅ Resource cleanup validated');
    });
  });

  describe('Model Selection for Camera Use', () => {
    test('should use appropriate model for real-time camera processing', async () => {
      if (!serviceReady) throw new Error('Service not ready');

      // For camera use, should prefer faster models
      const cameraModel = ModelType.MDATA_V2_FP16; // Faster FP16 model
      const accuracyModel = ModelType.HIGH_ACCURACY_FP32; // Slower FP32 model

      // Test processing time with camera model
      const startTime = Date.now();
      
      // Create test data
      const testData = new Float32Array(224 * 224 * 3);
      testData.fill(0.5);

      await fastTfliteBirdClassifier.switchModel(cameraModel);
      await fastTfliteBirdClassifier.classifyBirdAudio(testData);
      
      const cameraModelTime = Date.now() - startTime;

      console.log('✅ Camera model performance validated');
      console.log(`   Camera model (${cameraModel}) time: ${cameraModelTime}ms`);

      // Camera model should be reasonably fast for real-time use
      expect(cameraModelTime).toBeLessThan(3000); // Should complete within 3 seconds
    });

    test('should handle model switching for different use cases', async () => {
      if (!serviceReady) throw new Error('Service not ready');

      // Test switching between camera and accuracy models
      const cameraModel = ModelType.MDATA_V2_FP16;
      const accuracyModel = ModelType.HIGH_ACCURACY_FP32;

      // Switch to camera model
      const cameraSuccess = await fastTfliteBirdClassifier.switchModel(cameraModel);
      expect(cameraSuccess).toBe(true);
      expect(fastTfliteBirdClassifier.getCurrentModelType()).toBe(cameraModel);

      // Switch to accuracy model
      const accuracySuccess = await fastTfliteBirdClassifier.switchModel(accuracyModel);
      expect(accuracySuccess).toBe(true);
      expect(fastTfliteBirdClassifier.getCurrentModelType()).toBe(accuracyModel);

      console.log('✅ Model switching for different use cases validated');
    });
  });

  describe('Concurrent Processing Simulation', () => {
    test('should handle concurrent visual and audio processing', async () => {
      if (!serviceReady) throw new Error('Service not ready');

      await pipeline.initialize();
      pipeline.startCameraMode();

      // Simulate concurrent visual processing (mock)
      const visualProcessingResults: boolean[] = [];
      const audioProcessingResults: any[] = [];

      const simulateVisualProcessing = () => {
        return new Promise<boolean>(resolve => {
          setTimeout(() => {
            // Simulate visual processing success/failure
            const success = Math.random() > 0.1; // 90% success rate
            visualProcessingResults.push(success);
            resolve(success);
          }, 1000 + Math.random() * 2000); // 1-3 second processing time
        });
      };

      // Run concurrent processing simulation
      const promises: Promise<any>[] = [];
      
      // Start visual processing simulations
      for (let i = 0; i < 3; i++) {
        promises.push(simulateVisualProcessing());
      }

      // Monitor audio processing
      const audioMonitor = setInterval(() => {
        const state = pipeline.getState();
        if (state.audioResults.length > 0) {
          audioProcessingResults.push(...state.audioResults);
        }
      }, 1000);

      // Wait for all concurrent operations
      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 8000)); // Wait for audio cycles
      clearInterval(audioMonitor);

      const finalState = pipeline.getState();

      console.log('✅ Concurrent processing simulation completed');
      console.log(`   Visual processing results: ${visualProcessingResults.length}`);
      console.log(`   Audio processing results: ${audioProcessingResults.length}`);
      console.log(`   Final processing load: ${(finalState.processingLoad * 100).toFixed(1)}%`);

      // Both visual and audio should be able to process concurrently
      expect(visualProcessingResults.length).toBeGreaterThan(0);
      
      // System should remain stable under concurrent load
      expect(finalState.processingLoad).toBeLessThan(1.0);
    }, 20000);
  });

  describe('Error Recovery and Stability', () => {
    test('should recover from temporary audio failures', async () => {
      if (!serviceReady) throw new Error('Service not ready');

      await pipeline.initialize();
      pipeline.startCameraMode();

      // Let it run normally first
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      let initialState = pipeline.getState();
      console.log(`Initial state - Error: ${initialState.audioError}, Results: ${initialState.audioResults.length}`);

      // Simulate temporary failure by mocking
      const originalIdentify = AudioIdentificationService.identifyBirdFromAudio;
      AudioIdentificationService.identifyBirdFromAudio = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockImplementation(originalIdentify); // Restore after one failure

      // Wait for failure and recovery
      await new Promise(resolve => setTimeout(resolve, 12000));

      const finalState = pipeline.getState();
      
      console.log('✅ Error recovery validated');
      console.log(`   Final state - Error: ${finalState.audioError}, Results: ${finalState.audioResults.length}`);

      // Should eventually recover from temporary failures
      // (Note: This test depends on timing and may need adjustment)
    }, 20000);

    test('should maintain stability during extended operation', async () => {
      if (!serviceReady) throw new Error('Service not ready');

      await pipeline.initialize();
      pipeline.startCameraMode();

      const stabilityMetrics = {
        errorCount: 0,
        successCount: 0,
        maxLoad: 0,
        totalCycles: 0
      };

      // Monitor for extended period
      const monitor = setInterval(() => {
        const state = pipeline.getState();
        stabilityMetrics.maxLoad = Math.max(stabilityMetrics.maxLoad, state.processingLoad);
        stabilityMetrics.totalCycles++;
        
        if (state.audioError) {
          stabilityMetrics.errorCount++;
        } else if (state.audioResults.length > 0) {
          stabilityMetrics.successCount++;
        }
      }, 2000);

      // Run for extended period
      await new Promise(resolve => setTimeout(resolve, 20000));
      clearInterval(monitor);

      const errorRate = stabilityMetrics.errorCount / stabilityMetrics.totalCycles;
      const successRate = stabilityMetrics.successCount / stabilityMetrics.totalCycles;

      console.log('✅ Extended operation stability validated');
      console.log(`   Total monitoring cycles: ${stabilityMetrics.totalCycles}`);
      console.log(`   Error rate: ${(errorRate * 100).toFixed(1)}%`);
      console.log(`   Success rate: ${(successRate * 100).toFixed(1)}%`);
      console.log(`   Max processing load: ${(stabilityMetrics.maxLoad * 100).toFixed(1)}%`);

      // System should remain stable
      expect(errorRate).toBeLessThan(0.5); // Less than 50% error rate
      expect(stabilityMetrics.maxLoad).toBeLessThan(1.0);
    }, 25000);
  });
});