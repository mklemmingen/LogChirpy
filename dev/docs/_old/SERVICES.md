# Services Documentation

## Overview

The LogChirpy app is built around several core services that handle bird identification, data storage, and audio processing. This document provides a comprehensive guide to the service architecture.

## Service Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   BirdNetService    │────│ OfflineBirdClassifier │────│ TensorFlowLiteModel │
│   (Main Interface)  │    │   (Orchestration)    │    │   (Model Manager)   │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
           │                          │                           │
           │                          │                           │
           ▼                          ▼                           ▼
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│  Network Checking   │    │    Result Caching    │    │ AudioPreprocessing  │
│   (NetInfo)         │    │   (Local Storage)    │    │  (Spectrogram Gen)  │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
```

## Core Services

### BirdNetService

**Purpose**: Main interface for bird identification with offline-first approach.

**Key Methods**:

```typescript
// Initialize offline classification
static async initializeOfflineMode(): Promise<void>

// Main identification method
static async identifyBirdFromAudio(
  audioUri: string,
  options?: {
    latitude?: number;
    longitude?: number; 
    minConfidence?: number;
    forceOffline?: boolean;
    forceOnline?: boolean;
  }
): Promise<BirdNetResponse>

// Check network connectivity
static async checkNetworkConnection(): Promise<boolean>
```

**Usage Example**:
```typescript
const result = await BirdNetService.identifyBirdFromAudio(
  'file:///path/to/audio.wav',
  { 
    latitude: 40.7128,
    longitude: -74.0060,
    minConfidence: 0.15 
  }
);
console.log(result.predictions);
```

**Response Format**:
```typescript
interface BirdNetResponse {
  predictions: BirdNetPrediction[];
  processing_time: number;
  audio_duration: number;
  success: boolean;
  error?: string;
  source?: 'offline' | 'online' | 'cache' | 'mock';
  fallback_used?: boolean;
  cache_hit?: boolean;
}
```

### TensorFlowLiteModelService

**Purpose**: Manages the local BirdNET v2.4 model with 6,522 species.

**Key Features**:
- Singleton pattern for efficient resource management
- Automatic model loading and label management
- Memory cleanup and tensor disposal
- Mock model fallback for development

**Key Methods**:

```typescript
// Get singleton instance
static getInstance(): TensorFlowLiteModelService

// Initialize model and labels
async initialize(): Promise<void>

// Classify audio file
async classifyAudio(audioUri: string): Promise<TensorFlowLiteResult>

// Get model status
getStatus(): ModelStatus

// Update configuration
updateConfig(newConfig: Partial<ModelConfig>): void

// Clean up resources
dispose(): void
```

**Configuration**:
```typescript
interface ModelConfig {
  modelPath: string;           // 'assets/models/birdnet/model.json'
  labelsPath: string;          // 'assets/models/birdnet/labels.json'
  inputShape: [1, 224, 224, 3]; // Model input dimensions
  numClasses: 6522;           // BirdNET v2.4 species count
  confidenceThreshold: 0.1;   // Minimum confidence for results
  maxResults: 5;              // Maximum predictions returned
}
```

**Usage Example**:
```typescript
const service = TensorFlowLiteModelService.getInstance();
await service.initialize();

const result = await service.classifyAudio('file:///audio.wav');
console.log(`Found ${result.predictions.length} species`);
```

### AudioPreprocessingService

**Purpose**: Converts audio files to mel-spectrograms for model input.

**Processing Pipeline**:
1. **Audio Loading**: Load and decode audio file (currently mock data)
2. **Resampling**: Convert to 22kHz sample rate
3. **STFT**: Short-Time Fourier Transform with Hann windowing
4. **Mel-Scale**: Convert to mel-frequency bins (128 filters)
5. **Tensor Conversion**: Resize to 224x224x3 and normalize

**Key Methods**:

```typescript
// Main processing method
static async processAudioFile(audioUri: string): Promise<ProcessedAudio>

// Configuration management
static updateConfig(newConfig: Partial<AudioProcessingConfig>): void
static resetConfig(): void

