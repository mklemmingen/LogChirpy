/**
 * Mock for fastTfliteBirdClassifier service
 * 
 * Provides realistic mock responses for model testing
 */

const MOCK_SPECIES = [
  { index: 0, common_name: 'American Robin', scientific_name: 'Turdus migratorius' },
  { index: 1, common_name: 'House Sparrow', scientific_name: 'Passer domesticus' },
  { index: 2, common_name: 'Northern Cardinal', scientific_name: 'Cardinalis cardinalis' },
  { index: 3, common_name: 'Blue Jay', scientific_name: 'Cyanocitta cristata' },
  { index: 4, common_name: 'Black-capped Chickadee', scientific_name: 'Poecile atricapillus' },
  { index: 5, common_name: 'Song Sparrow', scientific_name: 'Melospiza melodia' },
  { index: 6, common_name: 'Wood Thrush', scientific_name: 'Hylocichla mustelina' },
  { index: 7, common_name: 'American Goldfinch', scientific_name: 'Spinus tristis' },
  { index: 8, common_name: 'Red-winged Blackbird', scientific_name: 'Agelaius phoeniceus' },
  { index: 9, common_name: 'Common Grackle', scientific_name: 'Quiscalus quiscula' }
];

class MockFastTfliteBirdClassifier {
  constructor() {
    this.modelLoaded = false;
    this.currentModelType = null;
    this.performanceMetrics = {
      avgInferenceTime: 0,
      totalInferences: 0,
      memoryUsage: 0,
      modelSize: 49 * 1024 * 1024, // 49MB
      cacheHitRate: 0
    };
  }

  async switchModel(modelType) {
    this.currentModelType = modelType;
    this.modelLoaded = true;
    return true;
  }

  getCurrentModelType() {
    return this.currentModelType;
  }

  isReady() {
    return this.modelLoaded;
  }

  async classifyBirdAudio(spectrogramData, audioUri) {
    if (!this.modelLoaded) {
      throw new Error('Model not loaded. Call initialize() first.');
    }

    // Validate input
    if (!(spectrogramData instanceof Float32Array)) {
      throw new Error('Expected Float32Array input');
    }

    const expectedSize = 224 * 224 * 3;
    if (spectrogramData.length !== expectedSize) {
      throw new Error(`Invalid input size: expected ${expectedSize}, got ${spectrogramData.length}`);
    }

    // Simulate processing time
    const processingTime = 500 + Math.random() * 1000; // 0.5-1.5 seconds
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async processing

    // Generate mock results
    const numResults = 5 + Math.floor(Math.random() * 3); // 5-7 results
    const results = [];

    for (let i = 0; i < numResults && i < MOCK_SPECIES.length; i++) {
      const species = MOCK_SPECIES[i];
      const confidence = Math.max(0, 0.9 - i * 0.15 + (Math.random() - 0.5) * 0.1);
      
      results.push({
        species: species.common_name,
        scientificName: species.scientific_name,
        confidence: confidence,
        index: species.index
      });
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    // Update metrics
    this.performanceMetrics.totalInferences++;
    this.performanceMetrics.avgInferenceTime = 
      (this.performanceMetrics.avgInferenceTime * (this.performanceMetrics.totalInferences - 1) + processingTime) / 
      this.performanceMetrics.totalInferences;

    return {
      results,
      metadata: {
        modelVersion: '2.4',
        modelType: this.currentModelType,
        processingTime,
        modelSource: 'tflite',
        inputShape: [1, 224, 224, 3],
        timestamp: Date.now()
      }
    };
  }

  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  dispose() {
    this.modelLoaded = false;
    this.currentModelType = null;
  }

  clearCache() {
    // Mock cache clearing
  }

  updateConfig(newConfig) {
    // Mock config update
  }
}

// Create singleton instance
const fastTfliteBirdClassifier = new MockFastTfliteBirdClassifier();

module.exports = {
  fastTfliteBirdClassifier
};