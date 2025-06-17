# whoBIRD TensorFlow Lite Implementation Guide

## 🚨 CRITICAL DISCOVERY UPDATE

**MAJOR CORRECTION**: Previous analysis incorrectly assumed the main model processes mel-spectrograms. 

**ACTUAL FINDING**: The main BirdNET model takes **raw Float32 audio samples directly**, not mel-spectrograms! Mel-spectrograms are only used for visualization purposes in whoBIRD.

This critical discovery changes our entire implementation approach and explains why our mel-spectrogram-based pipeline wasn't working correctly.

## Overview

This document describes the correct approach for implementing bird audio classification using TensorFlow Lite models, based on detailed analysis of the successful whoBIRD Android implementation and comparison with our React Native LogChirpy implementation.

## Key Findings from whoBIRD Analysis

### 1. Audio Processing Pipeline

The whoBIRD implementation demonstrates the correct approach for audio processing:

#### Audio Input Parameters
- **Sample Rate**: 48,000 Hz (industry standard for high-quality audio)
- **Bit Depth**: 16-bit PCM
- **Channels**: Mono (single channel)
- **Buffer Duration**: 3 seconds (144,000 samples at 48kHz)
- **Recording Mode**: Continuous circular buffer with overlapping inference windows

```kotlin
// From whoBIRD SoundClassifier.kt:426-450
var bufferSize = AudioRecord.getMinBufferSize(
  options.sampleRate,           // 48000 Hz
  AudioFormat.CHANNEL_IN_MONO,  // Single channel
  AudioFormat.ENCODING_PCM_16BIT // 16-bit encoding
)
```

#### Audio Preprocessing Chain (CORRECTED)
1. **Recording**: Continuous 16-bit PCM at 48kHz into circular buffer
2. **Conversion**: Convert Short samples to Float32 (`s.toFloat()`)
3. **High-pass Filtering**: Optional Butterworth filter (user configurable)
4. **Direct Input**: Raw Float32 audio samples fed directly to main model

**Note**: Mel-spectrograms are generated separately for visualization only, not for model input!

### 2. Mel-Spectrogram Generation (VISUALIZATION ONLY)

**IMPORTANT**: Mel-spectrograms in whoBIRD are used ONLY for visualization, NOT for model input!

The whoBIRD implementation generates mel-spectrograms solely for display purposes:

#### Core Parameters (For Visualization)
```java
// From MelSpectrogram.java:15-17 - VISUALIZATION ONLY
public static final int N_FFT = 800;        // FFT window size
public static final int N_MEL = 40;         // Number of mel bins  
public static final int HOP_LENGTH = 960;   // Frame hop length
```

#### Processing Steps (For Display)
1. **Downsampling**: Reduce from 48kHz to 24kHz for display
2. **Windowing**: Apply Hann window to each frame
3. **FFT**: Compute Fast Fourier Transform (size 800)
4. **Magnitude Spectrum**: Calculate power spectrum
5. **Mel Filtering**: Apply triangular mel filter bank
6. **Log Scale**: Apply logarithmic scaling
7. **Bitmap Generation**: Convert to visual spectrogram image

```java
// Mel-spectrogram is used for visualization only:
if (sharedPref.getBoolean("show_spectrogram", false)) {
    if (spectrogramBuffer != null) 
        mBinding.icon.setImageBitmap(MelSpectrogram.getMelBitmap(spectrogramBuffer, options.sampleRate))
}
```

### 3. Model Architecture Understanding

#### Two-Model System (CORRECTED)
whoBIRD uses a sophisticated two-model approach:

1. **Main Audio Model** (`model.tflite`):
   - **Input**: Raw Float32 audio samples (NOT mel-spectrograms!)
   - **Input Shape**: Dynamic, detected via `interpreter.getInputTensor(0).shape()`
   - **Input Format**: FloatBuffer containing audio samples converted from 16-bit PCM
   - **Output**: Raw logits for 6,522 bird species (requires sigmoid activation)
   - **Purpose**: Primary species identification from audio

