/**
 * Comprehensive whoBIRD FP32 Model Test Runner
 * 
 * Orchestrates all FP32 model tests and provides a comprehensive report
 * Use this to run the complete validation suite for the embedded-labels model
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  testFile: string;
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

interface TestSuite {
  name: string;
  description: string;
  testFile: string;
  priority: 'high' | 'medium' | 'low';
  estimatedDuration: number; // in seconds
}

// Define the test suites in order of execution
const TEST_SUITES: TestSuite[] = [
  {
    name: 'Model Validation',
    description: 'Validates FP32 model loading, configuration, and basic functionality',
    testFile: 'whobird_fp32_model_validation.test.ts',
    priority: 'high',
    estimatedDuration: 60
  },
  {
    name: 'Audio Preprocessing Pipeline',
    description: 'Tests audio format compatibility and mel-spectrogram generation',
    testFile: 'audio_preprocessing_pipeline.test.ts',
    priority: 'high',
    estimatedDuration: 45
  },
  {
    name: 'Model I/O Compatibility',
    description: 'Validates complete data flow from preprocessing to model output',
    testFile: 'model_io_compatibility.test.ts',
    priority: 'high',
    estimatedDuration: 90
  },
  {
    name: 'Embedded Labels Validation',
    description: 'Tests embedded labels functionality and global species coverage',
    testFile: 'embedded_labels_validation.test.ts',
    priority: 'medium',
    estimatedDuration: 120
  },
  {
    name: 'Real Audio Integration',
    description: 'End-to-end testing with actual bird recordings',
    testFile: 'real_audio_integration.test.ts',
    priority: 'medium',
    estimatedDuration: 180
  },
  {
    name: 'Camera Pipeline Integration',
    description: 'Tests audio processing within camera workflow',
    testFile: 'camera_audio_pipeline.test.ts',
    priority: 'low',
    estimatedDuration: 150
  }
];

class TestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;
  
  constructor() {
    this.startTime = Date.now();
  }

  async runAllTests(options: {
    includeLowPriority?: boolean;
    verbose?: boolean;
    generateReport?: boolean;
  } = {}): Promise<void> {
    const { includeLowPriority = true, verbose = true, generateReport = true } = options;
    
    console.log('🚀 Starting whoBIRD FP32 Model Validation Suite');
    console.log('=' .repeat(80));
    
    // Filter test suites based on priority
    const suitesToRun = TEST_SUITES.filter(suite => 
      includeLowPriority || suite.priority !== 'low'
    );
    
    const totalEstimatedTime = suitesToRun.reduce((sum, suite) => sum + suite.estimatedDuration, 0);
    console.log(`📋 Test Plan: ${suitesToRun.length} test suites`);
    console.log(`⏱️  Estimated duration: ${Math.round(totalEstimatedTime / 60)} minutes`);
    console.log('');

    // Display test plan
    suitesToRun.forEach((suite, index) => {
      console.log(`${index + 1}. ${suite.name} (${suite.priority}) - ${suite.estimatedDuration}s`);
      console.log(`   ${suite.description}`);
    });
    console.log('');

    // Run each test suite
    for (let i = 0; i < suitesToRun.length; i++) {
      const suite = suitesToRun[i];
      console.log('=' .repeat(80));
      console.log(`🧪 Running Test Suite ${i + 1}/${suitesToRun.length}: ${suite.name}`);
      console.log('=' .repeat(80));
      
      await this.runTestSuite(suite, verbose);
      
      // Brief pause between test suites
      if (i < suitesToRun.length - 1) {
        console.log('\n⏸️  Pausing 5 seconds before next suite...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Generate and display final report
    if (generateReport) {
      await this.generateReport();
    }
    
    this.displaySummary();
  }

  private async runTestSuite(suite: TestSuite, verbose: boolean): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`📂 Test file: ${suite.testFile}`);
      console.log(`📝 Description: ${suite.description}`);
      console.log(`⏱️  Estimated time: ${suite.estimatedDuration}s`);
      console.log('');

      // Run the Jest test for this specific file
      const jestCommand = `npx jest __tests__/${suite.testFile} --verbose=${verbose} --runInBand --detectOpenHandles`;
      
      if (verbose) {
        console.log(`🔧 Command: ${jestCommand}`);
        console.log('');
      }

      const output = execSync(jestCommand, { 
        encoding: 'utf8',
        stdio: verbose ? 'inherit' : 'pipe',
        timeout: suite.estimatedDuration * 2 * 1000 // 2x estimated time as timeout
      });

      const duration = (Date.now() - startTime) / 1000;
      
      this.results.push({
        testFile: suite.testFile,
        testName: suite.name,
        passed: true,
        duration,
        details: { output }
      });

      console.log(`✅ ${suite.name} completed successfully in ${duration.toFixed(1)}s`);
      
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.results.push({
        testFile: suite.testFile,
        testName: suite.name,
        passed: false,
        duration,
        error: errorMessage
      });

      console.log(`❌ ${suite.name} failed after ${duration.toFixed(1)}s`);
      console.log(`Error: ${errorMessage}`);
      
      // Ask if user wants to continue or stop
      if (suite.priority === 'high') {
        console.log('⚠️  High priority test failed. Consider investigating before proceeding.');
      }
    }
  }

  private async generateReport(): Promise<void> {
    const totalDuration = (Date.now() - this.startTime) / 1000;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = this.results.filter(r => r.passed === false).length;
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.results.length,
        passed: passedTests,
        failed: failedTests,
        successRate: this.results.length > 0 ? (passedTests / this.results.length * 100).toFixed(1) : '0',
        totalDuration: totalDuration.toFixed(1)
      },
      results: this.results.map(result => ({
        testSuite: result.testName,
        testFile: result.testFile,
        status: result.passed ? 'PASSED' : 'FAILED',
        duration: `${result.duration.toFixed(1)}s`,
        error: result.error || null
      })),
      recommendations: this.generateRecommendations()
    };

    // Save report to file
    const reportPath = path.join(__dirname, '..', 'test-reports', `whobird_fp32_validation_${Date.now()}.json`);
    
    // Ensure report directory exists
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Detailed report saved to: ${reportPath}`);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const failedTests = this.results.filter(r => !r.passed);
    const highPriorityFailed = failedTests.filter(r => 
      TEST_SUITES.find(s => s.name === r.testName)?.priority === 'high'
    );

    if (failedTests.length === 0) {
      recommendations.push('✅ All tests passed! The FP32 model is ready for production use.');
      recommendations.push('🚀 Consider running performance benchmarks on target devices.');
      recommendations.push('📱 Test on various Android/iOS devices to ensure compatibility.');
    } else {
      if (highPriorityFailed.length > 0) {
        recommendations.push('🚨 High priority tests failed - address these before deployment:');
        highPriorityFailed.forEach(test => {
          recommendations.push(`   - ${test.testName}: ${test.error}`);
        });
      }
      
      recommendations.push('🔧 Consider the following actions:');
      recommendations.push('   - Check model file integrity and path');
      recommendations.push('   - Verify react-native-fast-tflite installation');
      recommendations.push('   - Test on different devices/emulators');
      recommendations.push('   - Review audio file formats and preprocessing');
    }

    return recommendations;
  }

  private displaySummary(): void {
    const totalDuration = (Date.now() - this.startTime) / 1000;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = this.results.filter(r => r.passed === false).length;
    
    console.log('\n' + '=' .repeat(80));
    console.log('📋 FINAL TEST SUMMARY');
    console.log('=' .repeat(80));
    
    console.log(`⏱️  Total Duration: ${totalDuration.toFixed(1)}s (${(totalDuration / 60).toFixed(1)} minutes)`);
    console.log(`📊 Test Results: ${passedTests} passed, ${failedTests} failed`);
    console.log(`📈 Success Rate: ${this.results.length > 0 ? (passedTests / this.results.length * 100).toFixed(1) : '0'}%`);
    console.log('');

    // Display individual test results
    this.results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      const suite = TEST_SUITES.find(s => s.name === result.testName);
      const priority = suite?.priority || 'unknown';
      
      console.log(`${index + 1}. ${status} ${result.testName} (${priority}) - ${result.duration.toFixed(1)}s`);
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error.substring(0, 100)}${result.error.length > 100 ? '...' : ''}`);
      }
    });

    console.log('');
    
    // Display recommendations
    const recommendations = this.generateRecommendations();
    console.log('💡 RECOMMENDATIONS:');
    recommendations.forEach(rec => console.log(rec));
    
    console.log('\n' + '=' .repeat(80));
    
    if (failedTests === 0) {
      console.log('🎉 ALL TESTS PASSED! FP32 MODEL VALIDATION COMPLETE');
    } else {
      console.log(`⚠️  ${failedTests} TEST(S) FAILED - REVIEW REQUIRED`);
    }
    
    console.log('=' .repeat(80));
  }
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = {
    includeLowPriority: !args.includes('--skip-low'),
    verbose: !args.includes('--quiet'),
    generateReport: !args.includes('--no-report')
  };

  console.log('📱 whoBIRD FP32 Model Validation Suite');
  console.log('🔬 Testing BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite with embedded labels');
  console.log('');

  if (args.includes('--help')) {
    console.log('Usage: npm run test:whobird [options]');
    console.log('');
    console.log('Options:');
    console.log('  --skip-low    Skip low priority tests');
    console.log('  --quiet       Run tests with minimal output');
    console.log('  --no-report   Skip generating detailed report');
    console.log('  --help        Show this help message');
    console.log('');
    console.log('Test Suites:');
    TEST_SUITES.forEach((suite, index) => {
      console.log(`  ${index + 1}. ${suite.name} (${suite.priority})`);
      console.log(`     ${suite.description}`);
    });
    return;
  }

  const runner = new TestRunner();
  
  try {
    await runner.runAllTests(options);
  } catch (error) {
    console.error('💥 Test runner encountered a critical error:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { TestRunner, TEST_SUITES };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}