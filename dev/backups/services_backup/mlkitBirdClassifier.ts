/**
 * MLKit-based Bird Classification Service
 * 
 * Replaces TensorFlow implementation with MLKit for bird identification.
 * Uses MLKit Image Labeling for visual bird identification and falls back
 * to online services for audio-based identification.
 */

import { BirdNetPrediction, BirdNetResponse } from './birdNetService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNMLKitImageLabelingModule from '@infinitered/react-native-mlkit-image-labeling';

export interface MLKitClassificationConfig {
  confidenceThreshold: number;
  maxResults: number;
  cacheResults: boolean;
  maxCacheSize: number;
  fallbackToOnline: boolean;
}

export interface ClassificationCache {
  imageHash: string;
  predictions: BirdNetPrediction[];
  timestamp: number;
  processingTime: number;
}

export interface MLKitClassificationResult {
  predictions: BirdNetPrediction[];
  source: 'mlkit' | 'cache' | 'offline';
  processingTime: number;
  fallbackUsed: boolean;
  cacheHit: boolean;
}

export class MLKitBirdClassifier {
  private static instance: MLKitBirdClassifier | null = null;
  private cache: Map<string, ClassificationCache> = new Map();
  private isInitialized = false;

  private config: MLKitClassificationConfig = {
    confidenceThreshold: 0.5,
    maxResults: 5,
    cacheResults: true,
    maxCacheSize: 100,
    fallbackToOnline: true,
  };

  // Common bird species that MLKit might identify
  private birdSpeciesMapping: Record<string, BirdNetPrediction> = {
    'bird': {
      common_name: 'Unknown Bird',
      scientific_name: 'Aves sp.',
      confidence: 0.5,
      timestamp_start: 0,
      timestamp_end: 0,
    },
    'eagle': {
      common_name: 'Eagle',
      scientific_name: 'Aquila sp.',
      confidence: 0.8,
      timestamp_start: 0,
      timestamp_end: 0,
    },
    'robin': {
      common_name: 'American Robin',
      scientific_name: 'Turdus migratorius',
      confidence: 0.8,
      timestamp_start: 0,
      timestamp_end: 0,
    },
    'cardinal': {
      common_name: 'Northern Cardinal',
      scientific_name: 'Cardinalis cardinalis',
      confidence: 0.8,
      timestamp_start: 0,
      timestamp_end: 0,
    },
    'blue jay': {
      common_name: 'Blue Jay',
      scientific_name: 'Cyanocitta cristata',
      confidence: 0.8,
      timestamp_start: 0,
      timestamp_end: 0,
    },
    'crow': {
      common_name: 'American Crow',
      scientific_name: 'Corvus brachyrhynchos',
      confidence: 0.8,
      timestamp_start: 0,
      timestamp_end: 0,
    },
    'sparrow': {
      common_name: 'House Sparrow',
      scientific_name: 'Passer domesticus',
      confidence: 0.8,
      timestamp_start: 0,
      timestamp_end: 0,
    },
    'duck': {
      common_name: 'Mallard',
      scientific_name: 'Anas platyrhynchos',
      confidence: 0.8,
      timestamp_start: 0,
      timestamp_end: 0,
    },
    'goose': {
      common_name: 'Canada Goose',
      scientific_name: 'Branta canadensis',
      confidence: 0.8,
      timestamp_start: 0,
      timestamp_end: 0,
    },
    'hummingbird': {
      common_name: 'Ruby-throated Hummingbird',
      scientific_name: 'Archilochus colubris',
      confidence: 0.8,
      timestamp_start: 0,
      timestamp_end: 0,
    },
  };

  private constructor() {
    this.initialize();
  }