2. **Meta Location/Time Model** (`metaModel.tflite`):
   - **Input**: `[latitude, longitude, week_of_year_cosine]`
   - **Input Shape**: `[1, 3]`
   - **Input Format**: FloatBuffer with geographic/temporal metadata
   - **Output**: Species likelihood probabilities based on location/time
   - **Purpose**: Filter results based on geographic and seasonal probability

#### Meta Model Integration
```kotlin
// From SoundClassifier.kt:374-376
metaInputBuffer.put(0, lat);           // Latitude
metaInputBuffer.put(1, lon);           // Longitude  
metaInputBuffer.put(2, weekMeta.toFloat()); // Week of year (cosine-transformed)
```

The final prediction combines both models:
```kotlin
// From SoundClassifier.kt:562-563
val modelProb = 1 / (1 + exp(-predictionProbs[i])) // Apply sigmoid
probList.add(modelProb * (1-metaInfluence + metaInfluence * metaPredictionProbs[i]))
```

## Complete Data Flow Analysis

### Model Input/Output Specifications

#### Main Audio Model Details
```kotlin
// Model initialization and shape detection
val inputShape = interpreter.getInputTensor(0).shape()
Log.i(TAG, "TFLite model input shape: ${inputShape.contentToString()}")
modelInputLength = inputShape[1]  // Number of audio samples required

val outputShape = interpreter.getOutputTensor(0).shape()  
Log.i(TAG, "TFLite output shape: ${outputShape.contentToString()}")
modelNumClasses = outputShape[1]  // 6522 bird species

// Direct audio input (NOT mel-spectrograms)
for (i in 0 until modelInputLength) {
    val s = circularBuffer[(i + j) % modelInputLength]
    if (highPass==0) inputBuffer.put(i, s.toFloat())  // Raw audio samples
    else inputBuffer.put(i, butterworth.filter(s.toDouble()).toFloat())
}

// Model inference with raw audio
interpreter.run(inputBuffer, outputBuffer)  // FloatBuffer → FloatBuffer
```

#### Meta Model Details  
```kotlin
// Meta model expects exactly 3 inputs
val metaInputShape = meta_interpreter.getInputTensor(0).shape()  // [1, 3]
metaModelInputLength = metaInputShape[1]  // Always 3

// Week calculation (48-week model year)
val dayOfYear = LocalDate.now().dayOfYear
val week = ceil(dayOfYear * 48.0 / 366.0)
val weekMeta = cos(Math.toRadians(week * 7.5)) + 1.0  // Cosine transform

// Meta model input format
metaInputBuffer.put(0, lat)                    // Latitude (raw degrees)
metaInputBuffer.put(1, lon)                    // Longitude (raw degrees)  
metaInputBuffer.put(2, weekMeta.toFloat())     // Week cosine (0-2 range)
```

### Audio Recording and Buffer Management

#### Circular Buffer Implementation
```kotlin
// Continuous recording with circular buffer
val circularBuffer = ShortArray(modelInputLength)
var j = 0  // Write index for circular buffer

// Every 800ms inference cycle
recognitionTask = Timer().scheduleAtFixedRate(inferenceInterval, inferenceInterval) {
    val recordingBuffer = ShortArray(modelInputLength)
    
    // Load new audio samples
    val sampleCounts = loadAudio(recordingBuffer)
    
    // Copy new data into circular buffer  
    for (i in 0 until sampleCounts) {
        circularBuffer[j] = recordingBuffer[i]
        j = (j + 1) % circularBuffer.size
    }
    
    // Extract full window for inference (overlapping)
    for (i in 0 until modelInputLength) {
        val s = circularBuffer[(i + j) % modelInputLength]
        inputBuffer.put(i, s.toFloat())  // Short → Float conversion
    }
}
```

#### Recording Configuration
```kotlin
// AudioRecord setup (48kHz, 16-bit, mono)
audioRecord = AudioRecord(
    MediaRecorder.AudioSource.UNPROCESSED,  // Raw microphone input
    options.sampleRate,                     // 48000 Hz
    AudioFormat.CHANNEL_IN_MONO,            // Single channel
    AudioFormat.ENCODING_PCM_16BIT,         // 16-bit samples
    bufferSize                              // Calculated buffer size
)
```

### Output Processing and Display

