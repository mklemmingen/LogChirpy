import * as FileSystem from 'expo-file-system';
import { fastTfliteBirdClassifier, BirdClassificationResult } from './fastTfliteBirdClassifier';
import { AudioPreprocessingTFLite } from './audioPreprocessingTFLite';
import { ModelType, ModelConfig } from './modelConfig';
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

  // Initialize audio processing
  static async initialize(modelType?: ModelType): Promise<void> {
    try {
      console.log('AudioIdentificationService: Initializing audio processing...');
      
      // Initialize FastTflite for audio classification
      await this.initializeFastTflite();
      
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
    try {
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        throw new Error('Audio file not found');
      }

      // Check cache first
      const cacheKey = `audio_${fileInfo.modificationTime}_${fileInfo.size}`;
      const cachedResult = await this.getCachedResult(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Initialize FastTflite for audio processing
      if (!this.tfliteInitialized) {
        await this.initializeFastTflite();
      }

      // Try FastTflite first for audio classification
      if (this.tfliteInitialized) {
        try {
          const modelType = options?.modelType || ModelType.BALANCED_FP16;
          console.log(`AudioIdentificationService: Using FastTflite classification for audio with ${ModelConfig.getModelInfo(modelType)}`);
          
          // Preprocess audio to mel-spectrogram
          const processedAudio = await AudioPreprocessingTFLite.processAudioFile(audioUri);
          
          // Classify using FastTflite with specified model
          const tfliteResult = await fastTfliteBirdClassifier.classifyBirdAudioWithModel(
            processedAudio.melSpectrogram,
            modelType,
            audioUri
          );
          
          // Convert FastTflite result to Audio response format
          const response = this.convertFastTfliteResultToAudioResponse(
            tfliteResult.results,
            tfliteResult.metadata,
            processedAudio.metadata.duration
          );
          
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
      console.error('Audio identification error:', error);
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
}