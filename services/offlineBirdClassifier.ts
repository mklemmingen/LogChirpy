import { TensorFlowLiteModelService, TensorFlowLiteResult } from './tensorflowLiteModel';
import { AudioPreprocessingService } from './audioPreprocessing';
import { BirdNetPrediction, BirdNetResponse } from './birdNetService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OfflineClassificationConfig {
  enableOfflineMode: boolean;
  fallbackToOnline: boolean;
  cacheResults: boolean;
  maxCacheSize: number;
  confidenceThreshold: number;
  maxResults: number;
  enablePreprocessingCache: boolean;
}

export interface ClassificationCache {
  audioHash: string;
  predictions: BirdNetPrediction[];
  timestamp: number;
  processingTime: number;
}

export interface OfflineClassificationResult {
  predictions: BirdNetPrediction[];
  source: 'offline' | 'online' | 'cache';
  processingTime: number;
  modelMetadata?: {
    version: string;
    accuracy: number;
    supportedSpecies: number;
  };
  fallbackUsed: boolean;
  cacheHit: boolean;
}

export class OfflineBirdClassifier {
  private static instance: OfflineBirdClassifier | null = null;
  private modelService: TensorFlowLiteModelService;
  private cache: Map<string, ClassificationCache> = new Map();
  private isInitialized = false;

  private config: OfflineClassificationConfig = {
    enableOfflineMode: true,
    fallbackToOnline: true,
    cacheResults: true,
    maxCacheSize: 100, // Maximum cached results
    confidenceThreshold: 0.1,
    maxResults: 5,
    enablePreprocessingCache: true,
  };

  private constructor() {
    this.modelService = TensorFlowLiteModelService.getInstance();
    this.loadCacheFromStorage();
  }

  static getInstance(): OfflineBirdClassifier {
    if (!this.instance) {
      this.instance = new OfflineBirdClassifier();
    }
    return this.instance;
  }

  /**
   * Initialize the offline classifier
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Initializing offline bird classifier...');
      
      if (this.config.enableOfflineMode) {
        await this.modelService.initialize();
      }
      
      await this.loadCacheFromStorage();
      
      this.isInitialized = true;
      console.log('Offline bird classifier initialized successfully');
    } catch (error) {
      console.error('Failed to initialize offline classifier:', error);
      if (!this.config.fallbackToOnline) {
        throw error;
      }
      console.log('Continuing without offline model (fallback enabled)');
      this.isInitialized = true;
    }
  }

  /**
   * Main classification method that handles offline/online fallback
   */
  async classifyBirdAudio(
    audioUri: string,
    options?: {
      forceOffline?: boolean;
      forceOnline?: boolean;
      enableCache?: boolean;
    }
  ): Promise<OfflineClassificationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const audioHash = await this.generateAudioHash(audioUri);
    
