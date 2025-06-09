/**
 * FastTfliteBirdClassifier Service
 * 
 * High-performance bird audio classification using react-native-fast-tflite.
 * Provides offline-first bird identification with intelligent fallback strategies.
 */

import { loadTensorflowModel, TensorflowModel, TensorflowModelDelegate } from 'react-native-fast-tflite';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface BirdClassificationResult {
  species: string;
  scientificName: string;
  confidence: number;
  index: number;
}

export interface ClassificationMetadata {
  modelVersion: string;
  processingTime: number;
  modelSource: 'tflite' | 'fallback' | 'cache';
  inputShape: number[];
  timestamp: number;
}

export interface ModelPerformanceMetrics {
  avgInferenceTime: number;
  totalInferences: number;
  memoryUsage: number;
  modelSize: number;
  cacheHitRate: number;
}

interface CachedResult {
  result: BirdClassificationResult[];
  metadata: ClassificationMetadata;
  expiry: number;
  audioHash: string;
}

interface FastTfliteConfig {
  modelPath: any;
  labelsPath: string;
  confidenceThreshold: number;
  maxResults: number;
  enableCaching: boolean;
  cacheExpiryMs: number;
  maxCacheSize: number;
  preferredDelegate: TensorflowModelDelegate;
  fallbackDelegate: TensorflowModelDelegate;
}

class FastTfliteBirdClassifierService {
  private model: TensorflowModel | null = null;
  private labels: any[] = [];
  private modelLoaded = false;
  private config: FastTfliteConfig;
  private cache = new Map<string, CachedResult>();
  private performanceMetrics: ModelPerformanceMetrics = {
    avgInferenceTime: 0,
    totalInferences: 0,
    memoryUsage: 0,
    modelSize: 0,
    cacheHitRate: 0
  };

  constructor() {
    this.config = {
      modelPath: require('../assets/models/birdnet/birdnet_v24.tflite'),
      labelsPath: '../assets/models/birdnet/labels.json',
      confidenceThreshold: 0.1,
      maxResults: 5,
      enableCaching: true,
      cacheExpiryMs: 24 * 60 * 60 * 1000, // 24 hours
      maxCacheSize: 100,
      preferredDelegate: Platform.OS === 'android' ? 'android-gpu' : 'core-ml',
      fallbackDelegate: 'default'
    };
  }

  /**
   * Initialize the TensorFlow Lite model with GPU delegate fallback
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing FastTflite bird classifier...');
      
      // Load labels first
      await this.loadLabels();
      
      // Try loading model with preferred delegate first
      this.model = await this.loadModelWithFallback();
      
      if (!this.model) {
        throw new Error('Failed to load model with any delegate');
      }
      
      // Get model size for metrics
      // Note: When using require() for bundled assets, we can't get the actual file size
      // The model is loaded correctly, but size will be reported as 0 for bundled assets
      const modelUri = this.config.modelPath;
      if (typeof modelUri === 'string' && modelUri.startsWith('file://')) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(modelUri);
          if (fileInfo.exists && 'size' in fileInfo) {
            this.performanceMetrics.modelSize = fileInfo.size;
          }
        } catch (error) {
          console.warn('Could not get model file size:', error);
        }
      } else {
        // For bundled assets (require()), estimate size based on known model
        // BirdNet v2.4 model is approximately 26MB
        this.performanceMetrics.modelSize = 26 * 1024 * 1024; // 26MB in bytes
        console.log('Using estimated model size for bundled asset');
      }

      this.modelLoaded = true;
      console.log('FastTflite model loaded successfully', {
        labelCount: this.labels.length,
        modelSize: this.performanceMetrics.modelSize,
        delegate: this.config.preferredDelegate
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize FastTflite model:', error);
      this.modelLoaded = false;
      return false;
    }
  }

  /**
   * Load model with delegate fallback strategy
   */
  private async loadModelWithFallback(): Promise<TensorflowModel | null> {
    try {
      // Try preferred delegate first (GPU acceleration)
      console.log(`Attempting to load model with ${this.config.preferredDelegate} delegate...`);
      const model = await loadTensorflowModel(this.config.modelPath, this.config.preferredDelegate);
      console.log(`Model loaded successfully with ${this.config.preferredDelegate} delegate`);
      return model;
    } catch (preferredError) {
      console.warn(`Failed to load model with ${this.config.preferredDelegate} delegate:`, preferredError);
      
      try {
        // Fallback to CPU delegate
        console.log(`Falling back to ${this.config.fallbackDelegate} delegate...`);
        const model = await loadTensorflowModel(this.config.modelPath, this.config.fallbackDelegate);
        console.log(`Model loaded successfully with ${this.config.fallbackDelegate} delegate`);
        return model;
      } catch (fallbackError) {
        console.error(`Failed to load model with ${this.config.fallbackDelegate} delegate:`, fallbackError);
        return null;
      }
    }
  }

