/**
 * FastTfliteBirdClassifier Service - CORRECTED IMPLEMENTATION
 * 
 * Based on whoBIRD analysis: Implements proper two-model architecture
 * - Main Audio Model: Raw Float32 audio samples → species logits
 * - Meta Location Model: [latitude, longitude, week_cosine] → species filters
 * 
 * CRITICAL: BirdNET models expect raw audio samples, NOT mel-spectrograms!
 */

import {loadTensorflowModel, TensorflowModel, TensorflowModelDelegate} from 'react-native-fast-tflite';
import * as FileSystem from 'expo-file-system';
import {Platform} from 'react-native';
import {ModelConfig, ModelType} from './modelConfig';
import {getLabelsForLanguage} from './generated/BirdLabelsMap';

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
  audioProcessingType: 'raw_audio' | 'metadata_features';
  metaModelUsed?: boolean;
  metaInfluence?: number;
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
  metaModelPath?: any;  // NEW: Separate meta model for location/temporal filtering
  labelsPath: string;
  confidenceThreshold: number;
  maxResults: number;
  enableCaching: boolean;
  cacheExpiryMs: number;
  maxCacheSize: number;
  preferredDelegate: TensorflowModelDelegate;
  fallbackDelegate: TensorflowModelDelegate;
  metaInfluence: number;  // NEW: Blend factor for meta model (0-1)
  useMetaModel: boolean;  // NEW: Enable/disable meta model
}

class FastTfliteBirdClassifierService {
  private model: TensorflowModel | null = null;           // Main audio model
  private metaModel: TensorflowModel | null = null;       // NEW: Meta location/temporal model
  private labels: any[] = [];
  private modelLoaded = false;
  private metaModelLoaded = false;                        // NEW: Track meta model state
  private currentModelType: ModelType = ModelType.HIGH_ACCURACY_FP32;
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
    // Safe model path initialization with error handling
    let mainModelPath: any = null;
    let metaModelPath: any = null;

    try {
      // CORRECTED: Use the main audio model for raw Float32 audio samples
      mainModelPath = require('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite');
    } catch (error) {
      console.error('Failed to load main audio model in constructor:', error);
    }
    
    try {
      // CORRECTED: Use the separate meta model for location/temporal filtering
      metaModelPath = require('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_MData_Model_FP16.tflite');
    } catch (error) {
      console.error('Failed to load meta model in constructor:', error);
    }
    
    console.log('DEBUG: Constructor model paths:', {
      mainModel: mainModelPath,
      metaModel: metaModelPath,
      areEqual: mainModelPath === metaModelPath,
      mainModelNull: mainModelPath === null,
      metaModelNull: metaModelPath === null
    });
    
