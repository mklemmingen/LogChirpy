/**
 * Model Configuration Research Script
 * 
 * This script directly tests the FP32 model to discover its exact input/output requirements
 * Run with: npx ts-node __tests__/research_model_config.ts
 */

import { fastTfliteBirdClassifier } from '../services/fastTfliteBirdClassifier.ts';
import { ModelType, ModelConfig } from '../services/modelConfig.ts';

interface ModelResearchResult {
  modelType: ModelType;
  modelLoaded: boolean;
  inputShapeDiscovered?: number[];
  expectedInputSize?: number;
  testResults: {
    inputSize: number;
    success: boolean;
    outputCount?: number;
    error?: string;
  }[];
  outputAnalysis?: {
    samplePredictions: any[];
    confidenceRange: [number, number];
    speciesCount: number;
  };
}

async function discoverModelConfiguration(): Promise<ModelResearchResult> {
  const result: ModelResearchResult = {
    modelType: ModelType.HIGH_ACCURACY_FP32,
    modelLoaded: false,
    testResults: []
  };

  console.log('🔬 Starting Model Configuration Research');
  console.log('='.repeat(60));

  try {
    // Step 1: Load the FP32 model
    console.log('📋 Model Information:');
    const config = ModelConfig.getConfiguration(ModelType.HIGH_ACCURACY_FP32);
    console.log(`   Name: ${config.name}`);
    console.log(`   Expected Classes: ${config.expectedClasses}`);
    console.log(`   Precision: ${config.precision}`);
    console.log(`   File Size: ${config.fileSize}`);
    console.log('');

    console.log('🚀 Loading model...');
    const loadSuccess = await fastTfliteBirdClassifier.switchModel(ModelType.HIGH_ACCURACY_FP32);
    result.modelLoaded = loadSuccess;

    if (!loadSuccess) {
      console.log('❌ Model failed to load');
      return result;
    }

    console.log('✅ Model loaded successfully');
    
    // Step 2: Try to discover input shape
    console.log('\n🔍 Discovering Input Requirements...');
    
    // Get model's reported input shape if available
    try {
      const modelInstance = (fastTfliteBirdClassifier as any).model;
      if (modelInstance && modelInstance.inputs) {
        const inputInfo = modelInstance.inputs[0];
        result.inputShapeDiscovered = inputInfo.shape;
        console.log(`📐 Model reports input shape: [${inputInfo.shape.join(', ')}]`);
        console.log(`📊 Input data type: ${inputInfo.dataType}`);
      }
    } catch (error) {
      console.log('⚠️  Could not access model tensor info directly');
    }

    // Step 3: Test different input sizes to find the correct one
    console.log('\n🧪 Testing Input Sizes...');
    
    const inputSizesToTest = [
      144 * 144,        // 20,736 - Original audio model assumption
      144 * 144 * 1,    // 20,736 - Single channel
      144 * 144 * 3,    // 62,208 - RGB-like format
      224 * 224,        // 50,176 - Common image size
      224 * 224 * 1,    // 50,176 - Single channel
      224 * 224 * 3,    // 150,528 - RGB format (current assumption)
      96 * 511,         // 49,056 - BirdNet v2.4 time x freq
      96 * 511 * 2,     // 98,112 - Dual channel BirdNet
    ];

    for (const inputSize of inputSizesToTest) {
      console.log(`   Testing input size: ${inputSize.toLocaleString()}`);
      
      try {
        const testInput = new Float32Array(inputSize);
        // Fill with realistic mel-spectrogram-like data
        for (let i = 0; i < inputSize; i++) {
          testInput[i] = Math.sin(i * 0.001) * 0.5 + (Math.random() - 0.5) * 0.1;
        }

        const inferenceResult = await fastTfliteBirdClassifier.classifyBirdAudio(testInput);
        
        result.testResults.push({
          inputSize,
          success: true,
          outputCount: inferenceResult.results.length
        });

        console.log(`   ✅ Size ${inputSize.toLocaleString()}: SUCCESS - ${inferenceResult.results.length} predictions`);
        
        // If this is the first successful size, analyze the output
        if (!result.outputAnalysis && inferenceResult.results.length > 0) {
          result.expectedInputSize = inputSize;
          
          const confidences = inferenceResult.results.map(p => p.confidence);
          result.outputAnalysis = {
            samplePredictions: inferenceResult.results.slice(0, 5),
            confidenceRange: [Math.min(...confidences), Math.max(...confidences)],
            speciesCount: inferenceResult.results.length
          };
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.testResults.push({
          inputSize,
          success: false,
          error: errorMsg
        });

        console.log(`   ❌ Size ${inputSize.toLocaleString()}: FAILED - ${errorMsg.substring(0, 50)}${errorMsg.length > 50 ? '...' : ''}`);
      }
    }

    // Step 4: Analyze successful configurations
    console.log('\n📊 Analysis Results:');
    const successfulSizes = result.testResults.filter(r => r.success);
    
    if (successfulSizes.length === 0) {
      console.log('❌ No input sizes worked - model may have initialization issues');
    } else {
      console.log(`✅ Found ${successfulSizes.length} working input size(s):`);
      successfulSizes.forEach(size => {
        const dimensions = inferDimensions(size.inputSize);
        console.log(`   - ${size.inputSize.toLocaleString()} elements ${dimensions}`);
      });

      if (result.expectedInputSize) {
        console.log(`\n🎯 Recommended input size: ${result.expectedInputSize.toLocaleString()}`);
        console.log(`   Dimensions: ${inferDimensions(result.expectedInputSize)}`);
      }
    }

    // Step 5: Analyze output structure
    if (result.outputAnalysis) {
      console.log('\n📈 Output Analysis:');
      console.log(`   Species predictions: ${result.outputAnalysis.speciesCount}`);
      console.log(`   Confidence range: ${(result.outputAnalysis.confidenceRange[0] * 100).toFixed(3)}% - ${(result.outputAnalysis.confidenceRange[1] * 100).toFixed(3)}%`);
      console.log(`   Sample predictions:`);
      
      result.outputAnalysis.samplePredictions.forEach((pred, idx) => {
        console.log(`     ${idx + 1}. ${pred.species} (${(pred.confidence * 100).toFixed(2)}%)`);
        if (pred.scientificName) {
          console.log(`        Scientific: ${pred.scientificName}`);
        }
      });
    }

  } catch (error) {
    console.log(`💥 Research failed: ${error}`);
  } finally {
    // Cleanup
    fastTfliteBirdClassifier.dispose();
  }

  return result;
}

function inferDimensions(totalSize: number): string {
  // Try to infer meaningful dimensions from total size
  const commonShapes = [
    { shape: [144, 144], name: '144×144 (single channel)' },
    { shape: [144, 144, 1], name: '144×144×1' },
    { shape: [144, 144, 3], name: '144×144×3 (RGB)' },
    { shape: [224, 224], name: '224×224 (single channel)' },
    { shape: [224, 224, 1], name: '224×224×1' },
    { shape: [224, 224, 3], name: '224×224×3 (RGB)' },
    { shape: [96, 511], name: '96×511 (BirdNet time×freq)' },
    { shape: [96, 511, 2], name: '96×511×2 (BirdNet dual channel)' },
  ];

  for (const { shape, name } of commonShapes) {
    const product = shape.reduce((a, b) => a * b, 1);
    if (product === totalSize) {
      return `(likely ${name})`;
    }
  }

  // Try to find factorizations
  const factors = findFactors(totalSize);
  if (factors.length > 0) {
    return `(possible: ${factors.slice(0, 3).map(f => f.join('×')).join(' or ')})`;
  }

  return '(unknown dimensions)';
}

function findFactors(n: number): number[][] {
  const factors: number[][] = [];
  
  // Check for 2D factorizations
  for (let i = 1; i <= Math.sqrt(n); i++) {
    if (n % i === 0) {
      factors.push([i, n / i]);
    }
  }
  
  // Check for 3D factorizations (common for image data)
  for (let i = 1; i <= Math.cbrt(n); i++) {
    if (n % i === 0) {
      const remaining = n / i;
      for (let j = 1; j <= Math.sqrt(remaining); j++) {
        if (remaining % j === 0) {
          factors.push([i, j, remaining / j]);
        }
      }
    }
  }
  
  return factors;
}

// Main execution
async function main(): Promise<void> {
  try {
    const result = await discoverModelConfiguration();
    
    console.log('\n🎉 Research Complete!');
    console.log('='.repeat(60));
    
    // Create a summary
    if (result.modelLoaded) {
      console.log('✅ Model Configuration Summary:');
      console.log(`   Model Type: ${result.modelType}`);
      
      if (result.inputShapeDiscovered) {
        console.log(`   Reported Input Shape: [${result.inputShapeDiscovered.join(', ')}]`);
      }
      
      if (result.expectedInputSize) {
        console.log(`   Working Input Size: ${result.expectedInputSize.toLocaleString()} Float32 elements`);
        console.log(`   Input Dimensions: ${inferDimensions(result.expectedInputSize)}`);
      }
      
      const successCount = result.testResults.filter(r => r.success).length;
      console.log(`   Successful Tests: ${successCount}/${result.testResults.length}`);
      
      if (result.outputAnalysis) {
        console.log(`   Output Predictions: ${result.outputAnalysis.speciesCount}`);
        console.log(`   Embedded Labels: ${result.outputAnalysis.samplePredictions.length > 0 ? 'Working' : 'Unknown'}`);
      }
    } else {
      console.log('❌ Model failed to load - check model file and dependencies');
    }
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Use the working input size in your preprocessing pipeline');
    console.log('   2. Ensure your mel-spectrogram generation matches the dimensions');
    console.log('   3. Verify audio preprocessing produces Float32Array with correct size');
    console.log('   4. Test with real audio files using the validated configuration');
    
  } catch (error) {
    console.error('💥 Research script failed:', error);
    process.exit(1);
  }
}

// Export for testing
export { discoverModelConfiguration };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}