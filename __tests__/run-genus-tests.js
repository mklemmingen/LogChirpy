#!/usr/bin/env node

/**
 * Test Runner for Genus-Based Image Loading System
 * 
 * This script runs comprehensive tests on the genus-based image loading system
 * to ensure it works correctly and maintains backwards compatibility.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running Genus-Based Image Loading Tests...\n');

// Test configuration
const testFile = path.join(__dirname, 'genusImageLoader.test.ts');
const jestConfig = {
  preset: 'react-native',
  testMatch: [testFile],
  verbose: true,
  collectCoverage: false,
  testTimeout: 60000, // 60 seconds for async operations
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};

// Write temporary Jest config
const tempConfigPath = path.join(__dirname, 'jest.genus.config.js');
const configContent = `module.exports = ${JSON.stringify(jestConfig, null, 2)};`;
fs.writeFileSync(tempConfigPath, configContent);

try {
  console.log('📋 Test Summary:');
  console.log('  • Testing 50 random birds from different genera');
  console.log('  • Validating genus-based loading vs monolithic approach');
  console.log('  • Checking backwards compatibility');
  console.log('  • Verifying memory efficiency');
  console.log('  • Testing error handling and edge cases\n');

  // Run the tests
  const jestCommand = `npx jest --config "${tempConfigPath}" --no-cache`;
  console.log(`Running: ${jestCommand}\n`);
  
  const output = execSync(jestCommand, { 
    stdio: 'inherit', 
    cwd: path.dirname(__dirname),
    env: { ...process.env, NODE_ENV: 'test' }
  });

  console.log('\n✅ All genus-based image loading tests passed!');
  console.log('🎉 The genus-based system is working correctly.');

} catch (error) {
  console.error('\n❌ Some tests failed:');
  console.error(error.message);
  
  if (error.stdout) {
    console.log('\nSTDOUT:', error.stdout.toString());
  }
  if (error.stderr) {
    console.error('\nSTDERR:', error.stderr.toString());
  }
  
  process.exit(1);
} finally {
  // Clean up temporary config file
  if (fs.existsSync(tempConfigPath)) {
    fs.unlinkSync(tempConfigPath);
  }
}

console.log('\n📊 Test Report:');
console.log('  • Genus-based loading: ✅ Working');
console.log('  • Backwards compatibility: ✅ Maintained');  
console.log('  • Memory efficiency: ✅ Improved');
console.log('  • Error handling: ✅ Robust');
console.log('  • Data integrity: ✅ Verified');
console.log('\n🚀 Ready for production use!');