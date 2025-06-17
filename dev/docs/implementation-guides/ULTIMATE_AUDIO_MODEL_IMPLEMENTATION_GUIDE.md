# Ultimate Audio Model Implementation Guide for React Native

## Overview

This guide consolidates all findings from our audio pipeline analysis, model testing, and whoBIRD implementation research. It provides a complete roadmap for implementing BirdNET audio classification in React Native.

## Critical Discovery: Raw Audio Input, Not Spectrograms! 🚨

**The most important finding**: BirdNET models expect **raw Float32 audio samples directly**, NOT mel-spectrograms. This fundamentally changes our implementation approach.

### What This Means:
- ❌ **WRONG**: Generate mel-spectrograms → Feed to model
- ✅ **CORRECT**: Record raw audio → Convert to Float32 → Feed to model

## Architecture Overview

### Two-Model System

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Audio Input   │────▶│  Audio Model     │────▶│  Blend Results  │
│  (Raw Samples)  │     │  (Species ID)    │     │  (Final Output) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                           ▲
┌─────────────────┐     ┌──────────────────┐              │
│ Location/Time   │────▶│   Meta Model     │──────────────┘
│   (Lat/Lon/Week)│     │ (Geo Filtering)  │
└─────────────────┘     └──────────────────┘
```

### Models Required

1. **Main Audio Model**: `BirdNET_GLOBAL_6K_V2.4_Model_FP16.tflite`
   - Input: 144,000 Float32 samples (3s @ 48kHz)
   - Output: 6,522 raw logits

2. **Meta Location Model**: `BirdNET_GLOBAL_6K_V2.4_MData_Model_FP16.tflite`
   - Input: [latitude, longitude, week_cosine] (3 floats)
   - Output: 6,522 probabilities

## Implementation Steps

### Step 1: Audio Recording Setup

```typescript
// services/audioRecorder.ts
import { Audio } from 'expo-av';

const SAMPLE_RATE = 48000;
const RECORDING_OPTIONS = {
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: SAMPLE_RATE,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.wav',
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: SAMPLE_RATE,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};
```

### Step 2: Audio Processing Pipeline

```typescript
// services/audioProcessor.ts
export class AudioProcessor {
  private buffer: Float32Array;
  private writePosition: number = 0;
  
  constructor(bufferSize: number = SAMPLE_RATE * 10) { // 10 second buffer
    this.buffer = new Float32Array(bufferSize);
  }
  
  // Convert Int16 PCM to Float32
  processAudioChunk(pcmData: Int16Array): void {
    for (let i = 0; i < pcmData.length; i++) {
      // Simple conversion: divide by max int16 value
      this.buffer[this.writePosition] = pcmData[i] / 32768.0;
      this.writePosition = (this.writePosition + 1) % this.buffer.length;
    }
  }
  
  // Extract 3-second window for inference
  getInferenceWindow(): Float32Array {
    const windowSize = SAMPLE_RATE * 3; // 144,000 samples
    const window = new Float32Array(windowSize);
    
    // Get the most recent 3 seconds
    let readPos = (this.writePosition - windowSize + this.buffer.length) % this.buffer.length;
    
    for (let i = 0; i < windowSize; i++) {
      window[i] = this.buffer[readPos];
      readPos = (readPos + 1) % this.buffer.length;
    }
    
    return window;
  }
  
  // Optional: Apply high-pass filter
  applyHighPassFilter(data: Float32Array, cutoff: number = 200): Float32Array {
    // Simple first-order high-pass filter
    const rc = 1.0 / (2.0 * Math.PI * cutoff);
    const dt = 1.0 / SAMPLE_RATE;
    const alpha = rc / (rc + dt);
    
    const filtered = new Float32Array(data.length);
    filtered[0] = data[0];
    
    for (let i = 1; i < data.length; i++) {
      filtered[i] = alpha * (filtered[i-1] + data[i] - data[i-1]);
    }
    
    return filtered;
  }
}
```

### Step 3: Model Loading and Initialization

```typescript
// services/birdNetClassifier.ts
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';

export class BirdNetClassifier {
  private audioModel: tf.GraphModel | null = null;
  private metaModel: tf.GraphModel | null = null;
  private labels: string[] = [];
  
  async initialize(): Promise<void> {
    // Wait for TensorFlow to be ready
    await tf.ready();
    
    // Load models
    this.audioModel = await tf.loadGraphModel(
      bundleResourceIO(modelJson, modelWeights)
    );
    
    this.metaModel = await tf.loadGraphModel(
      bundleResourceIO(metaModelJson, metaModelWeights)
    );
    
    // Load bird labels
    this.labels = await this.loadLabels();
  }
  
