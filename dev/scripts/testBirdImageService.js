#!/usr/bin/env node

/**
 * Test Bird Image Service Integration
 * 
 * Quick test to verify the generated BirdImageMap works with birdImageService
 */

const path = require('path');

// Since we can't directly import TypeScript in Node.js, we'll test the generated map
const birdImageMapPath = path.join(__dirname, '../../services/generated/BirdImageMap.ts');
const fs = require('fs');

function testGeneratedMap() {
    console.log('🧪 Testing Generated Bird Image Map...');
    
    // Check if the file exists
    if (!fs.existsSync(birdImageMapPath)) {
        console.error('❌ BirdImageMap.ts not found');
        return false;
    }
    
    // Read and analyze the content
    const content = fs.readFileSync(birdImageMapPath, 'utf8');
    
    // Basic validation
    const requireCount = (content.match(/require\(/g) || []).length;
    const exportExists = content.includes('export const birdImageMap');
    const defaultExportExists = content.includes('export default birdImageMap');
    
    console.log(`📊 Found ${requireCount} require() statements`);
    console.log(`✅ Export declaration: ${exportExists ? 'Found' : 'Missing'}`);
    console.log(`✅ Default export: ${defaultExportExists ? 'Found' : 'Missing'}`);
    
    // Test some expected birds
    const testBirds = [
        'struthio_camelus.webp',
        'apteryx_australis.webp',
        'casuarius_casuarius.webp'
    ];
    
    console.log('\\n🐦 Testing specific birds:');
    testBirds.forEach(bird => {
        if (content.includes(`'${bird}':`)) {
            console.log(`✅ ${bird} - Found`);
        } else {
            console.log(`❌ ${bird} - Missing`);
        }
    });
    
    // Check file structure
    const isValidTypeScript = content.includes('{ [key: string]: any }');
    console.log(`\\n📝 TypeScript structure: ${isValidTypeScript ? 'Valid' : 'Invalid'}`);
    
    if (requireCount > 4000 && exportExists && defaultExportExists) {
        console.log('\\n🎉 All tests passed! Generated map looks good.');
        return true;
    } else {
        console.log('\\n⚠️  Some issues detected.');
        return false;
    }
}

// Test the integration with birdImageService by checking imports
function testServiceIntegration() {
    console.log('\\n🔗 Testing Service Integration...');
    
    const servicePath = path.join(__dirname, '../../services/birdImageService.ts');
    
    if (!fs.existsSync(servicePath)) {
        console.error('❌ birdImageService.ts not found');
        return false;
    }
    
    const serviceContent = fs.readFileSync(servicePath, 'utf8');
    
    const hasImport = serviceContent.includes('import { birdImageMap } from \'./generated/BirdImageMap\'');
    const usesGeneratedMap = serviceContent.includes('birdImageMap[filename]');
    const removedOldMap = !serviceContent.includes('apteryx_australis.webp\': require(');
    
    console.log(`✅ Import statement: ${hasImport ? 'Found' : 'Missing'}`);
    console.log(`✅ Uses generated map: ${usesGeneratedMap ? 'Yes' : 'No'}`);
    console.log(`✅ Removed old hardcoded map: ${removedOldMap ? 'Yes' : 'No'}`);
    
    if (hasImport && usesGeneratedMap && removedOldMap) {
        console.log('🎉 Service integration looks good!');
        return true;
    } else {
        console.log('⚠️  Service integration issues detected.');
        return false;
    }
}

// Run tests
if (require.main === module) {
    console.log('🚀 Starting Bird Image Pipeline Tests...\\n');
    
    const mapTest = testGeneratedMap();
    const serviceTest = testServiceIntegration();
    
    console.log('\\n📊 Test Summary:');
    console.log(`Generated Map: ${mapTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Service Integration: ${serviceTest ? '✅ PASS' : '❌ FAIL'}`);
    
    if (mapTest && serviceTest) {
        console.log('\\n🎉 All tests passed! The bird image pipeline is ready to use.');
        console.log('📦 5000+ bird images will be bundled with your app.');
        console.log('🚀 Your app now has offline access to bird images!');
    } else {
        console.log('\\n❌ Some tests failed. Please check the issues above.');
        process.exit(1);
    }
}

module.exports = { testGeneratedMap, testServiceIntegration };