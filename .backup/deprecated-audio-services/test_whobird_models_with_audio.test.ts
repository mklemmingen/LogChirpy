/**
 * Test whoBIRD models with real forest bird audio
 * 
 * Tests both balanced FP16 and high accuracy FP32 models
 * with the provided forest bird MP3 file
 */

import { AudioIdentificationService } from '../services/audioIdentificationService';
import { ModelType, ModelConfig } from '../services/modelConfig';

const FOREST_BIRD_AUDIO_PATH = '/home/mklemmingen/WebstormProjects/moco_sose25_logchirpy/assets/mixkit-forest-birds-singing-1212.mp3';

interface ModelTestResult {
  modelType: ModelType;
  success: boolean;
  predictions: number;
  topPrediction?: {
    species: string;
    confidence: number;
  };
  processingTime: number;
  error?: string;
}

/**
 * Test a specific model with the forest bird audio
 */
async function testModelWithAudio(modelType: ModelType): Promise<ModelTestResult> {
  const startTime = Date.now();
  
  try {
    console.log(`\n🧪 Testing ${ModelConfig.getModelInfo(modelType)}`);
    console.log(`📁 Audio file: ${FOREST_BIRD_AUDIO_PATH}`);
    
    // Test the model through AudioIdentificationService
    const response = await AudioIdentificationService.identifyBirdFromAudio(
      FOREST_BIRD_AUDIO_PATH,
      {
        modelType: modelType,
        minConfidence: 0.05, // Lower threshold to see more results
      }
    );
    
    const processingTime = Date.now() - startTime;
    
    if (response.success && response.predictions.length > 0) {
      const topPrediction = response.predictions[0];
      
      return {
        modelType,
        success: true,
        predictions: response.predictions.length,
        topPrediction: {
          species: topPrediction.common_name,
          confidence: topPrediction.confidence
        },
        processingTime
      };
    } else {
      return {
        modelType,
        success: false,
        predictions: 0,
        processingTime,
        error: 'No predictions returned'
      };
    }
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return {
      modelType,
      success: false,
      predictions: 0,
      processingTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test both models and compare results
 */
async function testBothModels(): Promise<void> {
  console.log('🚀 Starting whoBIRD model tests with forest bird audio\n');
  
  // Initialize the service
  try {
    await AudioIdentificationService.initialize();
    console.log('✅ AudioIdentificationService initialized\n');
  } catch (error) {
    console.error('❌ Failed to initialize AudioIdentificationService:', error);
    return;
  }
  
  const results: ModelTestResult[] = [];
  
  // Test balanced FP16 model (for real-time camera use)
  console.log('='.repeat(60));
  console.log('🎯 TESTING BALANCED FP16 MODEL (Camera Pipeline)');
  console.log('='.repeat(60));
  const balancedResult = await testModelWithAudio(ModelType.BALANCED_FP16);
  results.push(balancedResult);
  
  // Test high accuracy FP32 model (for manual identification)
  console.log('\n' + '='.repeat(60));
  console.log('🎯 TESTING HIGH ACCURACY FP32 MODEL (Manual Pipeline)');
  console.log('='.repeat(60));
  const accuracyResult = await testModelWithAudio(ModelType.HIGH_ACCURACY_FP32);
  results.push(accuracyResult);
  
  // Print comparison
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTS COMPARISON');
  console.log('='.repeat(60));
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const modelInfo = ModelConfig.getConfiguration(result.modelType);
    
    console.log(`\n${status} ${modelInfo.name}`);
    console.log(`   File Size: ${modelInfo.fileSize}`);
    console.log(`   Precision: ${modelInfo.precision}`);
    console.log(`   Processing Time: ${result.processingTime}ms`);
    console.log(`   Use Case: ${modelInfo.recommendedUse.join(', ')}`);
    
    if (result.success) {
      console.log(`   Predictions Found: ${result.predictions}`);
      console.log(`   Top Prediction: ${result.topPrediction?.species} (${(result.topPrediction?.confidence! * 100).toFixed(2)}%)`);
    } else {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  // Performance comparison
  if (results.every(r => r.success)) {
    const speedDiff = Math.abs(results[0].processingTime - results[1].processingTime);
    const fasterModel = results[0].processingTime < results[1].processingTime ? results[0] : results[1];
    
    console.log(`\n⚡ Performance: ${ModelConfig.getConfiguration(fasterModel.modelType).name} was ${speedDiff}ms faster`);
    
    // Confidence comparison
    const conf1 = results[0].topPrediction?.confidence || 0;
    const conf2 = results[1].topPrediction?.confidence || 0;
    const confDiff = Math.abs(conf1 - conf2);
    
    console.log(`🎯 Confidence difference: ${(confDiff * 100).toFixed(2)}%`);
    
    if (conf1 !== conf2) {
      const moreConfident = conf1 > conf2 ? results[0] : results[1];
      console.log(`📈 Higher confidence: ${ModelConfig.getConfiguration(moreConfident.modelType).name}`);
    }
  }
  
  // Recommendations
  console.log('\n' + '='.repeat(60));
  console.log('💡 RECOMMENDATIONS');
  console.log('='.repeat(60));
  
  if (results[0].success) {
    console.log(`✨ For real-time camera: Use ${ModelConfig.getConfiguration(ModelType.BALANCED_FP16).name}`);
    console.log(`   - Fast processing (${results[0].processingTime}ms)`);
    console.log(`   - Good accuracy for live detection`);
    console.log(`   - Lower memory usage`);
  }
  
  if (results[1].success) {
    console.log(`\n🔬 For manual identification: Use ${ModelConfig.getConfiguration(ModelType.HIGH_ACCURACY_FP32).name}`);
    console.log(`   - Maximum accuracy (${results[1].processingTime}ms)`);
    console.log(`   - Best for detailed analysis`);
    console.log(`   - Worth the extra processing time`);
  }
  
  console.log('\n🎉 Model testing completed!');
}

/**
 * Export test function for Jest
 */
export async function runWhoBirdModelTests(): Promise<ModelTestResult[]> {
  const results: ModelTestResult[] = [];
  
  // Initialize service
  await AudioIdentificationService.initialize();
  
  // Test both models
  results.push(await testModelWithAudio(ModelType.BALANCED_FP16));
  results.push(await testModelWithAudio(ModelType.HIGH_ACCURACY_FP32));
  
  return results;
}

// Run tests if executed directly
if (require.main === module) {
  testBothModels()
    .then(() => {
      console.log('\n✨ All tests completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}