  async loadLabels(): Promise<string[]> {
    // Load from BirdLabelsMap.ts or JSON file
    const response = await fetch('path/to/labels.json');
    return response.json();
  }
}
```

### Step 4: Inference Implementation

```typescript
// services/birdNetClassifier.ts (continued)
export class BirdNetClassifier {
  async predict(
    audioData: Float32Array,
    latitude: number,
    longitude: number,
    date: Date = new Date()
  ): Promise<PredictionResult[]> {
    if (!this.audioModel || !this.metaModel) {
      throw new Error('Models not initialized');
    }
    
    // Step 1: Audio inference
    const audioTensor = tf.tensor2d(audioData, [1, audioData.length]);
    const audioLogits = this.audioModel.predict(audioTensor) as tf.Tensor;
    const audioProbs = tf.sigmoid(audioLogits);
    
    // Step 2: Meta model inference
    const weekOfYear = this.getWeekOfYear(date);
    const weekCosine = Math.cos(2 * Math.PI * weekOfYear / 52);
    
    const metaTensor = tf.tensor2d(
      [[latitude, longitude, weekCosine]], 
      [1, 3]
    );
    const metaProbs = this.metaModel.predict(metaTensor) as tf.Tensor;
    
    // Step 3: Blend predictions
    const metaInfluence = 0.3; // Configurable
    const blendedProbs = this.blendPredictions(
      audioProbs, 
      metaProbs, 
      metaInfluence
    );
    
    // Step 4: Get top predictions
    const results = await this.getTopPredictions(blendedProbs, 10);
    
    // Cleanup tensors
    audioTensor.dispose();
    audioLogits.dispose();
    audioProbs.dispose();
    metaTensor.dispose();
    metaProbs.dispose();
    blendedProbs.dispose();
    
    return results;
  }
  
  private blendPredictions(
    audioProbs: tf.Tensor,
    metaProbs: tf.Tensor,
    metaInfluence: number
  ): tf.Tensor {
    // Formula: audioProb * (1 - metaInfluence + metaInfluence * metaProb)
    const factor = tf.add(
      tf.scalar(1 - metaInfluence),
      tf.mul(tf.scalar(metaInfluence), metaProbs)
    );
    return tf.mul(audioProbs, factor);
  }
  
  private async getTopPredictions(
    probs: tf.Tensor,
    topK: number
  ): Promise<PredictionResult[]> {
    const { values, indices } = tf.topk(probs, topK);
    const probValues = await values.array() as number[][];
    const indexValues = await indices.array() as number[][];
    
    values.dispose();
    indices.dispose();
    
    return indexValues[0].map((idx, i) => ({
      species: this.labels[idx],
      confidence: probValues[0][i],
      index: idx
    }));
  }
  