// Debug information
static async getProcessingStats(processedAudio: ProcessedAudio): Promise<Stats>
```

**Configuration**:
```typescript
interface AudioProcessingConfig {
  sampleRate: 22050;        // Target sample rate
  windowSize: 1024;         // FFT window size
  hopSize: 512;            // STFT hop size
  melFilters: 128;         // Number of mel filters
  targetWidth: 224;        // Output width
  targetHeight: 224;       // Output height
  normalizeAudio: true;    // Enable normalization
}
```

**Usage Example**:
```typescript
const processed = await AudioPreprocessingService.processAudioFile(audioUri);
console.log('Tensor shape:', processed.melSpectrogram.shape);
console.log('Duration:', processed.duration);
```

## Database Services

### Database Service

**Purpose**: SQLite operations for local data storage.

**Key Tables**:
- `bird_spottings`: User bird observations
- `birdex_cache`: Cached BirdDex information

**Key Methods**:
```typescript
// Initialize database
static async initDatabase(): Promise<void>

// Bird spotting operations
static async insertBirdSpotting(spotting: InsertBirdSpotting): Promise<number>
static async getUserSpottings(limit?: number): Promise<BirdSpotting[]>
static async getBirdSpottingById(id: number): Promise<BirdSpotting | null>
static async deleteBirdSpotting(id: number): Promise<void>
```

### Database BirdDex Service

**Purpose**: Manages bird species database with progressive loading.

**Features**:
- Batch loading for performance
- Platform-specific optimization
- Progress tracking during initialization

**Key Methods**:
```typescript
// Initialize BirdDex database
static async initBirdDexDB(): Promise<void>

// Search operations
static async searchBirds(query: string, limit?: number): Promise<SimpleBird[]>
static async getBirdByCode(code: string): Promise<BirdDexBird | null>
static async getRandomBirds(limit?: number): Promise<SimpleBird[]>
```

## Error Handling

### Common Error Patterns

1. **Network Errors**: Handled with offline fallback
2. **Model Loading Errors**: Fallback to mock model
3. **Audio Processing Errors**: Detailed error messages
4. **Resource Cleanup**: Automatic tensor disposal

### Example Error Handling:
```typescript
try {
  const result = await BirdNetService.identifyBirdFromAudio(audioUri);
} catch (error) {
  if (error.message.includes('network')) {
    // Handle offline mode
  } else if (error.message.includes('audio')) {
    // Handle audio processing error
  }
}
```

## Performance Considerations

### Memory Management
- TensorFlow tensors are automatically disposed
- Model uses singleton pattern
- Batch database operations

### Optimization Tips
1. **Initialize Early**: Call `initializeOfflineMode()` at app start
2. **Reuse Instances**: Use singleton pattern for services
3. **Monitor Memory**: Check `getMemoryInfo()` periodically
4. **Cleanup**: Call `dispose()` when appropriate

### Platform-Specific Settings
- **iOS**: Smaller batch sizes (25 records)
- **Android**: Larger batch sizes (50 records)
- **Default**: Balanced approach (30 records)

## Testing

### Service Testing
```typescript
// Test model initialization
const service = TensorFlowLiteModelService.getInstance();
await service.initialize();
console.log('Model ready:', service.getStatus().isInitialized);

// Test audio processing
const processed = await AudioPreprocessingService.processAudioFile(mockAudio);
console.log('Processing successful:', processed.metadata);
```

### Mock Data
- Mock audio generation for testing
- Mock API responses for offline development
- Mock model for development without full model

## Development Guidelines

1. **Add Service Methods**: Keep business logic in services, not components
2. **Error Handling**: Always handle service errors gracefully
3. **Resource Cleanup**: Dispose of resources properly
4. **Configuration**: Use config objects for flexibility
5. **Documentation**: Document service methods clearly

## Future Enhancements

- **Real Audio Decoder**: Replace mock audio with actual decoding
- **Online API**: Implement real BirdNET API integration
- **Caching Layer**: Add intelligent result caching
- **Batch Processing**: Support multiple audio files
- **Model Updates**: Hot-swap models for updates