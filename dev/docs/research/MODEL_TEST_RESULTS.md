# TFLite Model Properties Test Results

This document contains the comprehensive test results for all TFLite models in the LogChirpy project, analyzing their architecture, performance, and implementation requirements.

## Summary

Successfully tested **6/6 models**. All models loaded successfully and were analyzed for their input/output specifications.

## Model Test Results

### 1. Regular Audio FP32
- **Type**: Audio
- **Quantization**: FP32
- **File Size**: 49.33 MB
- **Loading Time**: 83.50ms
- **Input**: 
  - Shape: [1, 144000]
  - Type: 🎵 RAW AUDIO
  - Format: Float32 audio samples (48000Hz, 3.0s)
  - Memory: 0.55MB
- **Output**:
  - Shape: [1, 6522]
  - Type: 🐦 SPECIES CLASSIFICATIONS (6522 species)
  - Format: Raw logits (need sigmoid activation)
  - Memory: 0.02MB
- **Inference Time**: 76.56ms

### 2. Regular Audio FP16
- **Type**: Audio
- **Quantization**: FP16
- **File Size**: 24.73 MB (50% smaller than FP32)
- **Loading Time**: 83.25ms
- **Input**: 
  - Shape: [1, 144000]
  - Type: 🎵 RAW AUDIO
  - Format: Float32 audio samples (48000Hz, 3.0s)
  - Memory: 0.55MB
- **Output**:
  - Shape: [1, 6522]
  - Type: 🐦 SPECIES CLASSIFICATIONS (6522 species)
  - Format: Raw logits (need sigmoid activation)
  - Memory: 0.02MB
- **Inference Time**: 196.87ms

### 3. MData FP16
- **Type**: Metadata
- **Quantization**: FP16
- **File Size**: 6.74 MB (smallest model)
- **Loading Time**: 25.97ms
- **Input**:
  - Shape: [1, 3]
  - Type: 🎯 METADATA (lat, lng, time)
  - Format: Geographic coordinates + temporal data
  - Memory: 0.00MB
- **Output**:
  - Shape: [1, 6522]
  - Type: 🐦 SPECIES CLASSIFICATIONS (6522 species)
  - Format: Raw logits (need sigmoid activation)
  - Memory: 0.02MB

### 4. MData V2 FP16
- **Type**: Metadata
- **Quantization**: FP16
- **File Size**: 14.09 MB
- **Loading Time**: 40.32ms
- **Input**:
  - Shape: [1, 3]
  - Type: 🎯 METADATA (lat, lng, time)
  - Format: Geographic coordinates + temporal data
  - Memory: 0.00MB
- **Output**:
  - Shape: [1, 6522]
  - Type: 🐦 SPECIES CLASSIFICATIONS (6522 species)
  - Format: Raw logits (need sigmoid activation)
  - Memory: 0.02MB

### 5. BirdNet v24
- **Type**: Audio (but with image-like input shape)
- **Quantization**: Unknown
- **File Size**: 16.26 MB
- **Loading Time**: 28.07ms
- **Input**:
  - Shape: [1, 224, 224, 3]
  - Type: Detected as audio but shape suggests image input
  - Format: Likely spectrogram or image data
  - Memory: 0.57MB
- **Output**:
  - Shape: [1, 400]
  - Type: 📊 INTERMEDIATE FEATURES
  - Format: Intermediate model features
  - Memory: 0.00MB
- **Inference Time**: 11.53ms (fastest)

### 6. Birds MobileNetV2
- **Type**: Audio (but with image-like input shape)
- **Quantization**: Unknown
- **File Size**: 16.26 MB
- **Loading Time**: 26.39ms
- **Input**:
  - Shape: [1, 224, 224, 3]
  - Type: Detected as audio but shape suggests image input
  - Format: Likely spectrogram or image data
  - Memory: 0.57MB
- **Output**:
  - Shape: [1, 400]
  - Type: 📊 INTERMEDIATE FEATURES
  - Format: Intermediate model features
  - Memory: 0.00MB
- **Inference Time**: 18.19ms

## React Native Implementation Guide

### Audio Model Implementation

For models expecting raw audio input (Regular Audio FP32/FP16):

```javascript
// Audio preprocessing
const prepareAudioInput = (audioData: Float32Array) => {
  // Ensure audio is at correct sample rate (48kHz or 24kHz)
  // Clip to 3-second segments (144000 or 72000 samples)
  const input = new Float32Array(144000);
  input.set(audioData.slice(0, 144000));
  return input;
};

// Run inference
const classifyAudio = async (audioData: Float32Array) => {
  const input = prepareAudioInput(audioData);
  const outputs = await model.runSync([input]);
  
  // Apply sigmoid to get probabilities
  const logits = outputs[0];
  const probabilities = sigmoid(logits);
  
  // Get top predictions
  return getTopPredictions(probabilities, speciesLabels, 5);
};
```

### Metadata Model Implementation

For models using location and time data (MData FP16/V2):

```javascript
const classifyByLocation = async (lat: number, lng: number, weekOfYear: number) => {
  // Prepare metadata input
  const metadata = new Float32Array(3);
  metadata[0] = lat;
  metadata[1] = lng;
  metadata[2] = Math.cos(2 * Math.PI * weekOfYear / 48); // Temporal encoding
  
  const outputs = await model.runSync([metadata]);
  const logits = outputs[0];
  const probabilities = sigmoid(logits);
  
  return getTopPredictions(probabilities, speciesLabels, 5);
};
```

### Image/Spectrogram Model Implementation

For models expecting image-like input (BirdNet v24, MobileNetV2):

```javascript
const classifySpectrogram = async (spectrogramData: Float32Array) => {
  // Input should be 224x224x3 = 150528 elements
  const input = new Float32Array(150528);
  input.set(spectrogramData);
  
  const outputs = await model.runSync([input]);
  // These models output intermediate features (400 elements)
  // Additional processing may be needed
  return outputs[0];
};
```

## Key Implementation Notes

1. **Audio Models**: Expect raw audio samples, not spectrograms
2. **Sample Rate**: 48kHz (144000 samples) for 3-second clips
3. **Output Processing**: Apply sigmoid activation to convert logits to probabilities
4. **Species Count**: Models with 6522 outputs correspond to global bird species database
5. **Metadata Models**: Can filter results based on location and time
6. **Framework**: Use `react-native-fast-tflite` for optimal performance

## Performance Recommendations

- **FP16 models** offer the best size/performance trade-off
- **Batch size of 1** is recommended for mobile devices
- **Inference time** typically ranges from 11-197ms
- Consider **chunking** long audio recordings into 3-second segments
- **Metadata models** are much smaller (6.74MB) and can be used for location-based filtering

## Model Selection Guide

1. **For audio classification only**: Use Regular Audio FP16 (24.73MB)
2. **For location-based filtering**: Use MData FP16 (6.74MB) as a supplementary model
3. **For image/spectrogram input**: Use BirdNet v24 or MobileNetV2 (16.26MB)
4. **For best accuracy**: Use Regular Audio FP32 (49.33MB) if size is not a constraint

## Architecture Insights

- **WhoBIRD models** (Regular Audio, MData) are specifically designed for bird classification with 6522 species
- **MData models** use only 3 inputs (latitude, longitude, time) to filter species by location/season
- **BirdNet/MobileNetV2** models appear to be image-based models that might expect spectrograms instead of raw audio
- All models use **single batch processing** (batch size = 1) which is ideal for mobile inference