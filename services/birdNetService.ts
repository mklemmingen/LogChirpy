// Bird identification service with MLKit and online API fallback
// Uses MLKit for image classification and online services for audio

import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import { MLKitBirdClassifier, MLKitClassificationResult } from './mlkitBirdClassifier';
import { fastTfliteBirdClassifier, BirdClassificationResult } from './fastTfliteBirdClassifier';
import { AudioPreprocessingTFLite } from './audioPreprocessingTFLite';

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
  source?: 'mlkit' | 'tflite' | 'online' | 'cache' | 'mock';
  fallback_used?: boolean;
  cache_hit?: boolean;
}

export interface BirdNetConfig {
  apiUrl: string;
  minConfidence?: number;
  latitude?: number;
  longitude?: number;
  week?: number;
}

export class BirdNetService {
  private static config: BirdNetConfig = {
    apiUrl: 'https://your-birdnet-api.com/v1/predict', // Replace with real API
    minConfidence: 0.1,
  };

  private static mlkitClassifier: MLKitBirdClassifier | null = null;
  private static tfliteInitialized = false;

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

  static async checkNetworkConnection(): Promise<boolean> {
    try {
      const networkState = await NetInfo.fetch();
      return networkState.isConnected === true && networkState.isInternetReachable === true;
    } catch (error) {
      console.error('Network check failed:', error);
      return false;
    }
  }

  static async identifyBirdFromAudio(
    audioUri: string,
    options?: {
      latitude?: number;
      longitude?: number;
      minConfidence?: number;
      forceOffline?: boolean;
      forceOnline?: boolean;
    }
  ): Promise<BirdNetResponse> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        throw new Error('Audio file not found');
      }

      // Initialize FastTflite for audio processing
      if (!this.tfliteInitialized) {
        await this.initializeFastTflite();
      }

      // Try FastTflite first for audio classification
      if (this.tfliteInitialized && !options?.forceOnline) {
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
          
          return response;
          
        } catch (tfliteError) {
          console.error('BirdNetService: FastTflite classification failed:', tfliteError);
          
          if (options?.forceOffline) {
            throw tfliteError;
          }
          
          console.log('BirdNetService: Falling back to MLKit/online classification');
        }
      }

      // Fallback to MLKit if FastTflite fails
      if (!this.mlkitClassifier) {
        await this.initializeMLKit();
      }

      if (this.mlkitClassifier && !options?.forceOnline) {
        try {
          console.log('BirdNetService: Using MLKit classification for audio (fallback)');
          const mlkitResult = await this.mlkitClassifier.classifyBirdAudio(audioUri);
          return mlkitResult;
        } catch (mlkitError) {
          console.error('BirdNetService: MLKit classification failed:', mlkitError);
          
          if (options?.forceOffline) {
            throw mlkitError;
          }
          
          console.log('BirdNetService: Falling back to online classification');
        }
      }

      console.log('BirdNetService: Using online classification');
      
      const isConnected = await this.checkNetworkConnection();
      if (!isConnected && !options?.forceOffline) {
        throw new Error('No internet connection available for online classification');
      }

      // Mock response for now - replace with real API
      const mockResult = await this.mockBirdNetResponse(audioUri, options);
      mockResult.source = 'mock';
      mockResult.fallback_used = !!this.mlkitClassifier;
      
      return mockResult;
      
      // TODO: Real API implementation:
      /*
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/wav',
        name: 'bird_audio.wav',
      } as any);
      
      if (options?.latitude && options?.longitude) {
        formData.append('lat', options.latitude.toString());
        formData.append('lon', options.longitude.toString());
      }
      
      formData.append('min_conf', (options?.minConfidence || this.config.minConfidence).toString());
      
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const result = await response.json();
      result.source = 'online';
      result.fallback_used = !!this.offlineClassifier;
      return result as BirdNetResponse;
      */
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
    const predictions: BirdNetPrediction[] = results.map(result => ({
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
      source: metadata.modelSource,
      fallback_used: false,
      cache_hit: metadata.modelSource === 'cache',
    };
  }

  // Mock API response for testing
  private static async mockBirdNetResponse(
    audioUri: string,
    options?: { latitude?: number; longitude?: number; minConfidence?: number }
  ): Promise<BirdNetResponse> {
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

    // Mock common bird predictions
    const mockPredictions: BirdNetPrediction[] = [
      {
        common_name: 'American Robin',
        scientific_name: 'Turdus migratorius',
        confidence: 0.85,
        timestamp_start: 0.5,
        timestamp_end: 3.2,
      },
      {
        common_name: 'House Sparrow',
        scientific_name: 'Passer domesticus',
        confidence: 0.72,
        timestamp_start: 1.8,
        timestamp_end: 4.1,
      },
      {
        common_name: 'Blue Jay',
        scientific_name: 'Cyanocitta cristata',
        confidence: 0.45,
        timestamp_start: 2.3,
        timestamp_end: 5.0,
      },
    ];

    // Filter by minimum confidence
    const minConf = options?.minConfidence || this.config.minConfidence || 0.1;
    const filteredPredictions = mockPredictions.filter(p => p.confidence >= minConf);

    // Simulate some randomness - sometimes return fewer results
    const shouldReturnResults = Math.random() > 0.2; // 80% chance of success
    
    if (!shouldReturnResults) {
      return {
        predictions: [],
        processing_time: 2.5,
        audio_duration: 5.0,
        success: true,
        error: 'No bird sounds detected with sufficient confidence',
      };
    }

    // Randomly select 1-3 predictions
    const numResults = Math.floor(Math.random() * Math.min(3, filteredPredictions.length)) + 1;
    const selectedPredictions = filteredPredictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, numResults);

    return {
      predictions: selectedPredictions,
      processing_time: 2.5 + Math.random() * 2,
      audio_duration: 5.0,
      success: true,
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
}

// Configuration helper for different deployment scenarios
export const BirdNetConfigs = {
  // Local development with mock data
  development: {
    apiUrl: 'mock://birdnet',
    minConfidence: 0.1,
  },
  
  // Self-hosted BirdNET instance
  selfHosted: (baseUrl: string) => ({
    apiUrl: `${baseUrl}/api/v1/predict`,
    minConfidence: 0.15,
  }),
  
  // Cornell's demo endpoint (if available)
  cornell: {
    apiUrl: 'https://birdnet.cornell.edu/api/predict',
    minConfidence: 0.2,
  },
};