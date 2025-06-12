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
      
      // Validate model after loading
      const isValid = await this.validateModel(this.model);
      if (!isValid) {
        throw new Error('Model validation failed - incompatible model format');
      }
      
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
      console.log('FastTflite model loaded and validated successfully', {
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
      } else {
        // For whoBIRD models, we'll need to use the existing labels initially
        // In future, we should get the proper 6,522 species labels
        this.config.labelsPath = '../assets/models/birdnet/labels.json';
        console.warn(`Using legacy labels for ${modelType}. For full accuracy, obtain proper 6,522 species labels.`);
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
   * Validate model tensor information and compatibility
   */
  private async validateModel(model: TensorflowModel): Promise<boolean> {
    try {
      console.log('Validating TensorFlow Lite model...');
      
      // Check if model has tensor information (available in newer versions)
      let tensorInfoAvailable = false;
    try {
        // Try to access tensor information if available
        const inputs = (model as any).inputs;
        const outputs = (model as any).outputs;
        
        if (inputs && outputs) {
          tensorInfoAvailable = true;
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
          
          // Validate input tensor requirements for BirdNET model
          if (inputs.length !== 1) {
            console.error('Expected exactly 1 input tensor, got', inputs.length);
            return false;
          }
          
          const inputTensor = inputs[0];
          
          // Check input data type (should be float32 for BirdNET)
          if (inputTensor.dataType !== 'float32') {
            console.error('Expected input data type to be float32, got', inputTensor.dataType);
            return false;
          }
          
          // Check input shape (expected: [1, 224, 224, 3] for BirdNET v2.4)
          const expectedShape = [1, 224, 224, 3];
          if (inputTensor.shape.length !== expectedShape.length) {
            console.error('Expected input shape to have', expectedShape.length, 'dimensions, got', inputTensor.shape.length);
            return false;
          }
          
          // Validate specific dimensions (allowing for dynamic batch size -1)
          for (let i = 1; i < expectedShape.length; i++) {
            if (inputTensor.shape[i] !== expectedShape[i]) {
              console.error(`Expected input shape[${i}] to be ${expectedShape[i]}, got ${inputTensor.shape[i]}`);
              return false;
            }
          }
          
          // Validate output tensor
          if (outputs.length !== 1) {
            console.error('Expected exactly 1 output tensor, got', outputs.length);
            return false;
          }
          
          const outputTensor = outputs[0];
          
          // Check output data type (should be float32)
          if (outputTensor.dataType !== 'float32') {
            console.error('Expected output data type to be float32, got', outputTensor.dataType);
            return false;
          }
          
          // Validate that we have the right number of classes
          const outputSize = outputTensor.shape.reduce((acc: number, dim: number) => acc * (dim === -1 ? 1 : dim), 1);
          if (outputSize !== this.labels.length) {
            console.warn(`Output tensor size (${outputSize}) doesn't match label count (${this.labels.length})`);
            // Don't fail validation for this, just warn
          }
        }
      } catch (tensorError) {
        console.log('Tensor information not available in this version of react-native-fast-tflite');
      }
      
      // Perform a test inference to ensure the model works (this is the most important validation)
      console.log('Performing test inference to validate model functionality...');
      const testInput = new Float32Array(224 * 224 * 3); // Create test input
      testInput.fill(0.5); // Fill with dummy data
      
      try {
        const testOutput = model.runSync([testInput]);
        if (!testOutput || testOutput.length !== 1) {
          console.error('Test inference failed - invalid output structure');
          return false;
        }
        
        const predictions = testOutput[0] as Float32Array;
        if (!predictions || predictions.length === 0) {
          console.error('Test inference failed - invalid prediction array');
          return false;
        }
        
        // Validate that prediction values are reasonable (between 0 and 1 for probabilities)
        let validPredictions = 0;
        for (let i = 0; i < Math.min(predictions.length, 100); i++) { // Check first 100
          if (predictions[i] >= 0 && predictions[i] <= 1 && !isNaN(predictions[i])) {
            validPredictions++;
          }
        }
        
        if (validPredictions === 0) {
          console.error('Test inference failed - predictions contain invalid values');
          return false;
        }
        
        // Check if we have reasonable number of predictions
        if (predictions.length < 100 || predictions.length > 50000) {
          console.warn(`Unusual prediction array size: ${predictions.length}. Expected between 100-50000 classes.`);
        }
        
        // If we have labels loaded, check compatibility
        if (this.labels.length > 0 && Math.abs(predictions.length - this.labels.length) > 10) {
          console.error(`Model validation failed - incompatible model format. Prediction count (${predictions.length}) differs significantly from label count (${this.labels.length})`);
          console.error('This indicates the TFLite model is not compatible with the current label set.');
          console.error('Expected: ~6522 classes for BirdNET v2.4, Got:', predictions.length);
          return false;
        }
        
        console.log('Test inference successful - model is working correctly', {
          tensorInfoAvailable,
          predictionCount: predictions.length,
          validPredictionSample: validPredictions,
          labelCount: this.labels.length
        });
        
      } catch (inferenceError) {
        console.error('Test inference failed:', inferenceError);
        return false;
      }
      
      console.log('Model validation completed successfully');
      return true;
      
    } catch (error) {
      console.error('Model validation error:', error);
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
        modelType: this.currentModelType,
        processingTime,
        modelSource: 'tflite',
        inputShape: [1, 224, 224, 3], // Current model input shape
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