    try {
      // Check cache first
      if (this.config.cacheResults && options?.enableCache !== false) {
        const cachedResult = this.getCachedResult(audioHash);
        if (cachedResult) {
          console.log('Using cached classification result');
          return {
            predictions: cachedResult.predictions,
            source: 'cache',
            processingTime: Date.now() - startTime,
            fallbackUsed: false,
            cacheHit: true,
          };
        }
      }

      // Try offline classification first
      if (this.config.enableOfflineMode && !options?.forceOnline) {
        try {
          console.log('Attempting offline classification...');
          const offlineResult = await this.classifyOffline(audioUri);
          
          // Cache the result
          if (this.config.cacheResults && offlineResult.predictions.length > 0) {
            this.cacheResult(audioHash, offlineResult.predictions, Date.now() - startTime);
          }
          
          return {
            predictions: offlineResult.predictions,
            source: 'offline',
            processingTime: offlineResult.processingTime,
            modelMetadata: {
              version: offlineResult.modelMetadata.version,
              accuracy: offlineResult.modelMetadata.accuracy,
              supportedSpecies: offlineResult.modelMetadata.supportedSpecies,
            },
            fallbackUsed: false,
            cacheHit: false,
          };
        } catch (offlineError) {
          console.error('Offline classification failed:', offlineError);
          
          if (!this.config.fallbackToOnline || options?.forceOffline) {
            throw offlineError;
          }
          
          console.log('Falling back to online classification...');
        }
      }

      // Fallback to online classification
      if (this.config.fallbackToOnline && !options?.forceOffline) {
        console.log('Using online classification...');
        const onlineResult = await this.classifyOnline(audioUri);
        
        // Cache the result
        if (this.config.cacheResults && onlineResult.predictions.length > 0) {
          this.cacheResult(audioHash, onlineResult.predictions, Date.now() - startTime);
        }
        
        return {
          predictions: onlineResult.predictions,
          source: 'online',
          processingTime: Date.now() - startTime,
          fallbackUsed: this.config.enableOfflineMode,
          cacheHit: false,
        };
      }

      throw new Error('No classification method available');
    } catch (error) {
      console.error('Classification error:', error);
      throw error;
    }
  }

  /**
   * Offline classification using TensorFlow Lite model
   */
  private async classifyOffline(audioUri: string): Promise<TensorFlowLiteResult> {
    try {
      const result = await this.modelService.classifyAudio(audioUri);
      
      // Filter results by confidence threshold
      const filteredPredictions = result.predictions.filter(
        p => p.confidence >= this.config.confidenceThreshold
      );
      
      return {
        ...result,
        predictions: filteredPredictions.slice(0, this.config.maxResults),
      };
    } catch (error) {
      throw new Error(`Offline classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Online classification fallback
   */
  private async classifyOnline(audioUri: string): Promise<BirdNetResponse> {
    // Import BirdNetService dynamically to avoid circular dependency
    const { BirdNetService } = await import('./birdNetService');
    
    try {
      const response = await BirdNetService.identifyBirdFromAudio(audioUri, {
        minConfidence: this.config.confidenceThreshold,
      });
      
      return response;
    } catch (error) {
      throw new Error(`Online classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a hash for audio file caching
   */
  private async generateAudioHash(audioUri: string): Promise<string> {
    // Simple hash based on file URI and timestamp
    const timestamp = Date.now().toString();
    const uriHash = audioUri.split('/').pop() || 'unknown';
    return `${uriHash}_${timestamp.slice(-6)}`;
  }

  /**
   * Cache classification result
   */
  private cacheResult(
    audioHash: string,
    predictions: BirdNetPrediction[],
    processingTime: number
  ): void {
    if (this.cache.size >= this.config.maxCacheSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const cacheEntry: ClassificationCache = {
      audioHash,
      predictions,
      timestamp: Date.now(),
      processingTime,
    };

    this.cache.set(audioHash, cacheEntry);
    this.saveCacheToStorage();
  }

  /**
   * Get cached classification result
   */
  private getCachedResult(audioHash: string): ClassificationCache | null {
    const result = this.cache.get(audioHash);
    
    if (result) {
      // Check if cache entry is still valid (e.g., not older than 24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - result.timestamp < maxAge) {
        return result;
      } else {
        // Remove expired entry
        this.cache.delete(audioHash);
        this.saveCacheToStorage();
      }
    }

    return null;
  }

  /**
   * Load cache from AsyncStorage
   */
  private async loadCacheFromStorage(): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem('bird_classification_cache');
      if (cacheData) {
        const parsed = JSON.parse(cacheData);
        this.cache = new Map(parsed);
        console.log(`Loaded ${this.cache.size} cached classification results`);
      }
    } catch (error) {
      console.error('Failed to load cache from storage:', error);
    }
  }

  /**
   * Save cache to AsyncStorage
   */
  private async saveCacheToStorage(): Promise<void> {
    try {
      const cacheData = JSON.stringify(Array.from(this.cache.entries()));
      await AsyncStorage.setItem('bird_classification_cache', cacheData);
    } catch (error) {
      console.error('Failed to save cache to storage:', error);
    }
  }

  /**
   * Clear classification cache
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    await AsyncStorage.removeItem('bird_classification_cache');
    console.log('Classification cache cleared');
  }

  /**
   * Get classification statistics
   */
  getStatistics(): {
    isInitialized: boolean;
    offlineAvailable: boolean;
    cacheSize: number;
    modelStatus: any;
    memoryUsage: any;
  } {
    return {
      isInitialized: this.isInitialized,
      offlineAvailable: this.config.enableOfflineMode && this.modelService.getStatus().isInitialized,
      cacheSize: this.cache.size,
      modelStatus: this.modelService.getStatus(),
      memoryUsage: this.modelService.getMemoryInfo(),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OfflineClassificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update model service config if needed
    if (newConfig.confidenceThreshold !== undefined || newConfig.maxResults !== undefined) {
      this.modelService.updateConfig({
        confidenceThreshold: this.config.confidenceThreshold,
        maxResults: this.config.maxResults,
      });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): OfflineClassificationConfig {
    return { ...this.config };
  }

  /**
   * Preload model for better performance
   */
  async preloadModel(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    console.log('Model preloaded successfully');
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.modelService.dispose();
    this.cache.clear();
    this.isInitialized = false;
    console.log('Offline bird classifier disposed');
  }

  /**
   * Test the classification pipeline with a sample
   */
  async testClassification(): Promise<{
    success: boolean;
    offlineWorking: boolean;
    onlineWorking: boolean;
    error?: string;
  }> {
    try {
      // This would use a test audio file in production
      const testAudioUri = 'test://sample.wav';
      
      let offlineWorking = false;
      let onlineWorking = false;

      // Test offline
      if (this.config.enableOfflineMode) {
        try {
          await this.classifyOffline(testAudioUri);
          offlineWorking = true;
        } catch (error) {
          console.log('Offline test failed:', error);
        }
      }

      // Test online
      if (this.config.fallbackToOnline) {
        try {
          await this.classifyOnline(testAudioUri);
          onlineWorking = true;
        } catch (error) {
          console.log('Online test failed:', error);
        }
      }

      return {
        success: offlineWorking || onlineWorking,
        offlineWorking,
        onlineWorking,
      };
    } catch (error) {
      return {
        success: false,
        offlineWorking: false,
        onlineWorking: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}