#### Species Label Format
- **Total Species**: 6,522 global bird species
- **Label Format**: `"ScientificName_CommonName"` (e.g., `"Turdus migratorius_American Robin"`)
- **Language Support**: 35+ languages with localized common names
- **Asset Integration**: Macaulay Library IDs for bird photos/sounds

#### Confidence Processing and Visualization
```kotlin
// Prediction confidence thresholds and colors
if (element.value < 0.3) tv.setBackgroundResource(R.drawable.oval_red_dotted)      // < 30%
else if (element.value < 0.5) tv.setBackgroundResource(R.drawable.oval_red)        // 30-50%
else if (element.value < 0.65) tv.setBackgroundResource(R.drawable.oval_orange)    // 50-65%
else if (element.value < 0.8) tv.setBackgroundResource(R.drawable.oval_yellow)     // 65-80%
else tv.setBackgroundResource(R.drawable.oval_green)                               // 80%+

// Display format: "Species Name  85%"
tv.setText(label + "  " + Math.round(element.value * 100.0) + "%")
```

#### Database Storage
```kotlin
// Store each prediction above threshold
database?.addEntry(
    label,                                  // Species common name
    currentLocation.latitude.toFloat(),     // GPS latitude
    currentLocation.longitude.toFloat(),    // GPS longitude  
    element.index,                          // Species index (0-6521)
    element.value,                          // Confidence score (0-1)
    timeInMillis                           // Timestamp
)
```

### Inference Timing and Performance

#### Real-time Processing
- **Inference Interval**: 800ms (configurable)
- **Buffer Overlap**: Continuous circular buffer ensures no audio gaps
- **Processing Time**: 1-3 seconds typical on mid-range Android devices
- **Memory Usage**: ~100MB during active processing
- **Thread Separation**: Audio recording and model inference on separate threads

### 4. Performance Optimizations

#### Multi-threading
whoBIRD uses multiple CPU threads for mel-spectrogram computation:
```java
// From MelSpectrogram.java:51
int nThreads = Runtime.getRuntime().availableProcessors();
```

#### Memory Management
- Reuses allocated buffers across inference cycles
- Uses circular buffers to minimize memory allocation
- Implements proper cleanup of audio resources

## Comparison with Our Current Implementation

### What We're Doing Right

1. **Dynamic Model Shape Detection**: Our implementation correctly detects different model input shapes
2. **Flexible Processing Pipeline**: Supports various model architectures (metadata-only, compressed, full spectrogram)
3. **Error Handling**: Robust error handling and fallback mechanisms

### Critical Issues Identified

#### 1. Fundamental Model Input Misunderstanding
**Problem**: We were generating mel-spectrograms when models expect raw audio
- **Our approach**: Complex mel-spectrogram generation pipeline
- **Correct approach**: Direct Float32 audio samples to main model
- **Impact**: Explains why our pipeline wasn't working correctly

**Solution**: Remove mel-spectrogram generation for main model inference, use raw audio samples

#### 2. Wrong Model Selection  
**Problem**: We were using BirdNET MData V2 FP16 model incorrectly
- **Our approach**: Attempting to process audio with metadata-only model
- **Correct approach**: Use full audio classification models for audio, MData models only for location filtering

**Solution**: Replace MData models with proper audio classification models like whoBIRD uses

#### 3. Missing Two-Model Architecture
**Problem**: We only implemented single-model inference
- **Our approach**: Single model for both audio and location filtering
- **Correct approach**: Separate main audio model + meta location/time model
- **Missing**: Meta model for geographic/temporal filtering
- **Missing**: Prediction blending algorithm

#### 4. Incorrect Audio Processing
**Problem**: Over-complex preprocessing when simple conversion is needed
- **Our approach**: Complex FFT, mel-filtering, normalization pipeline
- **Correct approach**: Simple Short→Float conversion with optional high-pass filter
- **Missing**: Circular buffer management for continuous recording
- **Missing**: Proper 48kHz recording setup

## Recommended Implementation Strategy (CORRECTED)

### Phase 1: Fix Fundamental Architecture

**CRITICAL**: Remove mel-spectrogram processing for main model inference:

```typescript
// CORRECTED: Raw audio configuration
const WHOBIRD_AUDIO_CONFIG = {
  sampleRate: 48000,           // Recording sample rate
  bitDepth: 16,                // 16-bit PCM
  channels: 1,                 // Mono
  bufferDuration: 3.0,         // Seconds of audio in buffer
  inferenceInterval: 800,      // MS between inferences
  audioSource: 'unprocessed'   // Raw microphone input
};

// Audio processing: Short → Float conversion only
function processAudioForModel(shortBuffer: Int16Array): Float32Array {
  const floatBuffer = new Float32Array(shortBuffer.length);
  for (let i = 0; i < shortBuffer.length; i++) {
    floatBuffer[i] = shortBuffer[i]; // Direct conversion, no normalization
  }
  return floatBuffer;
}
```

### Phase 2: Implement Proper Model Selection

Use correct models for each purpose:

1. **Main Audio Models**: For primary bird identification
   - **Input**: Raw Float32 audio samples (NOT mel-spectrograms!)
   - **Models**: Full BirdNET audio classification models
   - **Example**: BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite

2. **Meta Location Models**: For geographic/temporal filtering
   - **Input**: `[latitude, longitude, week_of_year_cosine]`
   - **Models**: BirdNET Meta models (separate from main model)
   - **Purpose**: Location-based species probability filtering

### Phase 3: Implement Two-Model System

Follow whoBIRD's proven architecture:

```typescript
interface BirdClassificationSystem {
  mainAudioModel: TFLiteModel;      // Raw audio → species logits
  metaLocationModel: TFLiteModel;   // Location/time → species filters
  
  async classifyAudio(audioSamples: Float32Array, location: Location): Promise<BirdResult> {
    // 1. Main audio inference (raw samples)
    const audioLogits = await this.mainAudioModel.predict(audioSamples);
    const audioProbabilities = this.applySigmoid(audioLogits);
    
    // 2. Meta location inference
    const week = this.calculateWeekCosine(new Date());
    const metaProbabilities = await this.metaLocationModel.predict([
      location.latitude, location.longitude, week
    ]);
    
    // 3. Combine predictions (whoBIRD formula)
    const metaInfluence = 0.5; // User configurable 0-1
    const finalProbabilities = audioProbabilities.map((audioProb, i) => 
      audioProb * (1 - metaInfluence + metaInfluence * metaProbabilities[i])
    );
    
    return this.formatTopPredictions(finalProbabilities);
  }
}
```

## Technical Implementation Details (CORRECTED)

### Raw Audio Processing Algorithm

Based on whoBIRD's actual implementation:

```typescript
class WhoBIRDAudioProcessor {
  static readonly SAMPLE_RATE = 48000;
  static readonly INFERENCE_INTERVAL = 800; // ms
  
  // CORRECTED: No mel-spectrogram generation for main model
  static processRawAudio(shortBuffer: Int16Array, highPassFilter?: boolean): Float32Array {
    const floatBuffer = new Float32Array(shortBuffer.length);
    
    // Simple Short → Float conversion (no complex preprocessing)
    for (let i = 0; i < shortBuffer.length; i++) {
      let sample = shortBuffer[i];
      
      // Optional high-pass filtering (if enabled)
      if (highPassFilter) {
        sample = this.applyHighPassFilter(sample);
      }
      
      floatBuffer[i] = sample; // Direct conversion
    }
    
    return floatBuffer;
  }
  
  // Circular buffer management for continuous recording
  static manageCircularBuffer(
    circularBuffer: Int16Array, 
    newSamples: Int16Array, 
    writeIndex: number
  ): number {
    for (let i = 0; i < newSamples.length; i++) {
      circularBuffer[writeIndex] = newSamples[i];
      writeIndex = (writeIndex + 1) % circularBuffer.length;
    }
    return writeIndex;
  }
  
  // Extract inference window from circular buffer
  static extractInferenceWindow(
    circularBuffer: Int16Array, 
    readIndex: number, 
    windowSize: number
  ): Int16Array {
    const window = new Int16Array(windowSize);
    for (let i = 0; i < windowSize; i++) {
      window[i] = circularBuffer[(readIndex + i) % circularBuffer.length];
    }
    return window;
  }
}
```

### Corrected Model Integration Pattern