  /**
   * Load species labels from JSON file
   */
  private async loadLabels(): Promise<void> {
    try {
      // Use static require for Metro bundler compatibility
      const labelsData = require('../assets/models/birdnet/labels.json');
      if (labelsData && labelsData.labels) {
        this.labels = labelsData.labels;
      } else {
        throw new Error('Invalid labels format');
      }
      
      console.log(`Loaded ${this.labels.length} species labels`);
    } catch (error) {
      console.error('Failed to load labels:', error);
      throw error;
    }
  }

  /**
   * Classify bird audio from preprocessed mel-spectrogram data
   */
  async classifyBirdAudio(
    spectrogramData: Float32Array,
    audioUri?: string
  ): Promise<{
    results: BirdClassificationResult[];
    metadata: ClassificationMetadata;
  }> {
    const startTime = Date.now();

    try {
      if (!this.modelLoaded || !this.model) {
        throw new Error('Model not loaded. Call initialize() first.');
      }

      // Check cache if audio URI is provided
      if (audioUri && this.config.enableCaching) {
        const cached = await this.getCachedResult(audioUri);
        if (cached) {
          this.updateCacheHitRate(true);
          return {
            results: cached.result,
            metadata: {
              ...cached.metadata,
              modelSource: 'cache'
            }
          };
        }
        this.updateCacheHitRate(false);
      }

      // Run inference (use synchronous for better performance)
      const outputs = this.model.runSync([spectrogramData]);
      const predictions = outputs[0] as Float32Array;

      // Process results
      const results = this.processModelOutput(predictions);
      
      const processingTime = Date.now() - startTime;
      const metadata: ClassificationMetadata = {
        modelVersion: '2.4',
        processingTime,
        modelSource: 'tflite',
        inputShape: [1, 224, 224, 3], // Typical BirdNET input shape
        timestamp: Date.now()
      };

      // Update performance metrics
      this.updatePerformanceMetrics(processingTime);

      // Cache result if audio URI is provided
      if (audioUri && this.config.enableCaching) {
        await this.cacheResult(audioUri, results, metadata);
      }

      console.log('Bird classification completed', {
        resultsCount: results.length,
        processingTime,
        topConfidence: results[0]?.confidence || 0
      });

      return { results, metadata };

    } catch (error) {
      console.error('Classification failed:', error);
      throw error;
    }
  }