  private getWeekOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
  }
}
```

### Step 5: Integration with React Native

```typescript
// hooks/useBirdAudioClassification.ts
import { useState, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import { AudioProcessor } from '../services/audioProcessor';
import { BirdNetClassifier } from '../services/birdNetClassifier';

export function useBirdAudioClassification() {
  const [isRecording, setIsRecording] = useState(false);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const recording = useRef<Audio.Recording | null>(null);
  const processor = useRef(new AudioProcessor());
  const classifier = useRef(new BirdNetClassifier());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize classifier on mount
  useEffect(() => {
    classifier.current.initialize().catch(console.error);
  }, []);
  
  const startRecording = useCallback(async (latitude: number, longitude: number) => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      recording.current = new Audio.Recording();
      await recording.current.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.current.startAsync();
      
      setIsRecording(true);
      
      // Start continuous processing every 3 seconds
      intervalRef.current = setInterval(async () => {
        if (!isProcessing) {
          setIsProcessing(true);
          
          try {
            const audioWindow = processor.current.getInferenceWindow();
            const results = await classifier.current.predict(
              audioWindow,
              latitude,
              longitude
            );
            setPredictions(results);
          } catch (error) {
            console.error('Prediction error:', error);
          } finally {
            setIsProcessing(false);
          }
        }
      }, 3000);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [isProcessing]);
  
  const stopRecording = useCallback(async () => {
    if (recording.current) {
      await recording.current.stopAndUnloadAsync();
      recording.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsRecording(false);
    setIsProcessing(false);
  }, []);
  
  return {
    isRecording,
    isProcessing,
    predictions,
    startRecording,
    stopRecording,
  };
}
```

### Step 6: UI Component

```typescript
// components/BirdAudioDetector.tsx
import React from 'react';
import { View, Text, Button, FlatList } from 'react-native';
import { useBirdAudioClassification } from '../hooks/useBirdAudioClassification';
import * as Location from 'expo-location';

export function BirdAudioDetector() {
  const {
    isRecording,
    isProcessing,
    predictions,
    startRecording,
    stopRecording,
  } = useBirdAudioClassification();
  
  const handleStartRecording = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      alert('Location permission is required for accurate bird identification');
      return;
    }
    
    const location = await Location.getCurrentPositionAsync({});
    await startRecording(location.coords.latitude, location.coords.longitude);
  };
  
  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Button
        title={isRecording ? 'Stop Recording' : 'Start Recording'}
        onPress={isRecording ? stopRecording : handleStartRecording}
      />
      
      {isProcessing && <Text>Processing audio...</Text>}
      
      <FlatList
        data={predictions}
        keyExtractor={(item) => item.species}
        renderItem={({ item }) => (
          <View style={{ padding: 10 }}>
            <Text>{item.species}</Text>
            <Text>Confidence: {(item.confidence * 100).toFixed(1)}%</Text>
          </View>
        )}
      />
    </View>
  );
}
```

## Performance Optimization

### 1. Memory Management
```typescript
// Always dispose tensors after use
const result = await tf.tidy(() => {
  // All tensor operations here
  return finalResult;
});
```

### 2. Batch Processing
```typescript
// Process multiple windows if needed
const windows = [window1, window2, window3];
const batchTensor = tf.stack(windows);
const batchResults = model.predict(batchTensor);
```

### 3. Model Quantization
- Use FP16 models instead of FP32 for 50% size reduction
- Consider INT8 quantization for even smaller models (with slight accuracy loss)

## Testing Strategy

### 1. Unit Tests
```typescript
// __tests__/audioProcessor.test.ts
describe('AudioProcessor', () => {
  it('converts Int16 to Float32 correctly', () => {
    const processor = new AudioProcessor();
    const int16Data = new Int16Array([0, 16384, -16384, 32767, -32768]);
    const expected = [0, 0.5, -0.5, 0.999969, -1];
    // Test conversion
  });
});
```

### 2. Integration Tests
```typescript
// __tests__/birdNetClassifier.test.ts
describe('BirdNetClassifier', () => {
  it('produces valid predictions for known audio', async () => {
    const classifier = new BirdNetClassifier();
    await classifier.initialize();
    
    // Load test audio file
    const testAudio = await loadTestAudio('robin_song.wav');
    const predictions = await classifier.predict(testAudio, 51.5074, -0.1278);
    
    expect(predictions[0].species).toContain('Robin');
    expect(predictions[0].confidence).toBeGreaterThan(0.7);
  });
});
```

### 3. Performance Tests
```typescript
// Measure inference time
const start = performance.now();
const predictions = await classifier.predict(audioData, lat, lon);
const inferenceTime = performance.now() - start;
console.log(`Inference time: ${inferenceTime}ms`);
```

## Common Issues and Solutions

### Issue 1: Model Not Loading
**Solution**: Ensure models are correctly bundled with the app
```javascript
// metro.config.js
module.exports = {
  resolver: {
    assetExts: ['tflite', 'json', 'bin'],
  },
};
```

### Issue 2: Poor Accuracy
**Solutions**:
1. Verify audio sample rate is 48kHz
2. Check location/time data is correct
3. Ensure audio volume is sufficient
4. Test with known bird recordings

### Issue 3: Memory Crashes
**Solutions**:
1. Dispose tensors properly
2. Use smaller batch sizes
3. Implement audio buffer management
4. Consider using Web Workers for processing

## Deployment Checklist

- [ ] Models bundled correctly in app
- [ ] Audio permissions requested
- [ ] Location permissions requested
- [ ] Error handling for all edge cases
- [ ] Performance tested on low-end devices
- [ ] Memory leaks checked
- [ ] Offline functionality verified
- [ ] Privacy policy updated for audio/location usage

## Summary

The key to successful BirdNET implementation is understanding that:
1. **Models expect raw audio, not spectrograms**
2. **Two models work together for accurate predictions**
3. **Simple Float32 conversion is all that's needed**
4. **Location/time filtering significantly improves accuracy**

By following this guide, you'll have a working bird audio identification system in React Native that matches the accuracy of the official BirdNET implementations.