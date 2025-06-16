import * as FileSystem from 'expo-file-system';
import {BirdClassificationResult, fastTfliteBirdClassifier} from './fastTfliteBirdClassifier';
import {AudioPreprocessingTFLite} from './audioPreprocessingTFLite';
import {ModelConfig, ModelType} from './modelConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AudioPrediction {
  common_name: string;
  scientific_name: string;
  confidence: number;
  timestamp_start?: number;
  timestamp_end?: number;
}

export interface AudioResponse {
  predictions: AudioPrediction[];
  processing_time: number;
  audio_duration: number;
  success: boolean;
  error?: string;
  source?: 'tflite' | 'cache' | 'offline';
  cache_hit?: boolean;
}

export interface AudioConfig {
  minConfidence?: number;
  enableCache?: boolean;
  cacheExpirationHours?: number;
  maxPredictions?: number;
}

export class AudioIdentificationService {
  private static config: AudioConfig = {
    minConfidence: 0.1,
    enableCache: true,
    cacheExpirationHours: 24,
    maxPredictions: 5,
  };

  private static tfliteInitialized = false;
  private static readonly CACHE_KEY_PREFIX = '@audio_cache:';
  private static currentModelType: ModelType = ModelType.MDATA_V2_FP16; // Use fast FP16 for real-time
  private static performanceMetrics = {
    totalProcessingTime: 0,
    processedCount: 0,
    averageTime: 0,
    lastProcessingTime: 0
  };

  static updateConfig(newConfig: Partial<AudioConfig>) {
    this.config = { ...this.config, ...newConfig };
  }


  // Initialize FastTflite for audio classification
  static async initializeFastTflite(): Promise<void> {
    try {
      if (!this.tfliteInitialized) {
        await fastTfliteBirdClassifier.initialize();
        this.tfliteInitialized = true;
        console.log('AudioIdentificationService: FastTflite mode initialized');
      }
    } catch (error) {
      console.error('AudioIdentificationService: Failed to initialize FastTflite mode:', error);
      this.tfliteInitialized = false;
    }
  }

  // Initialize audio processing with optimized model selection
  static async initialize(modelType?: ModelType): Promise<void> {
    try {
      console.log('AudioIdentificationService: Initializing audio processing...');
      
      // Use specified model or default to fast real-time model
      this.currentModelType = modelType || ModelConfig.getRecommendedModel('real-time');
      console.log(`AudioIdentificationService: Using ${ModelConfig.getModelInfo(this.currentModelType)} for real-time processing`);
      
      // Initialize FastTflite for audio classification
      await this.initializeFastTflite();
      
      // Reset performance metrics
      this.performanceMetrics = {
        totalProcessingTime: 0,
        processedCount: 0,
        averageTime: 0,
        lastProcessingTime: 0
      };
      
      console.log('AudioIdentificationService: Audio processing initialized successfully');
    } catch (error) {
      console.error('AudioIdentificationService: Failed to initialize audio processing:', error);
      throw error;
    }
  }

  // Cache management methods
  private static async getCachedResult(key: string): Promise<AudioResponse | null> {
    if (!this.config.enableCache) return null;
    
    try {
      const cacheKey = this.CACHE_KEY_PREFIX + key;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (cached) {
        const parsedCache = JSON.parse(cached);
        const cacheAge = Date.now() - parsedCache.timestamp;
        const maxAge = (this.config.cacheExpirationHours || 24) * 60 * 60 * 1000;
        
        if (cacheAge < maxAge) {
          console.log('BirdNetService: Cache hit for', key);
          return {
            ...parsedCache.data,
            cache_hit: true,
          };
        }
      }
    } catch (error) {
      console.error('Cache retrieval error:', error);
    }
    
    return null;
  }
  
