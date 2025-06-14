/**
 * Mock for react-native-fast-tflite
 * 
 * This mock simulates the TensorFlow Lite model behavior for testing
 * without requiring actual model files or native implementations
 */

// Mock species data for realistic testing
const MOCK_SPECIES = [
  { index: 0, common: 'American Robin', scientific: 'Turdus migratorius' },
  { index: 1, common: 'House Sparrow', scientific: 'Passer domesticus' },
  { index: 2, common: 'Northern Cardinal', scientific: 'Cardinalis cardinalis' },
  { index: 3, common: 'Blue Jay', scientific: 'Cyanocitta cristata' },
  { index: 4, common: 'Black-capped Chickadee', scientific: 'Poecile atricapillus' },
  { index: 5, common: 'Song Sparrow', scientific: 'Melospiza melodia' },
  { index: 6, common: 'Wood Thrush', scientific: 'Hylocichla mustelina' },
  { index: 7, common: 'American Goldfinch', scientific: 'Spinus tristis' },
  { index: 8, common: 'Red-winged Blackbird', scientific: 'Agelaius phoeniceus' },
  { index: 9, common: 'Common Grackle', scientific: 'Quiscalus quiscula' }
];

// Mock TensorFlow model class
class MockTensorflowModel {
  constructor(modelPath, delegate) {
    this.modelPath = modelPath;
    this.delegate = delegate;
    this.inputs = [{
      name: 'input',
      dataType: 'float32',
      shape: [1, 224, 224, 3] // Mock BirdNet input shape
    }];
    this.outputs = [{
      name: 'output',
      dataType: 'float32',
      shape: [6522] // Mock 6522 species output
    }];
  }

  // Synchronous inference method
  runSync(inputs) {
    const inputData = inputs[0];
    
    // Validate input
    if (!inputData || !(inputData instanceof Float32Array)) {
      throw new Error('Invalid input: expected Float32Array');
    }
    
    // Check input size
    const expectedSize = 224 * 224 * 3; // 150,528 elements
    if (inputData.length !== expectedSize) {
      throw new Error(`Invalid input size: expected ${expectedSize}, got ${inputData.length}`);
    }
    
    // Generate mock predictions (6522 classes)
    const outputSize = 6522;
    const mockOutput = new Float32Array(outputSize);
    
    // Generate realistic mock predictions
    // Higher confidence for first few classes, lower for rest
    for (let i = 0; i < outputSize; i++) {
      if (i < 10) {
        // Top 10 predictions with higher confidence
        mockOutput[i] = Math.random() * 0.8 + 0.1; // 0.1 - 0.9
      } else if (i < 100) {
        // Next 90 with medium confidence
        mockOutput[i] = Math.random() * 0.3 + 0.05; // 0.05 - 0.35
      } else {
        // Rest with low confidence
        mockOutput[i] = Math.random() * 0.1; // 0.0 - 0.1
      }
    }
    
    // Sort to make it more realistic (highest confidence first)
    const indexed = Array.from(mockOutput).map((val, idx) => ({val, idx}));
    indexed.sort((a, b) => b.val - a.val);
    
    // Rebuild sorted array
    for (let i = 0; i < outputSize; i++) {
      mockOutput[i] = indexed[i].val;
    }
    
    return [mockOutput];
  }

  // Async inference method (calls sync internally)
  async run(inputs) {
    return this.runSync(inputs);
  }
}

// Mock delegate types
const TensorflowModelDelegate = {
  'android-gpu': 'android-gpu',
  'core-ml': 'core-ml',
  'default': 'default'
};

// Mock model loading function
const loadTensorflowModel = jest.fn().mockImplementation((modelPath, delegate = 'default') => {
  // Simulate loading delay
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (modelPath && modelPath.includes('mock')) {
        // Successful loading for mock paths
        resolve(new MockTensorflowModel(modelPath, delegate));
      } else {
        // Simulate model loading failure for invalid paths
        reject(new Error(`Failed to load model: ${modelPath}`));
      }
    }, 100); // 100ms delay to simulate loading
  });
});

// Export the mock
module.exports = {
  loadTensorflowModel,
  TensorflowModelDelegate,
  MockTensorflowModel // Export for testing
};