  /**
   * Process raw model output into bird classification results
   */
  private processModelOutput(predictions: Float32Array): BirdClassificationResult[] {
    const results: BirdClassificationResult[] = [];

    // Convert predictions to results with labels
    for (let i = 0; i < predictions.length; i++) {
      const confidence = predictions[i];
      
      if (confidence >= this.config.confidenceThreshold) {
        const label = this.labels[i];
        if (label) {
          results.push({
            species: label.common_name || label.label || `Unknown Species ${i}`,
            scientificName: label.scientific_name || '',
            confidence: confidence,
            index: i
          });
        }
      }
    }

    // Sort by confidence and limit results
    return results
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxResults);
  }

  /**
   * Get cached classification result
   */
  private async getCachedResult(audioUri: string): Promise<CachedResult | null> {
    try {
      const audioHash = await this.generateAudioHash(audioUri);
      const cached = this.cache.get(audioHash);

      if (cached && cached.expiry > Date.now()) {
        return cached;
      }

      // Remove expired entry
      if (cached) {
        this.cache.delete(audioHash);
      }

      return null;
    } catch (error) {
      console.warn('Failed to get cached result:', error);
      return null;
    }
  }

  /**
   * Cache classification result
   */
  private async cacheResult(
    audioUri: string,
    results: BirdClassificationResult[],
    metadata: ClassificationMetadata
  ): Promise<void> {
    try {
      // Clean cache if it's too large
      if (this.cache.size >= this.config.maxCacheSize) {
        this.cleanCache();
      }

      const audioHash = await this.generateAudioHash(audioUri);
      const cached: CachedResult = {
        result: results,
        metadata,
        expiry: Date.now() + this.config.cacheExpiryMs,
        audioHash
      };

      this.cache.set(audioHash, cached);
    } catch (error) {
      console.warn('Failed to cache result:', error);
    }
  }

  /**
   * Generate hash for audio file (simplified version using file size and modified time)
   */
  private async generateAudioHash(audioUri: string): Promise<string> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (fileInfo.exists && 'size' in fileInfo && 'modificationTime' in fileInfo) {
        return `${fileInfo.size}_${fileInfo.modificationTime}`;
      }
      return audioUri; // Fallback to URI
    } catch {
      return audioUri; // Fallback to URI
    }
  }

  /**
   * Clean old entries from cache
   */
  private cleanCache(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Remove expired entries first
    entries.forEach(([key, cached]) => {
      if (cached.expiry <= now) {
        this.cache.delete(key);
      }
    });

    // If still too large, remove oldest entries
    if (this.cache.size >= this.config.maxCacheSize) {
      const sortedEntries = entries
        .filter(([, cached]) => cached.expiry > now)
        .sort((a, b) => a[1].metadata.timestamp - b[1].metadata.timestamp);

      const toRemove = this.cache.size - Math.floor(this.config.maxCacheSize * 0.8);
      for (let i = 0; i < toRemove; i++) {
        if (sortedEntries[i]) {
          this.cache.delete(sortedEntries[i][0]);
        }
      }
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(processingTime: number): void {
    this.performanceMetrics.totalInferences++;
    
    // Update average inference time
    const totalTime = (this.performanceMetrics.avgInferenceTime * (this.performanceMetrics.totalInferences - 1)) + processingTime;
    this.performanceMetrics.avgInferenceTime = totalTime / this.performanceMetrics.totalInferences;
  }

  /**
   * Update cache hit rate
   */
  private updateCacheHitRate(hit: boolean): void {
    const totalRequests = this.performanceMetrics.totalInferences + 1;
    const currentHits = this.performanceMetrics.cacheHitRate * this.performanceMetrics.totalInferences;
    this.performanceMetrics.cacheHitRate = (currentHits + (hit ? 1 : 0)) / totalRequests;
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): ModelPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FastTfliteConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('FastTflite config updated', newConfig);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('FastTflite cache cleared');
  }

  /**
   * Dispose of model and clean up resources
   */
  dispose(): void {
    this.model = null;
    this.modelLoaded = false;
    this.cache.clear();
    console.log('FastTflite service disposed');
  }

  /**
   * Check if model is loaded and ready
   */
  isReady(): boolean {
    return this.modelLoaded && this.model !== null;
  }

  /**
   * Check if GPU is available for inference
   */
  async isGPUAvailable(): Promise<boolean> {
    try {
      // Android GPU support depends on device capabilities
      // Try to create a test model with GPU delegate
      try {
        const testModel = await loadTensorflowModel(
          this.config.modelPath,
          'android-gpu' as TensorflowModelDelegate
        );
        if (testModel) {
          testModel.release();
          return true;
        }
      } catch (e) {
        console.log('GPU delegate test failed:', e);
      }
      return false;
    } catch (error) {
      console.warn('Error checking GPU availability:', error);
      return false;
    }
  }

  /**
   * Classify image for bird detection
   * This is primarily for testing - main functionality is audio classification
   */
  async classifyImage(imagePath: string, options?: {
    enableGPU?: boolean;
    confidenceThreshold?: number;
    maxResults?: number;
  }): Promise<BirdClassificationResult[]> {
    try {
      if (!this.modelLoaded || !this.model) {
        await this.initialize();
      }

      // For bird classification, we actually need audio data
      // This method would need to extract audio from video or use a different model
      console.warn('classifyImage called but BirdNet model expects audio input');
      
      // Return mock data for now - in production, this would either:
      // 1. Use a different visual bird classification model
      // 2. Extract audio from video files
      // 3. Throw an error indicating wrong input type
      return [
        {
          species: 'Visual classification not supported',
          scientificName: 'Use audio classification instead',
          confidence: 0,
          index: -1
        }
      ];
    } catch (error) {
      console.error('Image classification error:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const fastTfliteBirdClassifier = new FastTfliteBirdClassifierService();

// Convenience functions
export const initializeFastTflite = () => fastTfliteBirdClassifier.initialize();
export const classifyBirdWithFastTflite = (
  spectrogramData: Float32Array,
  audioUri?: string
) => fastTfliteBirdClassifier.classifyBirdAudio(spectrogramData, audioUri);
export const getFastTfliteMetrics = () => fastTfliteBirdClassifier.getPerformanceMetrics();

/**
 * Full audio classification pipeline: from audio file to bird identification
 * This is the main function that combines audio preprocessing with TFLite classification
 */
export const classifyBirdFromAudioFile = async (audioUri: string) => {
  try {
    // Import here to avoid circular dependencies
    const { AudioPreprocessingTFLite } = await import('./audioPreprocessingTFLite');
    
    console.log('[FastTFLite Pipeline] Starting full audio classification...');
    
    // Step 1: Initialize the model if not already done
    if (!fastTfliteBirdClassifier.isReady()) {
      console.log('[FastTFLite Pipeline] Initializing model...');
      await fastTfliteBirdClassifier.initialize();
    }
    
    // Step 2: Preprocess audio to mel-spectrogram
    console.log('[FastTFLite Pipeline] Preprocessing audio...');
    const processedAudio = await AudioPreprocessingTFLite.processAudioFile(audioUri);
    
    // Step 3: Run classification
    console.log('[FastTFLite Pipeline] Running bird classification...');
    const classification = await fastTfliteBirdClassifier.classifyBirdAudio(
      processedAudio.melSpectrogram,
      audioUri
    );
    
    // Step 4: Return combined results
    return {
      ...classification,
      audioMetadata: processedAudio.metadata,
      audioShape: processedAudio.shape
    };
    
  } catch (error) {
    console.error('[FastTFLite Pipeline] Full classification failed:', error);
    throw error;
  }
};