    this.config = {
      // CORRECTED: Use main audio model instead of MData model for audio processing
      modelPath: mainModelPath,
      metaModelPath: metaModelPath,
      labelsPath: '../assets/models/birdnet/labels.json',
      confidenceThreshold: 0.01,  // TEMPORARY: Lower threshold for testing
      maxResults: 5,
      enableCaching: true,
      cacheExpiryMs: 24 * 60 * 60 * 1000, // 24 hours
      maxCacheSize: 100,
      preferredDelegate: Platform.OS === 'android' ? 'android-gpu' : 'core-ml',
      fallbackDelegate: 'default',
      metaInfluence: 0.5,     // NEW: 50% influence from meta model (configurable)
      useMetaModel: true      // NEW: Enable meta model by default
    };
  }

  /**
   * Initialize the TensorFlow Lite models - CORRECTED: Two-model architecture
   * Main audio model + Meta location/temporal model
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing FastTflite bird classifier (two-model architecture)...');
      
      // Load labels first
      await this.loadLabels();
      
      // Load main audio model
      console.log('Loading main audio model...');
      this.model = await this.loadModelWithFallback(this.config.modelPath, 'main');
      
      if (!this.model) {
        throw new Error('Failed to load main audio model with any delegate');
      }
      
      this.modelLoaded = true;
      console.log('Main audio model loaded successfully');
      this.logModelInfo(this.model, 'Main Audio Model');
      
      // Load meta model if enabled
      if (this.config.useMetaModel && this.config.metaModelPath) {
        try {
          console.log('Loading meta location/temporal model...');
          this.metaModel = await this.loadModelWithFallback(this.config.metaModelPath, 'meta');
          
          if (this.metaModel) {
            this.metaModelLoaded = true;
            console.log('Meta model loaded successfully');
            this.logModelInfo(this.metaModel, 'Meta Location/Temporal Model');
          } else {
            console.warn('Meta model failed to load - continuing with main model only');
          }
        } catch (error) {
          console.warn('Meta model initialization failed:', error);
          this.metaModelLoaded = false;
        }
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

      console.log('FastTflite classifier initialized', {
        mainModel: this.modelLoaded,
        metaModel: this.metaModelLoaded,
        labelCount: this.labels.length,
        modelSize: this.performanceMetrics.modelSize,
        delegate: this.config.preferredDelegate
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize FastTflite models:', error);
      this.modelLoaded = false;
      this.metaModelLoaded = false;
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
      
      // Update configuration for new model (CORRECTED: Only update main model path)
      const modelConfig = ModelConfig.getConfiguration(modelType);
      
      // CRITICAL FIX: Only update main model path, keep meta model separate
      if (this.isAudioModel(modelType)) {
        this.config.modelPath = modelConfig.path;
        this.currentModelType = modelType;
        console.log(`Updated main audio model to: ${modelConfig.name}`);
      } else {
        console.warn(`Model type ${modelType} is not suitable for audio processing`);
        return false;
      }
      
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
   * Log model information for debugging - CORRECTED for two-model architecture
   */
  private logModelInfo(model: TensorflowModel, modelName: string = 'Model'): void {
    try {
      const inputs = (model as any).inputs;
      const outputs = (model as any).outputs;
      
      if (inputs && outputs) {
        console.log(`${modelName} tensor information:`, {
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
        
        // CORRECTED: Distinguish between main audio and meta models
        if (totalInputSize <= 10) {
          console.log(`${modelName}: Meta location/temporal model detected (${totalInputSize} features: lat, lon, week)`);
        } else if (totalInputSize >= 100000) {
          console.log(`${modelName}: Main audio model detected (${totalInputSize} raw audio samples)`);
        } else {
          console.log(`${modelName}: Model type unclear (${totalInputSize} input elements)`);
        }
      }
    } catch (error) {
      console.log(`${modelName} info not available in this version`);
    }
  }

  /**
   * Load model with delegate fallback strategy - UPDATED for two-model support
   */
  private async loadModelWithFallback(modelPath: any, modelType: 'main' | 'meta' = 'main'): Promise<TensorflowModel | null> {
    try {
      // Try preferred delegate first (GPU acceleration)
      console.log(`Attempting to load ${modelType} model with ${this.config.preferredDelegate} delegate...`);
      const model = await loadTensorflowModel(modelPath, this.config.preferredDelegate);
      console.log(`${modelType} model loaded successfully with ${this.config.preferredDelegate} delegate`);
      return model;
    } catch (preferredError) {
      console.warn(`Failed to load ${modelType} model with ${this.config.preferredDelegate} delegate:`, preferredError);
      
      try {
        // Fallback to CPU delegate
        console.log(`Falling back to ${this.config.fallbackDelegate} delegate for ${modelType} model...`);
        const model = await loadTensorflowModel(modelPath, this.config.fallbackDelegate);
        console.log(`${modelType} model loaded successfully with ${this.config.fallbackDelegate} delegate`);
        return model;
      } catch (fallbackError) {
        console.error(`Failed to load ${modelType} model with ${this.config.fallbackDelegate} delegate:`, fallbackError);
        return null;
      }
    }
  }

  /**
   * Load species labels from whoBIRD format - FIXED implementation for Metro
   * Labels follow format: "ScientificName_CommonName"
   */
  private async loadLabels(): Promise<void> {
    try {
      // Try to load whoBIRD labels first (preferred)
      try {
        console.log('Loading whoBIRD labels in English...');
        
        // Use the BirdLabelsMap approach - static require that Metro can handle
        const labelsAsset = getLabelsForLanguage('en'); // Default to English
        
        // Check if we got the asset correctly
        if (!labelsAsset) {
          throw new Error('Labels asset not found in BirdLabelsMap');
        }
        
        // For Metro bundler, the asset might be a number (asset ID) or object
        let labelsText: string;
        
        if (typeof labelsAsset === 'number') {
          // Asset ID - use expo-asset to resolve
          const { Asset } = await import('expo-asset');
          const asset = Asset.fromModule(labelsAsset);
          await asset.downloadAsync();
          
          if (!asset.localUri) {
            throw new Error('Failed to download labels asset');
          }
          
          labelsText = await FileSystem.readAsStringAsync(asset.localUri);
        } else if (typeof labelsAsset === 'object' && labelsAsset.default) {
          // Direct asset object
          labelsText = labelsAsset.default;
        } else {
          // Try to use it directly as text
          labelsText = String(labelsAsset);
        }
        
        // Parse whoBIRD format: "ScientificName_CommonName"
        this.labels = labelsText.split('\n')
          .filter((line: string) => line.trim().length > 0)
          .map((line: string, index: number) => {
            const parts = line.trim().split('_');
            if (parts.length >= 2) {
              return {
                index,
                scientific_name: parts[0],
                common_name: parts.slice(1).join('_'), // Handle names with multiple underscores
                label: parts.slice(1).join('_')
              };
            } else {
              return {
                index,
                scientific_name: line.trim(),
                common_name: line.trim(),
                label: line.trim()
              };
            }
          });
        
        console.log(`Loaded ${this.labels.length} whoBIRD species labels from static require`);
        return;
      } catch (whoBirdError) {
        console.warn('whoBIRD labels not found, falling back to legacy format', whoBirdError);
      }

      // Fallback to legacy JSON format
      try {
        const labelsData = require('../assets/models/birdnet/labels.json');
        if (labelsData && labelsData.labels) {
          this.labels = labelsData.labels;
        } else {
          throw new Error('Invalid labels format');
        }
      } catch (legacyError) {
        console.error('Failed to load legacy labels:', legacyError);
        // Create minimal dummy labels as last resort
        this.labels = Array.from({ length: 6522 }, (_, i) => ({
          index: i,
          scientific_name: `Species_${i}`,
          common_name: `Unknown Species ${i}`,
          label: `Species_${i}`
        }));
        console.warn('Using dummy labels - species identification will be limited');
      }
      
      console.log(`Loaded ${this.labels.length} legacy species labels`);
    } catch (error) {
      console.error('Failed to load labels:', error);
      throw error;
    }
  }

  /**
   * Classify bird audio - CORRECTED: Single MData model with embedded metadata
   * MData model: [Raw Float32 audio samples, metadata] → species probabilities
   */
  async classifyBirdAudio(
    processedData: Float32Array,
    audioUri?: string,
    location?: { latitude: number; longitude: number }
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

      // Prepare model inputs - just use the processed audio data
      const modelInputs = [processedData];
      
      console.log(`Running inference with model inputs:`, {
        inputCount: modelInputs.length,
        audioSamples: processedData.length,
        hasLocation: !!location
      });
      
      // Run main model inference
      const outputs = this.model.runSync(modelInputs);
      let probabilities = outputs[0] as Float32Array;
      
      // Apply sigmoid activation to convert logits to probabilities
      probabilities = this.applySigmoid(probabilities);
      
      // Meta model blending if enabled and location provided
      let metaModelUsed = false;
      let metaInfluence = 0;
      
      if (this.config.useMetaModel && this.metaModelLoaded && location) {
        try {
          const metaProbabilities = await this.runMetaModelInference(location);
          probabilities = this.blendPredictions(probabilities, metaProbabilities);
          metaModelUsed = true;
          metaInfluence = this.config.metaInfluence;
        } catch (metaError) {
          console.warn('Meta model inference failed, using audio-only results:', metaError);
        }
      }
      
      // DEBUG: Log prediction statistics
      const maxPrediction = Math.max(...Array.from(probabilities));
      const avgPrediction = Array.from(probabilities).reduce((a, b) => a + b, 0) / probabilities.length;
      const aboveThreshold = Array.from(probabilities).filter(p => p >= this.config.confidenceThreshold).length;
      
      console.log('DEBUG: Model output:', {
        predictionsLength: probabilities.length,
        maxConfidence: maxPrediction,
        avgConfidence: avgPrediction,
        aboveThreshold,
        threshold: this.config.confidenceThreshold,
        metadataUsed: !!location
      });

      // Process final results
      const results = this.processModelOutput(probabilities);
      
      const processingTime = Date.now() - startTime;
      const metadata: ClassificationMetadata = {
        modelVersion: '2.4',
        modelType: this.currentModelType,
        processingTime,
        modelSource: 'tflite',
        inputShape: this.getModelInputShape(),
        timestamp: Date.now(),
        audioProcessingType: 'raw_audio',
        metaModelUsed,
        metaInfluence
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
   * Apply sigmoid activation to convert logits to probabilities
   */
  private applySigmoid(logits: Float32Array): Float32Array {
    const probabilities = new Float32Array(logits.length);
    for (let i = 0; i < logits.length; i++) {
      probabilities[i] = 1 / (1 + Math.exp(-logits[i]));
    }
    return probabilities;
  }

  /**
   * Run meta model inference for location/temporal filtering
   */
  private async runMetaModelInference(location: { latitude: number; longitude: number }): Promise<Float32Array> {
    if (!this.metaModel) {
      throw new Error('Meta model not loaded');
    }

    // Calculate week of year (cosine-transformed)
    const now = new Date();
    const dayOfYear = this.getDayOfYear(now);
    const week = Math.ceil(dayOfYear * 48.0 / 366.0); // 48-week model year
    const weekCosine = Math.cos((week * 7.5) * Math.PI / 180) + 1.0; // 0-2 range

    // Prepare meta model input: [latitude, longitude, week_cosine]
    const metaInput = new Float32Array(3);
    metaInput[0] = location.latitude;
    metaInput[1] = location.longitude;
    metaInput[2] = weekCosine;

    console.log('Meta model input:', {
      latitude: location.latitude,
      longitude: location.longitude,
      week_cosine: weekCosine
    });

    // Run meta model inference
    const metaOutputs = this.metaModel.runSync([metaInput]);
    const metaProbabilities = metaOutputs[0] as Float32Array;
    
    console.log(`Meta model: ${metaProbabilities.length} location-based probabilities`);
    return metaProbabilities;
  }

  /**
   * Blend audio and meta predictions using whoBIRD formula
   */
  private blendPredictions(audioProbabilities: Float32Array, metaProbabilities: Float32Array): Float32Array {
    const blended = new Float32Array(audioProbabilities.length);
    const metaInfluence = this.config.metaInfluence;
    
    for (let i = 0; i < audioProbabilities.length && i < metaProbabilities.length; i++) {
      // whoBIRD formula: audioProb * (1 - metaInfluence + metaInfluence * metaProb)
      blended[i] = audioProbabilities[i] * (1 - metaInfluence + metaInfluence * metaProbabilities[i]);
    }
    
    // Handle case where arrays have different lengths
    for (let i = metaProbabilities.length; i < audioProbabilities.length; i++) {
      blended[i] = audioProbabilities[i] * (1 - metaInfluence); // No meta info for this species
    }
    
    console.log(`Blended predictions with ${metaInfluence} meta influence`);
    return blended;
  }

  /**
   * Calculate day of year for week calculation
   */
  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if model type is suitable for audio processing (not meta/location model)
   */
  private isAudioModel(modelType: ModelType): boolean {
    // Audio models are those that process raw audio samples
    return modelType === ModelType.HIGH_ACCURACY_FP32 || 
           modelType === ModelType.BALANCED_FP16 ||
           modelType === ModelType.LEGACY;
    // MData models are for location/temporal data only
  }

  /**
   * Classify bird audio with a specific model type - UPDATED for two-model architecture
   */
  async classifyBirdAudioWithModel(
    audioData: Float32Array,
    modelType: ModelType,
    audioUri?: string,
    location?: { latitude: number; longitude: number }
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

    // Use the regular classification method with location data
    return this.classifyBirdAudio(audioData, audioUri, location);
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
   * Dispose of models and clean up resources - UPDATED for two-model architecture
   */
  dispose(): void {
    this.model = null;
    this.metaModel = null;
    this.modelLoaded = false;
    this.metaModelLoaded = false;
    this.cache.clear();
    console.log('FastTflite service disposed (both models)');
  }

  /**
   * Check if models are loaded and ready - UPDATED for two-model architecture
   */
  isReady(): boolean {
    const mainReady = this.modelLoaded && this.model !== null;
    const metaReady = !this.config.useMetaModel || (this.metaModelLoaded && this.metaModel !== null);
    return mainReady && metaReady;
  }

  /**
   * Check if main audio model is ready
   */
  isMainModelReady(): boolean {
    return this.modelLoaded && this.model !== null;
  }

  /**
   * Check if meta model is ready
   */
  isMetaModelReady(): boolean {
    return this.metaModelLoaded && this.metaModel !== null;
  }

  /**
   * Update meta model configuration
   */
  updateMetaConfig(metaInfluence: number, useMetaModel: boolean): void {
    this.config.metaInfluence = Math.max(0, Math.min(1, metaInfluence)); // Clamp to [0, 1]
    this.config.useMetaModel = useMetaModel;
    console.log('Meta model config updated:', {
      metaInfluence: this.config.metaInfluence,
      useMetaModel: this.config.useMetaModel
    });
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

// Create singleton instance with lazy initialization
let fastTfliteBirdClassifierInstance: FastTfliteBirdClassifierService | null = null;

function createSafeInstance(): FastTfliteBirdClassifierService {
  if (fastTfliteBirdClassifierInstance) {
    return fastTfliteBirdClassifierInstance;
  }

  try {
    fastTfliteBirdClassifierInstance = new FastTfliteBirdClassifierService();
    console.log('FastTfliteBirdClassifierService singleton created successfully');
    return fastTfliteBirdClassifierInstance;
  } catch (error) {
    console.error('CRITICAL: Failed to create FastTfliteBirdClassifierService singleton:', error);
    console.error('This may indicate a "Super expression must either be null or a function" error');
    
    // Create a fallback instance that won't crash the app
    const fallbackInstance = {
      initialize: async () => {
        console.warn('Using fallback FastTflite instance - functionality limited');
        return false;
      },
      isReady: () => false,
      classifyBirdAudio: async () => ({ 
        results: [], 
        metadata: {
          modelVersion: 'fallback',
          modelType: ModelType.LEGACY,
          processingTime: 0,
          modelSource: 'fallback' as const,
          inputShape: [],
          timestamp: Date.now(),
          audioProcessingType: 'raw_audio' as const,
        }
      }),
      dispose: () => {},
      getPerformanceMetrics: () => ({
        avgInferenceTime: 0,
        totalInferences: 0,
        memoryUsage: 0,
        modelSize: 0,
        cacheHitRate: 0
      }),
      // Add other required methods as stubs
      switchModel: async () => false,
      getCurrentModelType: () => ModelType.LEGACY,
      isModelLoaded: () => false,
      classifyBirdAudioWithModel: async () => ({ 
        results: [], 
        metadata: {
          modelVersion: 'fallback',
          modelType: ModelType.LEGACY,
          processingTime: 0,
          modelSource: 'fallback' as const,
          inputShape: [],
          timestamp: Date.now(),
          audioProcessingType: 'raw_audio' as const,
        }
      }),
      isMainModelReady: () => false,
      isMetaModelReady: () => false,
      updateMetaConfig: () => {},
      getModelInputShape: () => [1, 3],
      updateConfig: () => {},
      clearCache: () => {},
    } as unknown as FastTfliteBirdClassifierService;
    
    fastTfliteBirdClassifierInstance = fallbackInstance;
    return fallbackInstance;
  }
}

export const fastTfliteBirdClassifier = createSafeInstance();

// Convenience functions
export const initializeFastTflite = () => fastTfliteBirdClassifier.initialize();
export const classifyBirdWithFastTflite = (
  audioData: Float32Array,
  audioUri?: string,
  location?: { latitude: number; longitude: number }
) => fastTfliteBirdClassifier.classifyBirdAudio(audioData, audioUri, location);
export const getFastTfliteMetrics = () => fastTfliteBirdClassifier.getPerformanceMetrics();