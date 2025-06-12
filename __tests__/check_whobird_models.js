/**
 * Simple script to check whoBIRD model information
 * Run with: node __tests__/check_whobird_models.js
 */

const fs = require('fs');
const path = require('path');

const models = [
  'BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite',
  'BirdNET_GLOBAL_6K_V2.4_Model_FP16.tflite', 
  'BirdNET_GLOBAL_6K_V2.4_MData_Model_FP16.tflite',
  'BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16.tflite'
];

console.log('Checking whoBIRD TFLite models...\n');

models.forEach(modelName => {
  const modelPath = path.join(__dirname, '..', 'assets', 'models', 'whoBIRD-TFlite-master', modelName);
  
  console.log(`\n=== ${modelName} ===`);
  
  try {
    const stats = fs.statSync(modelPath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log(`✅ File exists`);
    console.log(`📦 Size: ${fileSizeMB} MB`);
    
    // Read first few bytes to check TFLite magic number
    const fd = fs.openSync(modelPath, 'r');
    const buffer = Buffer.alloc(4);
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    
    // TFLite files should start with "TFL3" 
    const magic = buffer.toString('ascii');
    if (magic === 'TFL3') {
      console.log(`✅ Valid TFLite format (magic: ${magic})`);
    } else {
      console.log(`⚠️  Unexpected file format (magic: ${magic})`);
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
});

// Check if labels exist
console.log('\n\n=== Checking for label files ===');
const labelPath = path.join(__dirname, '..', 'assets', 'models', 'whoBIRD-TFlite-master');
const files = fs.readdirSync(labelPath);
const labelFiles = files.filter(f => f.includes('label') || f.endsWith('.txt') || f.endsWith('.json'));

if (labelFiles.length > 0) {
  console.log('Found potential label files:');
  labelFiles.forEach(file => {
    const filePath = path.join(labelPath, file);
    const stats = fs.statSync(filePath);
    console.log(`  - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  });
} else {
  console.log('⚠️  No label files found. You may need to use existing BirdNET labels or download them separately.');
}

console.log('\n\nModel Comparison:');
console.log('==================');
console.log('FP32: Full precision (32-bit floating point) - Best accuracy, largest size');
console.log('FP16: Half precision (16-bit floating point) - Good accuracy, ~50% smaller');  
console.log('MData: Models with metadata embedded - May include labels or other info');

console.log('\n✨ All checks completed!');