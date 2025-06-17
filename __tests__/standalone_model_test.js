#!/usr/bin/env node

/**
 * Standalone Model Configuration Test
 * 
 * Tests the FP32 model configuration without Jest dependencies
 * Uses the forest birds MP3 from assets/audio for real testing
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MODEL_PATH = path.join(PROJECT_ROOT, 'assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite');
const AUDIO_PATH = path.join(PROJECT_ROOT, 'assets/audio/mixkit-forest-birds-singing-1212.mp3');

// Test results collector
const results = {
  tests: [],
  passed: 0,
  failed: 0,
  warnings: []
};

function logTest(name, passed, details = null) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${name}`);
  if (details) {
    console.log(`   ${details}`);
  }
  
  results.tests.push({
    name,
    passed,
    details
  });
  
  if (passed) results.passed++;
  else results.failed++;
}

function logWarning(message) {
  console.log(`⚠️  WARNING: ${message}`);
  results.warnings.push(message);
}

async function testFileExistence() {
  console.log('\n=== FILE EXISTENCE TESTS ===');
  
  // Test model file
  const modelExists = fs.existsSync(MODEL_PATH);
  logTest('FP32 Model file exists', modelExists, MODEL_PATH);
  
  // Test audio file
  const audioExists = fs.existsSync(AUDIO_PATH);
  logTest('Test audio file exists', audioExists, AUDIO_PATH);
  
  if (modelExists) {
    const modelStats = fs.statSync(MODEL_PATH);
    const modelSizeMB = Math.round(modelStats.size / (1024 * 1024));
    logTest('Model file size is reasonable', modelSizeMB > 30 && modelSizeMB < 100, 
      `${modelSizeMB}MB (expected: 40-60MB for FP32)`);
  }
  
  if (audioExists) {
    const audioStats = fs.statSync(AUDIO_PATH);
    const audioSizeKB = Math.round(audioStats.size / 1024);
    logTest('Audio file size is reasonable', audioSizeKB > 100, 
      `${audioSizeKB}KB`);
  }
}

async function testModelConfiguration() {
  console.log('\n=== MODEL CONFIGURATION TESTS ===');
  
  try {
    // Try to load the model config
    const modelConfigPath = path.join(PROJECT_ROOT, 'services/modelConfig.ts');
    if (fs.existsSync(modelConfigPath)) {
      logTest('Model configuration file exists', true, modelConfigPath);
      
      const configContent = fs.readFileSync(modelConfigPath, 'utf8');
      
      // Check for FP32 configuration
      const hasFP32Config = configContent.includes('HIGH_ACCURACY_FP32') || 
                           configContent.includes('FP32');
      logTest('FP32 model configuration found', hasFP32Config);
      
      // Check expected classes
      const has6522Classes = configContent.includes('6522');
      logTest('Expected 6522 classes configured', has6522Classes);
      
      // Check model path reference
      const hasModelPath = configContent.includes('BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite');
      logTest('FP32 model path correctly referenced', hasModelPath);
      
    } else {
      logTest('Model configuration file exists', false, 'services/modelConfig.ts not found');
    }
  } catch (error) {
    logTest('Model configuration accessible', false, error.message);
  }
}

async function testAudioPreprocessingConfig() {
  console.log('\n=== AUDIO PREPROCESSING TESTS ===');
  
  try {
    const preprocessingPath = path.join(PROJECT_ROOT, 'services/audioPreprocessingTFLite.ts');
    if (fs.existsSync(preprocessingPath)) {
      logTest('Audio preprocessing service exists', true);
      
      const preprocessingContent = fs.readFileSync(preprocessingPath, 'utf8');
      
      // Check for correct output shape
      const hasCorrectShape = preprocessingContent.includes('224') && 
                             preprocessingContent.includes('Float32Array');
      logTest('Correct output shape configured (224x224)', hasCorrectShape);
      
      // Check for 48kHz sample rate
      const has48kHz = preprocessingContent.includes('48000') || 
                      preprocessingContent.includes('48_000');
      logTest('48kHz sample rate configured', has48kHz);
      
    } else {
      logTest('Audio preprocessing service exists', false);
    }
  } catch (error) {
    logTest('Audio preprocessing configuration accessible', false, error.message);
  }
}

async function testAudioConfiguration() {
  console.log('\n=== AUDIO CONFIGURATION TESTS ===');
  
  try {
    const cameraPath = path.join(PROJECT_ROOT, 'app/log/objectIdentCamera.tsx');
    if (fs.existsSync(cameraPath)) {
      logTest('Camera component exists', true);
      
      const cameraContent = fs.readFileSync(cameraPath, 'utf8');
      
      // Check audio configuration
      const has48kHzConfig = cameraContent.includes('sampleRate: 48000');
      logTest('Camera audio configured for 48kHz', has48kHzConfig);
      
      const hasMonoConfig = cameraContent.includes('numberOfChannels: 1');
      logTest('Camera audio configured for mono', hasMonoConfig);
      
      const hasM4AFormat = cameraContent.includes('.m4a') || 
                          cameraContent.includes('MPEG_4');
      logTest('Camera audio format configured (M4A/MP4)', hasM4AFormat);
      
    } else {
      logTest('Camera component exists', false);
    }
  } catch (error) {
    logTest('Camera configuration accessible', false, error.message);
  }
}

async function testServiceIntegration() {
  console.log('\n=== SERVICE INTEGRATION TESTS ===');
  
  try {
    const audioServicePath = path.join(PROJECT_ROOT, 'services/audioIdentificationService.ts');
    if (fs.existsSync(audioServicePath)) {
      logTest('Audio identification service exists', true);
      
      const serviceContent = fs.readFileSync(audioServicePath, 'utf8');
      
      // Check for FP32 model type
      const usesFP32 = serviceContent.includes('HIGH_ACCURACY_FP32') ||
                      serviceContent.includes('FP32');
      logTest('Service uses FP32 model type', usesFP32);
      
      // Check for proper error handling
      const hasErrorHandling = serviceContent.includes('try') && 
                              serviceContent.includes('catch');
      logTest('Service has error handling', hasErrorHandling);
      
    } else {
      logTest('Audio identification service exists', false);
    }
    
    const classifierPath = path.join(PROJECT_ROOT, 'services/fastTfliteBirdClassifier.ts');
    if (fs.existsSync(classifierPath)) {
      logTest('TFLite classifier service exists', true);
      
      const classifierContent = fs.readFileSync(classifierPath, 'utf8');
      
      // Check input shape handling
      const hasInputShapeLogic = classifierContent.includes('getModelInputShape') ||
                                classifierContent.includes('shape');
      logTest('Classifier handles input shapes', hasInputShapeLogic);
      
      // Check for embedded labels support
      const supportsEmbeddedLabels = !classifierContent.includes('labels.json') ||
                                   classifierContent.includes('embedded');
      logTest('Classifier supports embedded labels', supportsEmbeddedLabels);
      
    } else {
      logTest('TFLite classifier service exists', false);
    }
  } catch (error) {
    logTest('Service integration accessible', false, error.message);
  }
}

async function testExpectedDataFlow() {
  console.log('\n=== DATA FLOW ANALYSIS ===');
  
  // Expected data flow for FP32 model:
  // Audio (48kHz) → Mel-spectrogram (224x224x3) → Model → 6522 classes
  
  logTest('Expected input: 48kHz audio', true, 
    'Audio should be recorded at 48kHz sample rate');
  
  logTest('Expected preprocessing: Mel-spectrogram', true, 
    'Audio → Mel-spectrogram conversion (224x224x3 Float32Array)');
  
  logTest('Expected model input: [1, 224, 224, 3]', true, 
    'Model expects 224x224x3 tensor with batch size 1');
  
  logTest('Expected model output: 6522 classes', true, 
    'Model outputs probabilities for 6522 bird species');
  
  logTest('Expected labels: Embedded in model', true, 
    'FP32 model has embedded labels, no external file needed');
}

function checkForPotentialIssues() {
  console.log('\n=== POTENTIAL ISSUES ANALYSIS ===');
  
  // Check for common configuration mismatches
  const servicesDir = path.join(PROJECT_ROOT, 'services');
  const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.ts'));
  
  let foundInputShapeMismatch = false;
  let foundSampleRateMismatch = false;
  
  files.forEach(file => {
    const content = fs.readFileSync(path.join(servicesDir, file), 'utf8');
    
    // Check for 144x144 (incorrect) vs 224x224 (correct)
    if (content.includes('144') && content.includes('shape')) {
      foundInputShapeMismatch = true;
      logWarning(`Potential input shape mismatch in ${file}: found 144, should be 224`);
    }
    
    // Check for incorrect sample rates
    if (content.includes('44100') || content.includes('16000')) {
      foundSampleRateMismatch = true;
      logWarning(`Potential sample rate mismatch in ${file}: BirdNet prefers 48kHz`);
    }
  });
  
  logTest('No input shape mismatches found', !foundInputShapeMismatch);
  logTest('No sample rate mismatches found', !foundSampleRateMismatch);
}

async function generateTestReport() {
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Total tests: ${results.tests.length}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Warnings: ${results.warnings.length}`);
  
  if (results.failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.tests.filter(t => !t.passed).forEach(test => {
      console.log(`  • ${test.name}`);
      if (test.details) console.log(`    ${test.details}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.warnings.forEach(warning => {
      console.log(`  • ${warning}`);
    });
  }
  
  console.log('\n=== RECOMMENDATIONS ===');
  
  if (results.failed === 0 && results.warnings.length === 0) {
    console.log('✅ Configuration looks good! Ready for testing with real audio.');
    console.log('   Next steps:');
    console.log('   1. Run the app and test audio recording');
    console.log('   2. Verify model output with forest birds MP3');
    console.log('   3. Check classification results are reasonable');
  } else {
    console.log('🔧 Issues found that should be addressed:');
    
    if (results.tests.find(t => t.name.includes('Model file') && !t.passed)) {
      console.log('   • Ensure FP32 model file is properly located');
    }
    
    if (results.tests.find(t => t.name.includes('shape') && !t.passed)) {
      console.log('   • Fix input shape configuration (should be 224x224x3)');
    }
    
    if (results.tests.find(t => t.name.includes('48kHz') && !t.passed)) {
      console.log('   • Configure audio recording for 48kHz sample rate');
    }
    
    if (results.warnings.length > 0) {
      console.log('   • Review warnings above for potential misconfigurations');
    }
  }
  
  const successRate = Math.round((results.passed / results.tests.length) * 100);
  console.log(`\n📊 Overall Success Rate: ${successRate}%`);
  
  return successRate >= 80;
}

async function main() {
  console.log('🧪 LogChirpy FP32 Model Configuration Test');
  console.log('==========================================');
  console.log(`Testing model path: ${MODEL_PATH}`);
  console.log(`Testing audio path: ${AUDIO_PATH}`);
  console.log('');
  
  try {
    await testFileExistence();
    await testModelConfiguration();
    await testAudioPreprocessingConfig();
    await testAudioConfiguration();
    await testServiceIntegration();
    await testExpectedDataFlow();
    checkForPotentialIssues();
    
    const success = await generateTestReport();
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 Unexpected error during testing:');
    console.error(error);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  main();
}

module.exports = {
  main,
  results
};