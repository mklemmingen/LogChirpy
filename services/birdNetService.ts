// Bird identification service with offline-first approach
// Uses local BirdNET model with online API fallback

import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import { OfflineBirdClassifier, OfflineClassificationResult } from './offlineBirdClassifier';

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
  source?: 'offline' | 'online' | 'cache' | 'mock';
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

  private static offlineClassifier: OfflineBirdClassifier | null = null;

  static updateConfig(newConfig: Partial<BirdNetConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  // Set up offline model for bird classification
  static async initializeOfflineMode(): Promise<void> {
    try {
      this.offlineClassifier = OfflineBirdClassifier.getInstance();
      await this.offlineClassifier.initialize();
      console.log('BirdNetService: Offline mode initialized');
    } catch (error) {
      console.error('BirdNetService: Failed to initialize offline mode:', error);
      // Continue without offline mode
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

      if (!this.offlineClassifier) {
        await this.initializeOfflineMode();
      }

      // Try offline first unless forced online
      if (this.offlineClassifier && !options?.forceOnline) {
        try {
          console.log('BirdNetService: Using offline classification');
          const offlineResult = await this.offlineClassifier.classifyBirdAudio(audioUri, {
            forceOffline: options?.forceOffline,
            forceOnline: options?.forceOnline,
          });

          return this.convertOfflineResultToBirdNetResponse(offlineResult, audioUri);
        } catch (offlineError) {
          console.error('BirdNetService: Offline classification failed:', offlineError);
          
          if (options?.forceOffline) {
            throw offlineError;
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
      mockResult.fallback_used = !!this.offlineClassifier;
      
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

  // Convert offline result to standard response format
  private static convertOfflineResultToBirdNetResponse(
    offlineResult: OfflineClassificationResult,
    audioUri: string
  ): BirdNetResponse {
    return {
      predictions: offlineResult.predictions,
      processing_time: offlineResult.processingTime / 1000, // Convert to seconds
      audio_duration: 3.0, // TODO: Calculate from actual audio file
      success: true,
      source: offlineResult.source,
      fallback_used: offlineResult.fallbackUsed,
      cache_hit: offlineResult.cacheHit,
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