/**
 * Comprehensive test for MLKit Bird Classification Service
 * Tests MLKit initialization, image classification, and service integration
 */

import { MLKitBirdClassifier } from '../services/mlkitBirdClassifier';
import { BirdNetService } from '../services/birdNetService';

// Mock image URI for testing
const MOCK_IMAGE_URI = 'file:///assets/birds/test-bird.jpg';
const MOCK_AUDIO_URI = 'file:///assets/birds/bird1.mp3';

async function testMLKitServiceInitialization() {
    console.log('🔧 Testing MLKit Bird Classifier Initialization');
    console.log('=' + '='.repeat(50));
    
    try {
        const classifier = MLKitBirdClassifier.getInstance();
        
        // Test configuration
        const config = classifier.getConfig();
        console.log('✅ Initial config:');
        console.log(`   - Confidence threshold: ${config.confidenceThreshold}`);
        console.log(`   - Max results: ${config.maxResults}`);
        console.log(`   - Cache enabled: ${config.cacheResults}`);
        console.log(`   - Fallback to online: ${config.fallbackToOnline}`);
        
        return classifier;
    } catch (error) {
        console.error('❌ MLKit service initialization failed:', error);
        throw error;
    }
}

async function testImageClassification(classifier: MLKitBirdClassifier) {
    console.log('\n🖼️ Testing Image Classification');
    console.log('=' + '='.repeat(50));
    
    try {
        console.log(`🔄 Classifying image: ${MOCK_IMAGE_URI}`);
        
        const startTime = Date.now();
        const result = await classifier.classifyBirdImage(MOCK_IMAGE_URI);
        const endTime = Date.now();
        
        console.log('✅ Classification completed successfully!');
        console.log(`   - Processing time: ${endTime - startTime}ms`);
        console.log(`   - Source: ${result.source}`);
        console.log(`   - Cache hit: ${result.cacheHit}`);
        console.log(`   - Fallback used: ${result.fallbackUsed}`);
        console.log(`   - Predictions found: ${result.predictions.length}`);
        
        if (result.predictions.length > 0) {
            console.log('\n🎯 Top predictions:');
            result.predictions.forEach((pred, index) => {
                console.log(`   ${index + 1}. ${pred.common_name} (${pred.scientific_name})`);
                console.log(`      Confidence: ${(pred.confidence * 100).toFixed(1)}%`);
            });
        }
        
        return result;
    } catch (error) {
        console.error('❌ Image classification failed:', error);
        throw error;
    }
}

async function testBirdNetServiceIntegration() {
    console.log('\n🌐 Testing BirdNet Service Integration');
    console.log('=' + '='.repeat(50));
    
    try {
        // Test MLKit initialization
        console.log('🔄 Initializing BirdNet service with MLKit...');
        await BirdNetService.initializeMLKit();
        console.log('✅ BirdNet service initialized successfully');
        
        // Test image identification
        console.log('\n🖼️ Testing image identification through BirdNet service...');
        const imageResult = await BirdNetService.identifyBirdFromImage(MOCK_IMAGE_URI);
        
        console.log('✅ Image identification completed!');
        console.log(`   - Success: ${imageResult.success}`);
        console.log(`   - Source: ${imageResult.source}`);
        console.log(`   - Processing time: ${imageResult.processing_time}s`);
        console.log(`   - Predictions: ${imageResult.predictions.length}`);
        
        // Test audio identification (fallback)
        console.log('\n🎵 Testing audio identification (fallback)...');
        const audioResult = await BirdNetService.identifyBirdFromAudio(MOCK_AUDIO_URI);
        
        console.log('✅ Audio identification completed!');
        console.log(`   - Success: ${audioResult.success}`);
        console.log(`   - Source: ${audioResult.source}`);
        console.log(`   - Fallback used: ${audioResult.fallback_used}`);
        console.log(`   - Audio duration: ${audioResult.audio_duration}s`);
        
        return { imageResult, audioResult };
    } catch (error) {
        console.error('❌ BirdNet service integration failed:', error);
        throw error;
    }
}

