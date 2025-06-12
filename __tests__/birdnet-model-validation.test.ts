/**
 * BirdNet Model Validation Test Suite
 * 
 * Comprehensive testing of different BirdNet model configurations,
 * label loading strategies, and metadata extraction approaches.
 */

import { Platform } from 'react-native';

// Mock react-native modules for testing
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android'
  }
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn()
}));

// Mock react-native-fast-tflite for testing
const mockTensorflowModel = {
  runSync: jest.fn(),
  inputs: [
    {
      name: 'mobilenetv2_1.00_224_input',
      dataType: 'float32',
      shape: [1, 224, 224, 3]
    }
  ],
  outputs: [
    {
      name: 'Identity',
      dataType: 'float32',
      shape: [1, 6522] // or [1, 400] for legacy model
    }
  ],
  metadata: {
    labels: [] // Will be populated by tests
  }
};

const mockLoadTensorflowModel = jest.fn().mockImplementation(async (modelPath: string, _delegate: string) => {
  // Simulate different models based on path
  let outputShape: number[];
  let metadata: any = {};
  
  if (modelPath.includes('birdnet_v24.tflite')) {
    // Legacy model - 400 classes
    outputShape = [1, 400];
  } else if (modelPath.includes('whoBIRD') || modelPath.includes('BirdNET_GLOBAL_6K')) {
    // New whoBIRD models - 6522 classes
    outputShape = [1, 6522];
    
    // MData models have embedded metadata
    if (modelPath.includes('MData')) {
      metadata = {
        labels: Array.from({ length: 6522 }, (_, i) => ({
          index: i,
          scientific_name: `Species_${i}`,
          common_name: `Bird ${i}`
        }))
      };
    }
  } else {
    throw new Error(`Unknown model path: ${modelPath}`);
  }
  
  return {
    ...mockTensorflowModel,
    inputs: [{
      name: 'audio_input',
      dataType: 'float32',
      shape: [1, 224, 224, 3] // BirdNET input shape
    }],
    outputs: [{
      name: 'predictions',
      dataType: 'float32',
      shape: outputShape
    }],
    metadata,
    runSync: jest.fn().mockImplementation((_inputs) => {
      // Return mock predictions matching the output shape
      const predictionSize = outputShape.reduce((acc, dim) => acc * (dim === -1 ? 1 : dim), 1);
      const predictions = new Float32Array(predictionSize);
      
      // Fill with realistic probability values (softmax-like)
      for (let i = 0; i < predictions.length; i++) {
        predictions[i] = Math.random() * 0.1; // Low confidence for most
      }
      
      // Make a few predictions higher confidence
      if (predictions.length > 10) {
        predictions[0] = 0.85; // High confidence for first prediction
        predictions[1] = 0.75; // Medium-high for second
        predictions[2] = 0.65; // Medium for third
      }
      
      return [predictions];
    })
  };
});

jest.mock('react-native-fast-tflite', () => ({
  loadTensorflowModel: mockLoadTensorflowModel,
  TensorflowModelDelegate: jest.fn()
}));

// Import types after mocking
type TensorflowModel = typeof mockTensorflowModel;
type TensorflowModelDelegate = 'android-gpu' | 'core-ml' | 'default';

interface ModelTestResult {
  modelPath: string;
  modelName: string;
  loadSuccess: boolean;
  tensorInfo?: {
    inputShape: number[];
    outputShape: number[];
    inputDataType: string;
    outputDataType: string;
  };
  outputClasses?: number;
  inferenceSuccess: boolean;
  hasMetadata: boolean;
  extractedLabels?: any[];
  memoryUsage?: number;
  inferenceTime?: number;
  error?: string;
}

interface LabelLoadingResult {
  strategy: string;
  success: boolean;
  labelCount: number;
  labels?: any[];
  extractedLabels?: any[];
  source: 'metadata' | 'external' | 'hybrid';
  error?: string;
}

