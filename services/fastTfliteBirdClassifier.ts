/**
 * FastTfliteBirdClassifier Service
 * 
 * High-performance bird audio classification using react-native-fast-tflite.
 * Provides offline-first bird identification with intelligent fallback strategies.
 * Supports multiple whoBIRD models for different use cases.
 */

import { loadTensorflowModel, TensorflowModel, TensorflowModelDelegate } from 'react-native-fast-tflite';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { ModelType, ModelConfig } from './modelConfig';

export interface BirdClassificationResult {
  species: string;
  scientificName: string;
  confidence: number;
  index: number;
}

export interface ClassificationMetadata {
  modelVersion: string;
  modelType: ModelType;
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
  private currentModelType: ModelType = ModelType.MDATA_V2_FP16;
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
      modelPath: require('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16.tflite'),
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
      
      // Log basic model info for debugging (no validation in production)
      this.logModelInfo(this.model);
      
      // Get model size for metrics
      const modelUri = this.config.modelPath;
      if (typeof modelUri === 'string') {
        try {
          const fileInfo = await FileSystem.getInfoAsync(modelUri);
          if (fileInfo.exists && 'size' in fileInfo) {
            this.performanceMetrics.modelSize = fileInfo.size;
          }
        } catch (error) {
          console.warn('Could not get model file size:', error);
        }
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
   * Switch to a different model type
   */
  async switchModel(modelType: ModelType): Promise<boolean> {
    try {
      // If already using this model, no need to switch
      if (this.currentModelType === modelType && this.modelLoaded) {
        console.log(`Already using model: ${ModelConfig.getModelInfo(modelType)}`);
        return true;
      }

      console.log(`Switching to model: ${ModelConfig.getModelInfo(modelType)}`);
      
      // Dispose current model
      this.dispose();
      
      // Update configuration for new model
      const modelConfig = ModelConfig.getConfiguration(modelType);
      this.config.modelPath = modelConfig.path;
      this.currentModelType = modelType;
      
      // Load appropriate labels for the model
      await this.loadLabelsForModel(modelType);
      
      // Initialize with new model
      const success = await this.initialize();
      
      if (success) {
        console.log(`Successfully switched to ${ModelConfig.getModelInfo(modelType)}`);
      }
      
      return success;
    } catch (error) {
      console.error('Failed to switch model:', error);
      return false;
    }
  }

  /**
   * Get the currently loaded model type
   */
  getCurrentModelType(): ModelType {
    return this.currentModelType;
  }

  /**
   * Load labels appropriate for the model type
   */
  private async loadLabelsForModel(modelType: ModelType): Promise<void> {
    try {
      if (modelType === ModelType.LEGACY) {
        // Use existing legacy labels
        this.config.labelsPath = '../assets/models/birdnet/labels.json';
      } else if (modelType === ModelType.HIGH_ACCURACY_FP32) {
        // FP32 model has embedded labels - create dummy labels array for compatibility
        console.log(`Using embedded labels for ${modelType} - no external label file needed`);
        this.labels = Array.from({ length: 6522 }, (_, i) => ({
          index: i,
          common_name: `Species_${i}`,
          scientific_name: `Species_${i}`,
          label: `Species_${i}`
        }));
        return; // Skip the regular label loading
      } else {
        // For other whoBIRD models, use existing labels initially
        this.config.labelsPath = '../assets/models/birdnet/labels.json';
        console.warn(`Using legacy labels for ${modelType}. For full accuracy, obtain proper labels for this model.`);
      }
    } catch (error) {
      console.error('Failed to configure labels for model:', error);
      throw error;
    }
  }

  /**
   * Check if a specific model is currently loaded
   */
  isModelLoaded(modelType: ModelType): boolean {
    return this.modelLoaded && this.currentModelType === modelType;
  }

  /**
   * Log basic model information for debugging (lightweight replacement for validation)
   */
  private logModelInfo(model: TensorflowModel): void {
    try {
      const inputs = (model as any).inputs;
      const outputs = (model as any).outputs;
      
      if (inputs && outputs) {
        console.log('Model tensor information:', {
          inputs: inputs.map((input: any) => ({
            name: input.name,
            dataType: input.dataType,
            shape: input.shape
          })),
          outputs: outputs.map((output: any) => ({
            name: output.name,
            dataType: output.dataType,
            shape: output.shape
          }))
        });
        
        const totalInputSize = inputs[0]?.shape?.reduce((acc: number, dim: number) => {
          const actualDim = dim === -1 ? 1 : Math.abs(dim);
          return acc * actualDim;
        }, 1) || 0;
        
        if (totalInputSize <= 100) {
          console.log(`Feature-based audio model detected: ${totalInputSize} input features`);
        } else if (totalInputSize <= 10000) {
          console.log(`Compressed audio model detected: ${totalInputSize} input elements`);
        } else {
          console.log(`Full mel-spectrogram audio model detected: ${totalInputSize} input elements`);
        }
      }
    } catch (error) {
      console.log('Model info not available in this version');
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
   * Classify bird audio from preprocessed data (mel-spectrogram or features)
   */
  async classifyBirdAudio(
    processedData: Float32Array,
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

      // Validate input size matches model expectations
      const expectedShape = this.getModelInputShape();
      const expectedSize = expectedShape.reduce((acc, dim) => acc * Math.abs(dim), 1);
      
      if (processedData.length !== expectedSize) {
        console.warn(`Input size mismatch: expected ${expectedSize}, got ${processedData.length}`);
        // For now, continue with available data but log the issue
      }
      
      console.log(`Running inference with ${processedData.length} input elements`);
      
      // Run inference (use synchronous for better performance)
      const outputs = this.model.runSync([processedData]);
      const predictions = outputs[0] as Float32Array;

      // Process results
      const results = this.processModelOutput(predictions);
      
      const processingTime = Date.now() - startTime;
      const metadata: ClassificationMetadata = {
        modelVersion: '2.4',
        modelType: this.currentModelType,
        processingTime,
        modelSource: 'tflite',
        inputShape: this.getModelInputShape(), // Actual model input shape
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
   * Classify bird audio with a specific model type
   */
  async classifyBirdAudioWithModel(
    spectrogramData: Float32Array,
    modelType: ModelType,
    audioUri?: string
  ): Promise<{
    results: BirdClassificationResult[];
    metadata: ClassificationMetadata;
  }> {
    // Switch to the requested model if not already loaded
    if (!this.isModelLoaded(modelType)) {
      const switched = await this.switchModel(modelType);
      if (!switched) {
        throw new Error(`Failed to switch to model: ${ModelConfig.getModelInfo(modelType)}`);
      }
    }

    // Use the regular classification method
    return this.classifyBirdAudio(spectrogramData, audioUri);
  }

  /**
   * Process raw model output into bird classification results
   */
  private processModelOutput(predictions: Float32Array): BirdClassificationResult[] {
    const results: BirdClassificationResult[] = [];

    // Check if model output matches label count
    if (predictions.length !== this.labels.length) {
      console.warn(`Model output size (${predictions.length}) doesn't match label count (${this.labels.length}). Using limited classification.`);
      
      // Only process up to the available labels or predictions, whichever is smaller
      const maxIndex = Math.min(predictions.length, this.labels.length);
      
      for (let i = 0; i < maxIndex; i++) {
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
      
      return results.sort((a, b) => b.confidence - a.confidence).slice(0, this.config.maxResults);
    }

    // Normal processing when sizes match
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
   * Get the current model's input shape
   */
  getModelInputShape(): number[] {
    try {
      if (this.model && (this.model as any).inputs) {
        const actualShape = (this.model as any).inputs[0]?.shape;
        if (actualShape && Array.isArray(actualShape)) {
          console.log(`Actual model input shape: [${actualShape.join(', ')}]`);
          return actualShape;
        }
      }
    } catch (error) {
      console.warn('Could not get model input shape:', error);
    }
    // Minimal default - will be overridden by actual model inspection
    console.warn('Using fallback input shape [1, 3] - model shape detection failed');
    return [1, 3];
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