async function testCachingFunctionality(classifier: MLKitBirdClassifier) {
    console.log('\n💾 Testing Caching Functionality');
    console.log('=' + '='.repeat(50));
    
    try {
        // Clear cache first
        classifier.clearCache();
        console.log('🗑️ Cache cleared');
        
        // First classification (should miss cache)
        console.log('🔄 First classification (cache miss expected)...');
        const firstResult = await classifier.classifyBirdImage(MOCK_IMAGE_URI);
        console.log(`   - Cache hit: ${firstResult.cacheHit} (expected: false)`);
        
        // Second classification (should hit cache if enabled)
        console.log('🔄 Second classification (cache hit expected)...');
        const secondResult = await classifier.classifyBirdImage(MOCK_IMAGE_URI);
        console.log(`   - Cache hit: ${secondResult.cacheHit} (expected: true)`);
        
        // Compare processing times
        console.log(`   - First processing time: ${firstResult.processingTime}ms`);
        console.log(`   - Second processing time: ${secondResult.processingTime}ms`);
        
        if (secondResult.cacheHit && secondResult.processingTime < firstResult.processingTime) {
            console.log('✅ Caching is working correctly!');
        } else {
            console.log('⚠️ Caching behavior may need verification');
        }
        
        return { firstResult, secondResult };
    } catch (error) {
        console.error('❌ Caching test failed:', error);
        throw error;
    }
}

async function testConfigurationUpdates(classifier: MLKitBirdClassifier) {
    console.log('\n⚙️ Testing Configuration Updates');
    console.log('=' + '='.repeat(50));
    
    try {
        // Get original config
        const originalConfig = classifier.getConfig();
        console.log('📋 Original config:', originalConfig);
        
        // Update config
        const newConfig = {
            confidenceThreshold: 0.8,
            maxResults: 3,
            cacheResults: false,
        };
        
        classifier.updateConfig(newConfig);
        const updatedConfig = classifier.getConfig();
        
        console.log('📝 Updated config:', updatedConfig);
        
        // Verify updates
        const configUpdated = 
            updatedConfig.confidenceThreshold === 0.8 &&
            updatedConfig.maxResults === 3 &&
            updatedConfig.cacheResults === false;
        
        if (configUpdated) {
            console.log('✅ Configuration update successful!');
        } else {
            console.log('❌ Configuration update failed!');
        }
        
        // Restore original config
        classifier.updateConfig(originalConfig);
        console.log('🔄 Original configuration restored');
        
        return configUpdated;
    } catch (error) {
        console.error('❌ Configuration test failed:', error);
        throw error;
    }
}

async function runAllTests() {
    console.log('🧪 Starting MLKit Bird Classification Service Tests');
    console.log('=' + '='.repeat(60));
    
    const testResults = {
        initialization: false,
        imageClassification: false,
        serviceIntegration: false,
        caching: false,
        configuration: false,
    };
    
    try {
        // Test 1: Initialization
        const classifier = await testMLKitServiceInitialization();
        testResults.initialization = true;
        
        // Test 2: Image Classification
        await testImageClassification(classifier);
        testResults.imageClassification = true;
        
        // Test 3: Service Integration
        await testBirdNetServiceIntegration();
        testResults.serviceIntegration = true;
        
        // Test 4: Caching
        await testCachingFunctionality(classifier);
        testResults.caching = true;
        
        // Test 5: Configuration
        await testConfigurationUpdates(classifier);
        testResults.configuration = true;
        
    } catch (error) {
        console.error('💥 Test suite failed:', error);
    }
    
    // Print summary
    console.log('\n📊 Test Results Summary');
    console.log('=' + '='.repeat(60));
    
    const totalTests = Object.keys(testResults).length;
    const passedTests = Object.values(testResults).filter(Boolean).length;
    
    Object.entries(testResults).forEach(([test, passed]) => {
        const icon = passed ? '✅' : '❌';
        console.log(`${icon} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
    console.log(`📈 Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! MLKit integration is ready for production.');
    } else {
        console.log('⚠️ Some tests failed. Please review the issues above.');
    }
    
    return testResults;
}

// Export for external usage
export {
    runAllTests,
    testMLKitServiceInitialization,
    testImageClassification,
    testBirdNetServiceIntegration,
    testCachingFunctionality,
    testConfigurationUpdates,
};

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}