/**
 * Web Mock Implementation for FastTfliteBirdClassifier
 * 
 * Provides mock functionality for web builds where react-native-fast-tflite is not available.
 */

export interface BirdClassificationResult {
  species: string;
  scientificName: string;
  confidence: number;
  index: number;
}

export interface ClassificationMetadata {
  modelVersion: string;
  processingTime: number;
  modelSource: 'mock';
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

class FastTfliteBirdClassifierServiceWeb {
  private initialized = false;

  async initialize(): Promise<boolean> {
    console.log('FastTflite Web Mock: Initializing...');
    this.initialized = true;
    return true;
  }

  async classifyBirdAudio(
    spectrogramData: Float32Array,
    audioUri?: string
  ): Promise<{
    results: BirdClassificationResult[];
    metadata: ClassificationMetadata;
  }> {
    console.log('FastTflite Web Mock: Classifying audio...');
    
    // Mock results
    const results: BirdClassificationResult[] = [
      {
        species: 'American Robin',
        scientificName: 'Turdus migratorius',
        confidence: 0.85,
        index: 0
      },
      {
        species: 'House Sparrow',
        scientificName: 'Passer domesticus',
        confidence: 0.72,
        index: 1
      }
    ];

    const metadata: ClassificationMetadata = {
      modelVersion: '2.4-mock',
      processingTime: 1500,
      modelSource: 'mock',
      inputShape: [1, 224, 224, 3],
      timestamp: Date.now()
    };

    return { results, metadata };
  }

  getPerformanceMetrics(): ModelPerformanceMetrics {
    return {
      avgInferenceTime: 1500,
      totalInferences: 1,
      memoryUsage: 0,
      modelSize: 0,
      cacheHitRate: 0
    };
  }

  updateConfig(): void {
    console.log('FastTflite Web Mock: Config updated');
  }

  clearCache(): void {
    console.log('FastTflite Web Mock: Cache cleared');
  }

  dispose(): void {
    this.initialized = false;
    console.log('FastTflite Web Mock: Disposed');
  }

  isReady(): boolean {
    return this.initialized;
  }
}

export const fastTfliteBirdClassifier = new FastTfliteBirdClassifierServiceWeb();

export const initializeFastTflite = () => fastTfliteBirdClassifier.initialize();
export const classifyBirdWithFastTflite = (
  spectrogramData: Float32Array,
  audioUri?: string
) => fastTfliteBirdClassifier.classifyBirdAudio(spectrogramData, audioUri);
export const getFastTfliteMetrics = () => fastTfliteBirdClassifier.getPerformanceMetrics();