  private static async setCachedResult(key: string, result: AudioResponse): Promise<void> {
    if (!this.config.enableCache) return;
    
    try {
      const cacheKey = this.CACHE_KEY_PREFIX + key;
      const cacheData = {
        data: result,
        timestamp: Date.now(),
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Cache storage error:', error);
    }
  }

  static async identifyBirdFromAudio(
    audioUri: string,
    options?: {
      latitude?: number;
      longitude?: number;
      minConfidence?: number;
      modelType?: ModelType;
    }
  ): Promise<AudioResponse> {
    const startTime = Date.now();
    
    try {
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        throw new Error('Audio file not found');
      }

      // Check cache first
      const cacheKey = `audio_${fileInfo.modificationTime}_${fileInfo.size}`;
      const cachedResult = await this.getCachedResult(cacheKey);
      if (cachedResult) {
        console.log(`AudioIdentificationService: Cache hit for ${cacheKey}`);
        return cachedResult;
      }

      // Initialize FastTflite for audio processing
      if (!this.tfliteInitialized) {
        await this.initializeFastTflite();
      }

      // Try FastTflite first for audio classification
      if (this.tfliteInitialized) {
        try {
          // Use real-time optimized model unless specifically overridden
          const modelType = options?.modelType || this.currentModelType;
          console.log(`AudioIdentificationService: Using FastTflite classification for audio with ${ModelConfig.getModelInfo(modelType)}`);
          
          // Get model input shape for correct preprocessing
          const modelInputShape = fastTfliteBirdClassifier.isReady() 
            ? (fastTfliteBirdClassifier as any).getModelInputShape?.() 
            : undefined;
          
          // Preprocess audio with dynamic format based on model requirements
          const preprocessingStart = Date.now();
          const processedAudio = await AudioPreprocessingTFLite.processAudioFile(audioUri, modelInputShape);
          const preprocessingTime = Date.now() - preprocessingStart;
          
          console.log(`Preprocessed audio in ${preprocessingTime}ms - shape: [${processedAudio.shape.join(', ')}], type: ${processedAudio.metadata.processingType}`);
          
          // Switch to optimized model if needed
          if (!fastTfliteBirdClassifier.isReady()) {
            console.log(`Initializing FastTflite with ${ModelConfig.getModelInfo(modelType)}`);
            await fastTfliteBirdClassifier.initialize();
          }
          
          if (!fastTfliteBirdClassifier.isModelLoaded(modelType)) {
            console.log(`Switching to optimized model: ${modelType}`);
            const switched = await fastTfliteBirdClassifier.switchModel(modelType);
            if (!switched) {
              console.warn(`Failed to switch to model: ${modelType}, continuing with current model`);
            }
          }
          
          // Run classification with location data for meta model
          const location = (options?.latitude !== undefined && options?.longitude !== undefined) 
            ? { latitude: options.latitude, longitude: options.longitude }
            : undefined;
          
          const classificationStart = Date.now();
          const tfliteResult = await fastTfliteBirdClassifier.classifyBirdAudio(
            processedAudio.processedData,
            audioUri,
            location
          );
          const classificationTime = Date.now() - classificationStart;
          
          console.log(`Classification completed in ${classificationTime}ms`);
          
          // Convert FastTflite result to Audio response format
          const response = this.convertFastTfliteResultToAudioResponse(
            tfliteResult.results,
            tfliteResult.metadata,
            processedAudio.metadata.duration
          );
          
          // Update performance metrics
          const totalTime = Date.now() - startTime;
          this.updatePerformanceMetrics(totalTime);
          console.log(`Total audio processing: ${totalTime}ms (avg: ${this.performanceMetrics.averageTime}ms)`);
          
          // Cache the result
          await this.setCachedResult(cacheKey, response);
          
          return response;
          
        } catch (tfliteError) {
          console.error('AudioIdentificationService: FastTflite classification failed:', tfliteError);
          throw new Error('Audio classification failed. Please ensure FastTflite model is properly initialized.');
        }
      }

      // If FastTflite not initialized, return error
      throw new Error('FastTflite not initialized. Please call initialize() first.');
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`Audio identification error after ${totalTime}ms:`, error);
      throw error;
    }
  }



  // Convert FastTflite result to standard response format
  private static convertFastTfliteResultToAudioResponse(
    results: BirdClassificationResult[],
    metadata: any,
    audioDuration: number
  ): AudioResponse {
    const predictions: AudioPrediction[] = results
      .filter(result => result.confidence >= (this.config.minConfidence || 0.1))
      .slice(0, this.config.maxPredictions || 5)
      .map(result => ({
        common_name: result.species,
        scientific_name: result.scientificName,
        confidence: result.confidence,
        timestamp_start: 0,
        timestamp_end: audioDuration,
      }));

    return {
      predictions,
      processing_time: metadata.processingTime / 1000, // Convert to seconds
      audio_duration: audioDuration,
      success: predictions.length > 0,
      source: 'tflite',
      cache_hit: metadata.modelSource === 'cache',
    };
  }

  static formatConfidenceScore(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
  }

  static getBestPrediction(predictions: AudioPrediction[]): AudioPrediction | null {
    if (predictions.length === 0) return null;
    return predictions.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }
  
  // Clear cache utility
  static async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_KEY_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`AudioIdentificationService: Cleared ${cacheKeys.length} cached results`);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
  
  // Get cache statistics
  static async getCacheStats(): Promise<{ count: number; oldestTimestamp: number | null }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_KEY_PREFIX));
      
      let oldestTimestamp: number | null = null;
      
      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const parsedCache = JSON.parse(cached);
          if (!oldestTimestamp || parsedCache.timestamp < oldestTimestamp) {
            oldestTimestamp = parsedCache.timestamp;
          }
        }
      }
      
      return { count: cacheKeys.length, oldestTimestamp };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { count: 0, oldestTimestamp: null };
    }
  }

  // Performance metrics management
  private static updatePerformanceMetrics(processingTime: number): void {
    this.performanceMetrics.processedCount++;
    this.performanceMetrics.totalProcessingTime += processingTime;
    this.performanceMetrics.lastProcessingTime = processingTime;
    this.performanceMetrics.averageTime = Math.round(
      this.performanceMetrics.totalProcessingTime / this.performanceMetrics.processedCount
    );
  }

  static getPerformanceMetrics(): typeof AudioIdentificationService.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  // Adaptive interval calculation for camera component
  static getAdaptiveInterval(hasBirdsDetected: boolean, lastResults: AudioPrediction[]): number {
    const baseInterval = 5000; // 5 seconds base
    const fastInterval = 3000;  // 3 seconds when birds detected
    const slowInterval = 8000;  // 8 seconds when quiet for long time
    
    // If birds detected recently, use fast interval
    if (hasBirdsDetected && lastResults.length > 0) {
      return fastInterval;
    }
    
    // If processing is slow (>4s avg), reduce frequency to prevent overlap
    if (this.performanceMetrics.averageTime > 4000) {
      return slowInterval;
    }
    
    // Default interval
    return baseInterval;
  }

  // Switch to different model type for different scenarios
  static async switchModelForScenario(scenario: 'real-time' | 'manual' | 'research'): Promise<boolean> {
    try {
      const newModelType = ModelConfig.getRecommendedModel(scenario);
      
      if (newModelType !== this.currentModelType) {
        console.log(`AudioIdentificationService: Switching from ${this.currentModelType} to ${newModelType} for ${scenario} scenario`);
        
        const switched = await fastTfliteBirdClassifier.switchModel(newModelType);
        if (switched) {
          this.currentModelType = newModelType;
          console.log(`AudioIdentificationService: Successfully switched to ${ModelConfig.getModelInfo(newModelType)}`);
          return true;
        } else {
          console.warn(`AudioIdentificationService: Failed to switch to ${newModelType}`);
          return false;
        }
      }
      
      return true; // Already using correct model
    } catch (error) {
      console.error('AudioIdentificationService: Model switch failed:', error);
      return false;
    }
  }

  static getCurrentModelType(): ModelType {
    return this.currentModelType;
  }
}