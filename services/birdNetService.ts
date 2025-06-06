// Bird identification service using local ML models only
// Uses FastTflite for audio classification and MLKit for image classification

import * as FileSystem from 'expo-file-system';
import { MLKitBirdClassifier, MLKitClassificationResult } from './mlkitBirdClassifier';
import { fastTfliteBirdClassifier, BirdClassificationResult } from './fastTfliteBirdClassifier';
import { AudioPreprocessingTFLite } from './audioPreprocessingTFLite';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BirdNetPrediction {
  common_name: string;
  scientific_name: string;
  confidence: number;
  timestamp_start?: number;
  timestamp_end?: number;
}

export interface BirdNetResponse {
  predictions: BirdNetPrediction[];
  processing_time: number;
  audio_duration: number;
  success: boolean;
  error?: string;
  source?: 'mlkit' | 'tflite' | 'cache' | 'offline';
  cache_hit?: boolean;
}

export interface BirdNetConfig {
  minConfidence?: number;
  enableCache?: boolean;
  cacheExpirationHours?: number;
  maxPredictions?: number;
}

export class BirdNetService {
  private static config: BirdNetConfig = {
    minConfidence: 0.1,
    enableCache: true,
    cacheExpirationHours: 24,
    maxPredictions: 5,
  };

  private static mlkitClassifier: MLKitBirdClassifier | null = null;
  private static tfliteInitialized = false;
  private static readonly CACHE_KEY_PREFIX = '@birdnet_cache:';

  static updateConfig(newConfig: Partial<BirdNetConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  // Set up MLKit model for bird classification
  static async initializeMLKit(): Promise<void> {
    try {
      this.mlkitClassifier = MLKitBirdClassifier.getInstance();
      console.log('BirdNetService: MLKit mode initialized');
    } catch (error) {
      console.error('BirdNetService: Failed to initialize MLKit mode:', error);
      // Continue without offline mode
    }
  }

  // Initialize FastTflite for audio classification
  static async initializeFastTflite(): Promise<void> {
    try {
      if (!this.tfliteInitialized) {
        await fastTfliteBirdClassifier.initialize();
        this.tfliteInitialized = true;
        console.log('BirdNetService: FastTflite mode initialized');
      }
    } catch (error) {
      console.error('BirdNetService: Failed to initialize FastTflite mode:', error);
      this.tfliteInitialized = false;
    }
  }

  // Initialize offline mode (both FastTflite and MLKit)
  static async initializeOfflineMode(): Promise<void> {
    try {
      console.log('BirdNetService: Initializing offline mode...');
      
      // Initialize FastTflite for audio classification
      await this.initializeFastTflite();
      
      // Initialize MLKit for image classification
      await this.initializeMLKit();
      
      console.log('BirdNetService: Offline mode initialized successfully');
    } catch (error) {
      console.error('BirdNetService: Failed to initialize offline mode:', error);
      throw error;
    }
  }

  // Cache management methods
  private static async getCachedResult(key: string): Promise<BirdNetResponse | null> {
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
  
  private static async setCachedResult(key: string, result: BirdNetResponse): Promise<void> {
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
    }
  ): Promise<BirdNetResponse> {
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
          console.log('BirdNetService: Using FastTflite classification for audio');
          
          // Preprocess audio to mel-spectrogram
          const processedAudio = await AudioPreprocessingTFLite.processAudioFile(audioUri);
          
          // Classify using FastTflite
          const tfliteResult = await fastTfliteBirdClassifier.classifyBirdAudio(
            processedAudio.melSpectrogram,
            audioUri
          );
          
          // Convert FastTflite result to BirdNet response format
          const response = this.convertFastTfliteResultToBirdNetResponse(
            tfliteResult.results,
            tfliteResult.metadata,
            processedAudio.metadata.duration
          );
          
          // Cache the result
          await this.setCachedResult(cacheKey, response);
          
          return response;
          
        } catch (tfliteError) {
          console.error('BirdNetService: FastTflite classification failed:', tfliteError);
          // Continue to MLKit fallback
        }
      }

      // Fallback to MLKit if FastTflite fails
      if (!this.mlkitClassifier) {
        await this.initializeMLKit();
      }

      if (this.mlkitClassifier) {
        try {
          console.log('BirdNetService: Using MLKit classification for audio (fallback)');
          // Note: MLKit is primarily for images, but some implementations support audio
          const mlkitResult = await this.mlkitClassifier.classifyBirdAudio(audioUri);
          
          // Cache the result
          await this.setCachedResult(cacheKey, mlkitResult);
          
          return mlkitResult;
        } catch (mlkitError) {
          console.error('BirdNetService: MLKit classification failed:', mlkitError);
        }
      }

      // If all local ML fails, return error
      throw new Error('Local bird classification failed. Please ensure ML models are properly initialized.');
      
    } catch (error) {
      console.error('BirdNet identification error:', error);
      throw error;
    }
  }

  // New method for image identification using MLKit
  static async identifyBirdFromImage(imageUri: string): Promise<BirdNetResponse> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) {
        throw new Error('Image file not found');
      }

      if (!this.mlkitClassifier) {
        await this.initializeMLKit();
      }

      if (this.mlkitClassifier) {
        try {
          console.log('BirdNetService: Using MLKit classification for image');
          const mlkitResult = await this.mlkitClassifier.classifyBirdImage(imageUri);
          
          return {
            predictions: mlkitResult.predictions,
            processing_time: mlkitResult.processingTime / 1000, // Convert to seconds
            audio_duration: 0, // Not applicable for images
            success: mlkitResult.predictions.length > 0,
            source: mlkitResult.source,
            fallback_used: mlkitResult.fallbackUsed,
            cache_hit: mlkitResult.cacheHit,
          };
        } catch (mlkitError) {
          console.error('BirdNetService: MLKit image classification failed:', mlkitError);
          throw mlkitError;
        }
      }

      throw new Error('MLKit classifier not available');
    } catch (error) {
      console.error('BirdNet image identification error:', error);
      throw error;
    }
  }

  // Convert MLKit result to standard response format
  private static convertMLKitResultToBirdNetResponse(
    mlkitResult: MLKitClassificationResult,
    isAudio: boolean = false
  ): BirdNetResponse {
    return {
      predictions: mlkitResult.predictions,
      processing_time: mlkitResult.processingTime / 1000, // Convert to seconds
      audio_duration: isAudio ? 3.0 : 0, // Default audio duration or 0 for images
      success: true,
      source: mlkitResult.source,
      fallback_used: mlkitResult.fallbackUsed,
      cache_hit: mlkitResult.cacheHit,
    };
  }

  // Convert FastTflite result to standard response format
  private static convertFastTfliteResultToBirdNetResponse(
    results: BirdClassificationResult[],
    metadata: any,
    audioDuration: number
  ): BirdNetResponse {
    const predictions: BirdNetPrediction[] = results
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

  static getBestPrediction(predictions: BirdNetPrediction[]): BirdNetPrediction | null {
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
      console.log(`BirdNetService: Cleared ${cacheKeys.length} cached results`);
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