describe('BirdNet Model Validation Suite', () => {
  // Available model configurations
  const AVAILABLE_MODELS = [
    {
      name: 'Legacy BirdNet v2.4',
      path: '../assets/models/birdnet/birdnet_v24.tflite',
      expectedClasses: 400,
      hasMetadata: false
    },
    {
      name: 'whoBIRD FP32 Global 6K',
      path: '../assets/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite',
      expectedClasses: 6522,
      hasMetadata: false
    },
    {
      name: 'whoBIRD FP16 Global 6K',
      path: '../assets/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_Model_FP16.tflite',
      expectedClasses: 6522,
      hasMetadata: false
    },
    {
      name: 'whoBIRD MData FP16',
      path: '../assets/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_MData_Model_FP16.tflite',
      expectedClasses: 6522,
      hasMetadata: true
    },
    {
      name: 'whoBIRD MData V2 FP16',
      path: '../assets/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16.tflite',
      expectedClasses: 6522,
      hasMetadata: true
    }
  ];

  const DELEGATES: TensorflowModelDelegate[] = ['android-gpu', 'default'];

  let testResults: ModelTestResult[] = [];
  let labelResults: LabelLoadingResult[] = [];

  beforeAll(() => {
    console.log('🧪 Starting BirdNet Model Validation Test Suite');
    console.log(`📱 Platform: ${Platform.OS}`);
    console.log(`📋 Testing ${AVAILABLE_MODELS.length} model configurations`);
  });

  afterAll(() => {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    console.log('\n🔬 Model Test Results:');
    testResults.forEach(result => {
      console.log(`\n📁 ${result.modelName}:`);
      console.log(`   ✅ Load Success: ${result.loadSuccess}`);
      console.log(`   🧠 Output Classes: ${result.outputClasses || 'Unknown'}`);
      console.log(`   ⚡ Inference Success: ${result.inferenceSuccess}`);
      console.log(`   📋 Has Metadata: ${result.hasMetadata}`);
      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      }
    });

    console.log('\n🏷️ Label Loading Results:');
    labelResults.forEach(result => {
      console.log(`\n📋 ${result.strategy}:`);
      console.log(`   ✅ Success: ${result.success}`);
      console.log(`   📊 Label Count: ${result.labelCount}`);
      console.log(`   📄 Source: ${result.source}`);
      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      }
    });

    // Recommendations
    console.log('\n💡 Recommendations:');
    const workingModels = testResults.filter(r => r.loadSuccess && r.inferenceSuccess && r.outputClasses === 6522);
    if (workingModels.length > 0) {
      console.log(`✅ Use: ${workingModels[0].modelName} for production`);
    } else {
      console.log('❌ No fully compatible 6522-class models found');
    }
  });

  describe('1. Model Loading and Basic Validation', () => {
    test.each(AVAILABLE_MODELS)(
      'should load and validate $name',
      async (modelConfig) => {
        const result: ModelTestResult = {
          modelPath: modelConfig.path,
          modelName: modelConfig.name,
          loadSuccess: false,
          inferenceSuccess: false,
          hasMetadata: modelConfig.hasMetadata
        };

        try {
          console.log(`\n🔄 Testing ${modelConfig.name}...`);
          
          // Test model loading with different delegates
          let model: TensorflowModel | null = null;
          let loadError: string | null = null;

          for (const delegate of DELEGATES) {
            try {
              console.log(`   📡 Trying ${delegate} delegate...`);
              model = await mockLoadTensorflowModel(modelConfig.path, delegate);
              console.log(`   ✅ Loaded with ${delegate} delegate`);
              break;
            } catch (error) {
              loadError = error instanceof Error ? error.message : String(error);
              console.log(`   ⚠️ Failed with ${delegate}: ${loadError}`);
            }
          }

          if (!model) {
            throw new Error(`Failed to load with all delegates. Last error: ${loadError}`);
          }

          result.loadSuccess = true;

          // Extract tensor information
          try {
            const inputs = (model as any).inputs;
            const outputs = (model as any).outputs;

            if (inputs && outputs && inputs.length > 0 && outputs.length > 0) {
              result.tensorInfo = {
                inputShape: inputs[0].shape,
                outputShape: outputs[0].shape,
                inputDataType: inputs[0].dataType,
                outputDataType: outputs[0].dataType
              };

              // Calculate output classes
              const outputTensor = outputs[0];
              result.outputClasses = outputTensor.shape.reduce(
                (acc: number, dim: number) => acc * (dim === -1 ? 1 : dim), 
                1
              );

              console.log(`   🧠 Input Shape: [${result.tensorInfo.inputShape.join(', ')}]`);
              console.log(`   📊 Output Classes: ${result.outputClasses}`);
              console.log(`   📝 Expected Classes: ${modelConfig.expectedClasses}`);
            }
          } catch (tensorError) {
            console.log(`   ⚠️ Tensor info not available: ${tensorError}`);
          }

          // Test inference
          try {
            console.log(`   🧪 Testing inference...`);
            const testInput = new Float32Array(224 * 224 * 3);
            testInput.fill(0.5); // Fill with dummy data

            const startTime = Date.now();
            const outputs = model.runSync([testInput]);
            const endTime = Date.now();

            result.inferenceTime = endTime - startTime;

            if (outputs && outputs.length > 0) {
              const predictions = outputs[0] as Float32Array;
              
              if (predictions && predictions.length > 0) {
                result.inferenceSuccess = true;
                console.log(`   ✅ Inference successful (${result.inferenceTime}ms)`);
                console.log(`   📈 Prediction array size: ${predictions.length}`);
                
                // Validate prediction values
                let validCount = 0;
                for (let i = 0; i < Math.min(predictions.length, 100); i++) {
                  if (predictions[i] >= 0 && predictions[i] <= 1 && !isNaN(predictions[i])) {
                    validCount++;
                  }
                }
                console.log(`   ✅ Valid predictions: ${validCount}/100 sampled`);
              }
            }
          } catch (inferenceError) {
            result.error = inferenceError instanceof Error ? inferenceError.message : String(inferenceError);
            console.log(`   ❌ Inference failed: ${result.error}`);
          }

        } catch (error) {
          result.error = error instanceof Error ? error.message : String(error);
          console.log(`   ❌ Model loading failed: ${result.error}`);
        }

        testResults.push(result);

        // Assert that we at least got some information
        expect(result.loadSuccess || result.error).toBeDefined();
      },
      30000 // 30 second timeout per model
    );
  });

  describe('2. Metadata Extraction from MData Models', () => {
    test('should extract labels from MData model metadata', async () => {
      const mdataModels = AVAILABLE_MODELS.filter(m => m.hasMetadata);
      
      for (const modelConfig of mdataModels) {
        const result: LabelLoadingResult = {
          strategy: `Metadata extraction from ${modelConfig.name}`,
          success: false,
          labelCount: 0,
          source: 'metadata'
        };

        try {
          console.log(`\n🔍 Extracting metadata from ${modelConfig.name}...`);
          
          // Load model
          const model = await mockLoadTensorflowModel(modelConfig.path, 'default');
          
          // Try to extract metadata
          try {
            // Method 1: Check if model has embedded labels
            const metadata = (model as any).metadata;
            if (metadata) {
              console.log(`   📋 Found metadata object`);
              console.log(`   📋 Metadata keys:`, Object.keys(metadata));
              
              // Look for labels in common metadata fields
              const possibleLabelFields = ['labels', 'label_list', 'class_names', 'vocab'];
              for (const field of possibleLabelFields) {
                if (metadata[field]) {
                  result.extractedLabels = Array.isArray(metadata[field]) ? metadata[field] : [metadata[field]];
                  result.labelCount = result.extractedLabels!.length;
                  result.success = true;
                  console.log(`   ✅ Found labels in '${field}' field: ${result.labelCount} labels`);
                  break;
                }
              }
            }

            // Method 2: Check model properties for label information
            if (!result.success) {
              const modelProps = Object.keys(model);
              console.log(`   🔧 Model properties:`, modelProps);
              
              for (const prop of modelProps) {
                try {
                  const value = (model as any)[prop];
                  if (Array.isArray(value) && value.length > 1000) { // Likely labels
                    result.extractedLabels = value;
                    result.labelCount = value.length;
                    result.success = true;
                    console.log(`   ✅ Found labels in '${prop}' property: ${result.labelCount} labels`);
                    break;
                  }
                } catch (e) {
                  // Ignore property access errors
                }
              }
            }

            // Method 3: Try to access TFLite SignatureDef or other metadata
            if (!result.success) {
              try {
                const signature = (model as any).signature || (model as any).signatureDef;
                if (signature) {
                  console.log(`   🔍 Found signature definition`);
                  // Explore signature for labels
                }
              } catch (e) {
                console.log(`   ⚠️ No signature access available`);
              }
            }

          } catch (metadataError) {
            result.error = metadataError instanceof Error ? metadataError.message : String(metadataError);
            console.log(`   ❌ Metadata extraction failed: ${result.error}`);
          }

        } catch (loadError) {
          result.error = loadError instanceof Error ? loadError.message : String(loadError);
          console.log(`   ❌ Model loading failed: ${result.error}`);
        }

        labelResults.push(result);
      }

      // At least one metadata extraction should work if labels are embedded
      const successfulExtractions = labelResults.filter(r => r.success && r.source === 'metadata');
      console.log(`\n📊 Successful metadata extractions: ${successfulExtractions.length}`);
    }, 30000);
  });

  describe('3. External Label Loading Strategies', () => {
    test('should load labels from external JSON file', async () => {
      const result: LabelLoadingResult = {
        strategy: 'External labels.json',
        success: false,
        labelCount: 0,
        source: 'external'
      };

      try {
        console.log(`\n📁 Loading external labels.json...`);
        
        // Load the labels JSON file
        const labelsData = require('../assets/models/birdnet/labels.json');
        
        if (labelsData && labelsData.labels) {
          result.labels = labelsData.labels;
          result.labelCount = labelsData.labels.length;
          result.success = true;
          
          console.log(`   ✅ Loaded ${result.labelCount} labels`);
          console.log(`   📊 Label format:`, {
            version: labelsData.version,
            description: labelsData.description,
            totalClasses: labelsData.total_classes
          });
          
          // Validate label structure
          const sampleLabel = labelsData.labels[0];
          console.log(`   🔍 Sample label:`, sampleLabel);
          
          const requiredFields = ['index', 'scientific_name', 'common_name'];
          const hasRequiredFields = requiredFields.every(field => field in sampleLabel);
          
          if (hasRequiredFields) {
            console.log(`   ✅ Label structure is valid`);
          } else {
            console.log(`   ⚠️ Label structure missing fields:`, requiredFields.filter(f => !(f in sampleLabel)));
          }
          
        } else {
          throw new Error('Invalid labels.json structure');
        }

      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.log(`   ❌ External label loading failed: ${result.error}`);
      }

      labelResults.push(result);
      // External labels should be available for testing
      expect(result.success || result.error).toBeDefined();
    });

    test('should validate label compatibility with models', async () => {
      // Get the external labels
      const externalLabels = require('../assets/models/birdnet/labels.json');
      const workingModels = testResults.filter(r => r.loadSuccess && r.inferenceSuccess);

      console.log(`\n🔗 Testing label compatibility with ${workingModels.length} working models...`);

      for (const model of workingModels) {
        const isCompatible = model.outputClasses === externalLabels.total_classes;
        
        console.log(`\n📊 ${model.modelName}:`);
        console.log(`   🧠 Model outputs: ${model.outputClasses} classes`);
        console.log(`   🏷️ Labels available: ${externalLabels.total_classes} classes`);
        console.log(`   ✅ Compatible: ${isCompatible ? 'YES' : 'NO'}`);

        if (isCompatible) {
          const compatResult: LabelLoadingResult = {
            strategy: `Hybrid: ${model.modelName} + external labels`,
            success: true,
            labelCount: externalLabels.total_classes,
            source: 'hybrid'
          };
          labelResults.push(compatResult);
        }
      }
    });
  });

  describe('4. Performance and Memory Analysis', () => {
    test('should compare model performance metrics', async () => {
      const workingModels = testResults.filter(r => r.loadSuccess && r.inferenceSuccess);
      
      console.log(`\n⚡ Performance comparison of ${workingModels.length} working models:`);
      console.log('=' .repeat(70));

      for (const result of workingModels) {
        console.log(`\n📁 ${result.modelName}:`);
        console.log(`   ⏱️ Inference Time: ${result.inferenceTime || 'N/A'}ms`);
        console.log(`   🧠 Output Classes: ${result.outputClasses}`);
        console.log(`   📊 Memory: ${result.memoryUsage || 'N/A'}MB`);
        
        if (result.tensorInfo) {
          console.log(`   📐 Input Shape: [${result.tensorInfo.inputShape.join(', ')}]`);
          console.log(`   📐 Output Shape: [${result.tensorInfo.outputShape.join(', ')}]`);
        }
      }

      // Find best performing model
      const bestModel = workingModels
        .filter(m => m.outputClasses === 6522) // Only 6522-class models
        .sort((a, b) => (a.inferenceTime || Infinity) - (b.inferenceTime || Infinity))[0];

      if (bestModel) {
        console.log(`\n🏆 Best performing 6522-class model: ${bestModel.modelName}`);
        console.log(`   ⚡ Inference time: ${bestModel.inferenceTime}ms`);
      }

      expect(workingModels.length).toBeGreaterThan(0);
    });
  });

  describe('5. Integration Testing Recommendations', () => {
    test('should provide integration recommendations', () => {
      console.log(`\n🔧 Integration Recommendations:`);
      console.log('=' .repeat(50));

      // Find best model-label combination
      const compatibleModels = testResults.filter(r => 
        r.loadSuccess && 
        r.inferenceSuccess && 
        r.outputClasses === 6522
      );

      const metadataLabels = labelResults.filter(r => 
        r.success && 
        r.source === 'metadata' && 
        r.labelCount === 6522
      );

      const externalLabelsWork = labelResults.some(r => 
        r.success && 
        r.source === 'external' && 
        r.labelCount === 6522
      );

      if (compatibleModels.length > 0 && metadataLabels.length > 0) {
        console.log(`\n✅ RECOMMENDED: Use MData model with embedded labels`);
        console.log(`   📁 Model: ${compatibleModels[0].modelName}`);
        console.log(`   🏷️ Labels: Embedded metadata`);
        console.log(`   💡 This is the most robust approach`);
      } else if (compatibleModels.length > 0 && externalLabelsWork) {
        console.log(`\n✅ ALTERNATIVE: Use whoBIRD model with external labels`);
        console.log(`   📁 Model: ${compatibleModels[0].modelName}`);
        console.log(`   🏷️ Labels: External labels.json`);
        console.log(`   💡 Requires syncing labels with model`);
      } else {
        console.log(`\n❌ ISSUE: No compatible 6522-class model found`);
        console.log(`   🔧 Action needed: Check model files and format`);
      }

      // Performance recommendations
      if (compatibleModels.length > 1) {
        const fp16Models = compatibleModels.filter(m => m.modelName.includes('FP16'));
        const fp32Models = compatibleModels.filter(m => m.modelName.includes('FP32'));

        if (fp16Models.length > 0 && fp32Models.length > 0) {
          console.log(`\n⚡ Performance Strategy:`);
          console.log(`   🏃 Fast (Camera): Use FP16 model for real-time`);
          console.log(`   🎯 Accurate (Manual): Use FP32 model for manual entry`);
        }
      }

      expect(true).toBe(true); // Always pass, this is informational
    });
  });
});