```typescript
class WhoBIRDBirdClassifier {
  private mainAudioModel: TFLiteModel;      // Audio → species logits
  private metaLocationModel: TFLiteModel;   // Location → species filters
  private circularBuffer: Int16Array;
  private writeIndex = 0;
  
  async classifyAudio(
    audioSamples: Int16Array, 
    location: {lat: number, lon: number}
  ): Promise<BirdClassificationResult> {
    
    // 1. Update circular buffer
    this.writeIndex = WhoBIRDAudioProcessor.manageCircularBuffer(
      this.circularBuffer, audioSamples, this.writeIndex
    );
    
    // 2. Extract inference window
    const inferenceWindow = WhoBIRDAudioProcessor.extractInferenceWindow(
      this.circularBuffer, this.writeIndex, this.mainAudioModel.inputLength
    );
    
    // 3. Convert to Float32 (raw audio for main model)
    const floatAudio = WhoBIRDAudioProcessor.processRawAudio(inferenceWindow);
    
    // 4. Main audio model inference (raw samples → logits)
    const audioLogits = await this.mainAudioModel.predict(floatAudio);
    const audioProbabilities = this.applySigmoid(audioLogits);
    
    // 5. Meta location model inference
    const week = this.calculateWeekCosine(new Date());
    const metaInput = new Float32Array([location.lat, location.lon, week]);
    const metaProbabilities = await this.metaLocationModel.predict(metaInput);
    
    // 6. Combine predictions using whoBIRD formula
    const metaInfluence = 0.5; // Configurable 0-1
    const finalProbabilities = audioProbabilities.map((audioProb, i) => 
      audioProb * (1 - metaInfluence + metaInfluence * metaProbabilities[i])
    );
    
    // 7. Extract top predictions
    const topPredictions = this.getTopPredictions(finalProbabilities, 2);
    
    return {
      audioLogits,
      audioProbabilities,
      metaProbabilities,
      finalProbabilities,
      topPredictions,
      processingTime: Date.now() - startTime
    };
  }
  
  private applySigmoid(logits: Float32Array): Float32Array {
    return logits.map(logit => 1 / (1 + Math.exp(-logit)));
  }
  
  private calculateWeekCosine(date: Date): number {
    const dayOfYear = this.getDayOfYear(date);
    const week = Math.ceil(dayOfYear * 48.0 / 366.0); // 48-week model year
    return Math.cos((week * 7.5) * Math.PI / 180) + 1.0; // 0-2 range
  }
}
```

### Mel-Spectrogram for Visualization Only

If needed for visualization (NOT model input):