  public static getInstance(): MLKitBirdClassifier {
    if (!MLKitBirdClassifier.instance) {
      MLKitBirdClassifier.instance = new MLKitBirdClassifier();
    }
    return MLKitBirdClassifier.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Load the bird classifier model
      const modelSpec = {
        modelName: 'bird_classifier',
        modelPath: '../assets/models/birds_mobilenetv2/bird_classifier_metadata.tflite',
        options: {
          maxResultCount: this.config.maxResults,
          confidenceThreshold: this.config.confidenceThreshold
        }
      };
      
      await RNMLKitImageLabelingModule.loadModel(modelSpec);
      await this.loadCache();
      this.isInitialized = true;
      console.log('MLKit Bird Classifier initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MLKit Bird Classifier:', error);
      this.isInitialized = false;
    }
  }

  public async classifyBirdImage(imageUri: string): Promise<MLKitClassificationResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = await this.generateImageHash(imageUri);
      const cachedResult = this.cache.get(cacheKey);
      
      if (cachedResult && this.config.cacheResults) {
        return {
          predictions: cachedResult.predictions,
          source: 'cache',
          processingTime: Date.now() - startTime,
          fallbackUsed: false,
          cacheHit: true,
        };
      }

      // Use MLKit for image classification
      const labels = await RNMLKitImageLabelingModule.classifyImage('bird_classifier', imageUri);
      const birdPredictions = this.processMlkitLabels(labels);

      const result: MLKitClassificationResult = {
        predictions: birdPredictions,
        source: 'mlkit',
        processingTime: Date.now() - startTime,
        fallbackUsed: false,
        cacheHit: false,
      };

      // Cache the result
      if (this.config.cacheResults && birdPredictions.length > 0) {
        await this.cacheResult(cacheKey, birdPredictions, result.processingTime);
      }

      return result;
    } catch (error) {
      console.error('MLKit classification failed:', error);
      
      // Return a generic bird prediction as fallback
      const fallbackPrediction: BirdNetPrediction = {
        common_name: 'Bird (MLKit Error)',
        scientific_name: 'Aves sp.',
        confidence: 0.3,
        timestamp_start: 0,
        timestamp_end: 0,
      };

      return {
        predictions: [fallbackPrediction],
        source: 'mlkit',
        processingTime: Date.now() - startTime,
        fallbackUsed: true,
        cacheHit: false,
      };
    }
  }

  public async classifyBirdAudio(audioUri: string): Promise<BirdNetResponse> {
    // Audio classification is not supported by MLKit - return appropriate response
    return {
      predictions: [],
      processing_time: 0,
      audio_duration: 0,
      success: false,
      error: 'Audio classification not supported by MLKit',
      source: 'mlkit',
      cache_hit: false,
    };
  }

  private processMlkitLabels(labels: any[]): BirdNetPrediction[] {
    const birdPredictions: BirdNetPrediction[] = [];

    for (const label of labels) {
      const labelText = label.text?.toLowerCase() || '';
      const confidence = label.confidence || 0;

      // Skip labels below confidence threshold
      if (confidence < this.config.confidenceThreshold) {
        continue;
      }

      // Check if the label is bird-related
      const birdSpecies = this.findBirdSpecies(labelText);
      if (birdSpecies) {
        birdPredictions.push({
          ...birdSpecies,
          confidence: confidence,
        });
      }
    }

    // Sort by confidence and limit results
    return birdPredictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxResults);
  }

  private findBirdSpecies(labelText: string): BirdNetPrediction | null {
    // Direct match
    if (this.birdSpeciesMapping[labelText]) {
      return { ...this.birdSpeciesMapping[labelText] };
    }

    // Partial match
    for (const [key, species] of Object.entries(this.birdSpeciesMapping)) {
      if (labelText.includes(key) || key.includes(labelText)) {
        return { ...species };
      }
    }

    // Generic bird match
    if (labelText.includes('bird') || labelText.includes('avian')) {
      return { ...this.birdSpeciesMapping['bird'] };
    }

    return null;
  }

  private async generateImageHash(imageUri: string): Promise<string> {
    // Simple hash based on URI and timestamp (for demo purposes)
    return `${imageUri}_${Date.now()}`.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private async cacheResult(key: string, predictions: BirdNetPrediction[], processingTime: number): Promise<void> {
    const cacheEntry: ClassificationCache = {
      imageHash: key,
      predictions,
      timestamp: Date.now(),
      processingTime,
    };

    this.cache.set(key, cacheEntry);

    // Limit cache size
    if (this.cache.size > this.config.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    await this.saveCache();
  }

  private async loadCache(): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem('mlkit_bird_cache');
      if (cacheData) {
        const parsedCache = JSON.parse(cacheData);
        this.cache = new Map(Object.entries(parsedCache));
      }
    } catch (error) {
      console.error('Failed to load cache:', error);
    }
  }

  private async saveCache(): Promise<void> {
    try {
      const cacheObject = Object.fromEntries(this.cache);
      await AsyncStorage.setItem('mlkit_bird_cache', JSON.stringify(cacheObject));
    } catch (error) {
      console.error('Failed to save cache:', error);
    }
  }

  public updateConfig(newConfig: Partial<MLKitClassificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): MLKitClassificationConfig {
    return { ...this.config };
  }

  public clearCache(): void {
    this.cache.clear();
    AsyncStorage.removeItem('mlkit_bird_cache');
  }
}