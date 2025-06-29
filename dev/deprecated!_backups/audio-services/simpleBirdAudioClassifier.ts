/**
 * Simple Bird Audio Classifier - Production Ready
 * 
 * This is a simplified, hardcoded implementation that follows the
 * ULTIMATE_AUDIO_MODEL_IMPLEMENTATION_GUIDE.md exactly.
 * 
 * Key principles:
 * - Raw Float32 audio samples as input (NOT spectrograms)
 * - Two-model architecture: Main audio + Meta location
 * - Simple function interface: just pass audio recording and get results
 * - No overcomplications, no scalability - just one working pipeline
 */

import { fastTfliteBirdClassifier } from './fastTfliteBirdClassifier';
import { AudioPreprocessingTFLite } from './audioPreprocessingTFLite';

export interface SimpleBirdPrediction {
  species: string;
  scientificName: string;
  confidence: number;
}

export interface SimpleBirdResult {
  predictions: SimpleBirdPrediction[];
  processingTimeMs: number;
  success: boolean;
  error?: string;
}

/**
 * Simple Bird Audio Classification Pipeline
 * 
 * This is the ONE function you need to classify bird audio.
 * Pass in an audio file path and optional location, get predictions back.
 * 
 * @param audioFilePath - Path to audio file (WAV, MP3, M4A)
 * @param location - Optional GPS location for better accuracy
 * @returns Promise<SimpleBirdResult> - Bird predictions
 */
export async function classifyBirdAudio(
  audioFilePath: string,
  location?: { latitude: number; longitude: number }
): Promise<SimpleBirdResult> {
  const startTime = Date.now();
  
  try {
    console.log('🐦 Starting simple bird audio classification...');
    console.log(`📁 Audio file: ${audioFilePath}`);
    console.log(`📍 Location: ${location ? `${location.latitude}, ${location.longitude}` : 'Not provided'}`);
    
    // Step 1: Initialize the classifier if not already done
    if (!fastTfliteBirdClassifier.isReady()) {
      console.log('🔧 Initializing bird classifier...');
      const initialized = await fastTfliteBirdClassifier.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize bird classifier');
      }
      console.log('✅ Bird classifier initialized');
    }
    
    // Step 2: Process audio to raw Float32 samples (following the guide exactly)
    console.log('🎵 Processing audio to raw Float32 samples...');
    const processedAudio = await AudioPreprocessingTFLite.processAudioFile(audioFilePath);
    
    if (processedAudio.metadata.processingType !== 'raw_audio') {
      console.warn('⚠️ Audio was not processed as raw audio - this may affect accuracy');
    }
    
    console.log(`✅ Audio processed: ${processedAudio.processedData.length} samples (${processedAudio.metadata.duration}s)`);
    
    // Step 3: Update location metadata for meta model if provided
    if (location) {
      console.log('📍 Updating location metadata for meta model...');
      AudioPreprocessingTFLite.updateLocationMetadata(location.latitude, location.longitude);
    }
    
    // Step 4: Run classification with two-model architecture
    console.log('🧠 Running bird classification (main + meta model)...');
    const classificationResult = await fastTfliteBirdClassifier.classifyBirdAudio(
      processedAudio.processedData,
      audioFilePath,
      location
    );
    
    // Step 5: Format results
    const predictions: SimpleBirdPrediction[] = classificationResult.results.map(result => ({
      species: result.species,
      scientificName: result.scientificName,
      confidence: result.confidence
    }));
    
    const processingTimeMs = Date.now() - startTime;
    
    console.log(`✅ Classification complete in ${processingTimeMs}ms`);
    console.log(`🎯 Found ${predictions.length} predictions`);
    if (predictions.length > 0) {
      console.log(`🥇 Top result: ${predictions[0].species} (${Math.round(predictions[0].confidence * 100)}%)`);
    }
    
    return {
      predictions,
      processingTimeMs,
      success: true
    };
    
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('❌ Bird classification failed:', errorMessage);
    
    return {
      predictions: [],
      processingTimeMs,
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Initialize the bird classification system
 * Call this once at app startup
 */
export async function initializeBirdClassifier(): Promise<boolean> {
  try {
    console.log('🚀 Initializing bird classification system...');
    
    const initialized = await fastTfliteBirdClassifier.initialize();
    
    if (initialized) {
      console.log('✅ Bird classification system ready');
      console.log(`🏷️ Labels loaded: ${fastTfliteBirdClassifier.isReady() ? 'Yes' : 'No'}`);
      console.log(`🎯 Main model: ${fastTfliteBirdClassifier.isMainModelReady() ? 'Ready' : 'Not ready'}`);
      console.log(`📍 Meta model: ${fastTfliteBirdClassifier.isMetaModelReady() ? 'Ready' : 'Not ready'}`);
    } else {
      console.error('❌ Failed to initialize bird classification system');
    }
    
    return initialized;
  } catch (error) {
    console.error('❌ Bird classification initialization error:', error);
    return false;
  }
}

/**
 * Quick test function to verify the system works
 * Pass a known bird audio file to test
 */
export async function testBirdClassifier(testAudioPath: string): Promise<void> {
  console.log('🧪 Testing bird classifier...');
  
  const result = await classifyBirdAudio(testAudioPath, {
    latitude: 40.7128, // New York City coordinates
    longitude: -74.0060
  });
  
  if (result.success) {
    console.log('✅ Test successful!');
    console.log(`⏱️ Processing time: ${result.processingTimeMs}ms`);
    console.log(`🎯 Predictions: ${result.predictions.length}`);
    
    result.predictions.forEach((pred, index) => {
      console.log(`  ${index + 1}. ${pred.species} (${Math.round(pred.confidence * 100)}%)`);
    });
  } else {
    console.error('❌ Test failed:', result.error);
  }
}

/**
 * Get system status - useful for debugging
 */
export function getBirdClassifierStatus(): {
  ready: boolean;
  mainModelReady: boolean;
  metaModelReady: boolean;
  currentModel: string;
} {
  return {
    ready: fastTfliteBirdClassifier.isReady(),
    mainModelReady: fastTfliteBirdClassifier.isMainModelReady(),
    metaModelReady: fastTfliteBirdClassifier.isMetaModelReady(),
    currentModel: fastTfliteBirdClassifier.getCurrentModelType()
  };
}

// Export the main function as default for easy imports
export default classifyBirdAudio;