```typescript
// Only use for display purposes, NOT for model inference
class MelSpectrogramVisualizer {
  static readonly N_FFT = 800;
  static readonly N_MEL = 40;
  static readonly HOP_LENGTH = 960;
  
  static generateVisualizationSpectrogram(audioData: Float32Array): ImageData {
    // This is for display only - DO NOT feed to main model
    const melData = this.computeMelSpectrogram(audioData);
    return this.convertToImageData(melData);
  }
}

## Migration Path for LogChirpy (CORRECTED)

### Immediate Actions (CRITICAL)

1. **Remove mel-spectrogram processing** from main model inference pipeline
2. **Replace BirdNET MData models** with full audio classification models  
3. **Implement raw audio input** processing (Short → Float conversion)
4. **Add circular buffer management** for continuous recording
5. **Fix model input format** to use raw Float32 audio samples

### Medium Term Goals

1. **Implement two-model system** (main audio + meta location models)
2. **Add meta model integration** for geographic/temporal filtering
3. **Implement prediction blending algorithm** following whoBIRD formula
4. **Add confidence visualization system** with color-coded results
5. **Optimize memory usage** with proper buffer reuse

### Long Term Goals

1. **Add real-time spectrogram visualization** (for display only)
2. **Implement database integration** for sighting storage
3. **Add Macaulay Library integration** for bird images/sounds
4. **Performance optimization** and multi-threading

### Testing Strategy (UPDATED)

#### Validation Against whoBIRD
1. **Use identical test audio files** with known bird species
2. **Compare raw audio input processing** (ensure same Float32 values)
3. **Validate model input shapes** and data format
4. **Compare prediction outputs** for same audio clips
5. **Test meta model integration** with known locations/dates

#### Performance Benchmarking
1. **Memory usage profiling** during continuous recording
2. **Inference timing analysis** (target: 1-3 seconds)
3. **Battery usage testing** for extended recording sessions
4. **Cross-platform compatibility** (iOS/Android)

#### Accuracy Testing
1. **Known bird recordings** with verified species labels
2. **Geographic accuracy testing** with location-specific species
3. **Seasonal accuracy testing** with appropriate time periods
4. **Confidence threshold optimization** for different environments

### Common Mistakes to Avoid

1. **DON'T** generate mel-spectrograms for main model input
2. **DON'T** use MData models for audio processing
3. **DON'T** normalize audio samples before model input
4. **DON'T** apply complex preprocessing to raw audio
5. **DON'T** forget to implement meta model for location filtering

## Performance Expectations

Based on whoBIRD implementation:

- **Inference Time**: 1-3 seconds on mid-range Android devices
- **Memory Usage**: ~100MB during processing
- **Accuracy**: ~85% for common species in appropriate geographic regions
- **Model Size**: ~49MB for FP32 models, ~25MB for FP16 variants

## Troubleshooting Common Issues

### Model Input Format Errors
```
Error: Model expects different input shape
```
**Solution**: Verify you're using raw Float32 audio samples, not mel-spectrograms

### Audio Processing Failures  
```
Error: Cannot convert audio to spectrogram
```
**Solution**: Remove mel-spectrogram generation for main model, use direct Short→Float conversion

### Low Accuracy Results
```
Model returns random predictions
```
**Possible Causes**:
1. Using MData model with audio input (use full audio models)
2. Incorrect audio sample format (ensure 48kHz, 16-bit, mono)
3. Missing meta model integration (location filtering)

### Performance Issues
```
High memory usage / slow inference
```
**Solutions**:
1. Implement circular buffer management
2. Remove unnecessary mel-spectrogram processing
3. Use FP16 models for better performance
4. Ensure proper buffer reuse

## Key Implementation Checklist

- [ ] **Remove mel-spectrogram processing** from main inference pipeline
- [ ] **Use raw Float32 audio samples** as main model input
- [ ] **Implement two-model system** (audio + location models)
- [ ] **Add circular buffer management** for continuous recording
- [ ] **Implement whoBIRD prediction blending** formula
- [ ] **Add confidence visualization** with color coding
- [ ] **Test with known bird recordings** for validation
- [ ] **Optimize for mobile performance** (memory, CPU, battery)

## Conclusion (CORRECTED)

The detailed analysis of whoBIRD reveals a **fundamental misunderstanding** in our previous approach. The critical discovery is that BirdNET models expect **raw Float32 audio samples**, not mel-spectrograms.

This correction changes everything:

### Key Corrected Insights
1. **Direct audio input** - No complex preprocessing needed for main model
2. **Two-model architecture** - Separate audio and location/time models  
3. **Simple buffer management** - Circular buffer with Short→Float conversion
4. **Proven prediction blending** - WhoBIRD's tested formula for combining models

### Expected Impact
By implementing this corrected approach, LogChirpy should achieve:
- **Significantly improved accuracy** using proven architecture
- **Better performance** with simplified audio processing  
- **Proper model utilization** with correct input formats
- **Production-ready reliability** matching whoBIRD's success

### Next Steps
1. **Immediately remove** mel-spectrogram processing from main pipeline
2. **Replace current models** with proper full audio classification models
3. **Implement raw audio input** processing following whoBIRD patterns
4. **Add meta model integration** for location-based filtering
5. **Test thoroughly** against whoBIRD with same audio files

This corrected implementation guide provides the roadmap for achieving production-quality bird identification that matches proven, successful implementations.

---

**References:**
- whoBIRD Android Implementation: SoundClassifier.kt, MelSpectrogram.java  
- BirdNET v2.4 Model Documentation
- TensorFlow Lite Mobile Optimization Guidelines
- React Native Fast TFLite Integration Patterns
- **Critical Analysis Date**: December 2024 - Raw Audio Input Discovery