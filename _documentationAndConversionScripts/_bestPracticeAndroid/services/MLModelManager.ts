/**
 * MLModelManager.ts - TensorFlow Lite model management for Android
 * 
 * Implements React Native Fast TFLite with GPU acceleration
 * Optimized for real-time bird detection with memory management
 */

import { TensorflowModel } from 'react-native-fast-tflite';

export interface Detection {
  id: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  species: {
    common_name: string;
    scientific_name: string;
  };
  timestamp: number;
}

export class MLModelManager {
  private static model: TensorflowModel | null = null;
  private static isInitialized = false;
  private static modelPath = 'birdnet_v24.tflite';
  private static labelsPath = 'labels.json';
  private static labels: any[] = [];

  // Load TensorFlow Lite model with GPU acceleration
  static async loadModel(): Promise<boolean> {
    if (MLModelManager.isInitialized && MLModelManager.model) {
      return true;
    }

    try {
      console.log('Loading ML model for Android...');
      
      // Load labels first
      const labelsResponse = await fetch(`file:///android_asset/${MLModelManager.labelsPath}`);
      const labelsData = await labelsResponse.json();
      MLModelManager.labels = labelsData.labels || [];

      // Initialize TensorFlow Lite model with GPU acceleration
      MLModelManager.model = await TensorflowModel.create({
        model: MLModelManager.modelPath,
        // Android GPU acceleration options
        gpuAcceleration: true,
        cpuNumThreads: 4, // Optimize for Android devices
        // Memory management
        allowBufferReallocation: true,
        enableBenchmark: __DEV__, // Only in development
      });

      MLModelManager.isInitialized = true;
      console.log('ML model loaded successfully');
      return true;

    } catch (error) {
      console.error('Failed to load ML model:', error);
      MLModelManager.isInitialized = false;
      return false;
    }
  }

  // Process camera frame for bird detection
  static processFrame(frame: any): Detection[] | null {
    if (!MLModelManager.model || !MLModelManager.isInitialized) {
      return null;
    }

    try {
      // Convert frame to tensor format
      const inputTensor = MLModelManager.preprocessFrame(frame);
      
      // Run inference
      const outputs = MLModelManager.model.run([inputTensor]);
      
      // Post-process results
      return MLModelManager.postProcessResults(outputs);

    } catch (error) {
      console.error('Frame processing error:', error);
      return null;
    }
  }

  // Preprocess camera frame for model input
  private static preprocessFrame(frame: any): number[] {
    // Convert frame to RGB tensor (224x224x3 for most bird detection models)
    // This is a simplified version - actual implementation would use native processing
    
    const width = 224;
    const height = 224;
    const channels = 3;
    
    // Placeholder preprocessing - in production, this would be done natively
    const tensor = new Array(width * height * channels).fill(0);
    
    // Normalize pixel values to [0, 1] range
    for (let i = 0; i < tensor.length; i++) {
      tensor[i] = Math.random(); // Placeholder - actual frame data would be processed here
    }
    
    return tensor;
  }

  // Post-process model outputs to detection objects
  private static postProcessResults(outputs: number[][]): Detection[] {
    const detections: Detection[] = [];
    
    if (!outputs || outputs.length === 0) {
      return detections;
    }

    // Assuming outputs[0] contains class probabilities
    const probabilities = outputs[0];
    
    // Find top detections
    const sortedIndices = probabilities
      .map((prob, index) => ({ prob, index }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 5); // Top 5 detections

    sortedIndices.forEach(({ prob, index }, detectionIndex) => {
      if (prob > 0.1 && index < MLModelManager.labels.length) { // Minimum confidence threshold
        const label = MLModelManager.labels[index];
        
        detections.push({
          id: `detection_${Date.now()}_${detectionIndex}`,
          confidence: prob,
          boundingBox: {
            x: Math.random() * 0.5, // Placeholder - actual bounding box from model
            y: Math.random() * 0.5,
            width: 0.2 + Math.random() * 0.3,
            height: 0.2 + Math.random() * 0.3,
          },
          species: {
            common_name: label.common_name || 'Unknown Bird',
            scientific_name: label.scientific_name || 'Aves sp.',
          },
          timestamp: Date.now(),
        });
      }
    });

    return detections;
  }

  // Unload model to free memory
  static async unloadModel(): Promise<void> {
    try {
      if (MLModelManager.model) {
        await MLModelManager.model.destroy();
        MLModelManager.model = null;
      }
      MLModelManager.isInitialized = false;
      MLModelManager.labels = [];
      console.log('ML model unloaded');
    } catch (error) {
      console.error('Error unloading model:', error);
    }
  }

  // Get model info
  static getModelInfo() {
    return {
      isLoaded: MLModelManager.isInitialized,
      modelPath: MLModelManager.modelPath,
      labelsCount: MLModelManager.labels.length,
      hasGPUAcceleration: true, // Android GPU support
    };
  }

  // Hot reload model (useful for development)
  static async reloadModel(): Promise<boolean> {
    await MLModelManager.unloadModel();
    return MLModelManager.loadModel();
  }
}

// Export for use in frame processors
export default MLModelManager;