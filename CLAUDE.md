# CLAUDE.md - LogChirpy Development Guide

## Project Overview

LogChirpy is a mobile bird watching application built with React Native, Expo, and TypeScript. The app enables ornithological documentation through photos, audio recordings, and manual entries, featuring AI-powered bird identification and comprehensive archival capabilities.

### Current Implementation Status

The project has evolved from its initial planning to include:
- **Fully local ML models** (no longer dependent on external APIs)
- **BirDex database** containing all global bird species (~30,000 species)
- **Multi-language support** in 6 languages: English, German, Spanish, French, Ukrainian, and Arabic
- **Firebase-synchronized bird spotting database** for cloud backup and cross-device sync

## User Stories

### User Story 1: Bird Recognition and Logging
**As an amateur hiker**, I want to use a bird recognition app that identifies birds by their calls, so I can log my sightings with optional images and GPS coordinates in my cloud archive.

**Acceptance Criteria:**
1. The app can accurately identify bird species by their calls
2. The app allows users to take and upload images of birds
3. The app logs GPS coordinates of sightings
4. The app stores all data in a cloud archive accessible to the user

### User Story 2: Digital Bird Watching Tool
**As a long-time hobby ornithologist**, I want an electronic alternative for bird identification and logging, so I can efficiently document observations, retrieve detailed bird information, and share data with other ornithologists.

**Acceptance Criteria:**
1. The app provides accurate bird identification by voice
2. The app allows users to log observations with images and GPS coordinates
3. The app provides detailed information about each bird species
4. The app enables data exchange with other ornithologists
5. The app stores all data in a cloud archive accessible to the user

### User Story 3: Archive Access and Export
**As an amateur hiker**, I want to occasionally switch to the archive tab, search for a beautiful bird image, and export it to other apps, so I can share my bird observations with friends and on social media.

**Acceptance Criteria:**
1. The app allows users to easily switch to the archive tab
2. The app provides a search function to find specific bird images
3. The app allows users to select and export images to other apps
4. The app maintains image quality during export
5. The app stores all data in a cloud archive accessible to the user

### User Story 4: Quick Image Sharing
**As a long-time hobby ornithologist**, I want to quickly share a recently captured image, so I can immediately share my bird observations with friends and other ornithologists.

**Acceptance Criteria:**
1. The app allows users to quickly access recently captured images
2. The app provides a simple sharing option directly from the image view
3. The app supports sharing on multiple platforms (social media, email)
4. The app maintains image quality during sharing
5. The app stores all data in a cloud archive accessible to the user

### User Story 5: Finding Sparrow Sighting
**As a long-time hobby ornithologist**, I want to find out where I saw a specific sparrow, so I can remember the location and possibly visit it again.

**Acceptance Criteria:**
1. The app allows users to open the map tab
2. The app provides a filter option to display birds by type (e.g., sparrow)
3. The app shows locations of all sparrow sightings on the map
4. The app allows users to click on a location to view sighting details
5. The app stores all data in a cloud archive accessible to the user

### User Story 6: First-time App Usage
**As a new user**, I want to understand how to use the bird identification and logging app, so I can effectively start identifying and logging bird observations.

**Acceptance Criteria:**
1. The app provides an inviting onboarding tutorial guiding users through main functions
2. The app includes a simple and intuitive user interface
3. The app allows users to perform a test bird identification to familiarize with the process
4. The app explains how to log sightings with images and GPS coordinates
5. The app shows how to access the archive and share sightings

## Key Technical Details

### Machine Learning
- **Local TFLite models** for bird classification (MobileNetV2)
- **MLKit integration** for object detection (SSD MobileNet)
- **BirdNet model** converted from .h5 to .tflite for audio classification
- All ML processing happens on-device for privacy and offline capability

### Database Architecture
- **Local SQLite** for offline-first operation
- **Firebase Firestore** for cloud synchronization
- **BirDex database** with 30,000+ bird species, fully translated

### Supported Languages
1. English (en)
2. German (de)
3. Spanish (es)
4. French (fr)
5. Ukrainian (uk)
6. Arabic (ar)

### Development Commands

```bash
# Run TypeScript type checking
npm run typecheck

# Start development server
npm start

# Run on Android device
npm run android:device

# Run tests
npm test
```

### Important File Locations
- **Contexts**: `/contexts/` (AuthContext, LogDraftContext)
- **ML Models**: `/assets/models/`
- **Localization**: `/locales/`
- **Services**: `/services/`
- **Components**: `/components/`

## Recent Changes
- Fixed BirdexLayout component naming issue
- Moved context files from `/app/context/` to `/contexts/`
- Updated all imports to use new context paths
- All TypeScript errors resolved
- Implemented sequential ML pipelines for both audio and image processing
- Enhanced audio classification with scientific name support
- Fixed Metro bundler text file loading issues
- Optimized recording state management and cleanup

## ObjectDetectCamera Component Architecture

### Overview
The ObjectDetectCamera (`/app/log/objectIdentCamera.tsx`) is the core ML-powered camera interface that provides real-time bird detection through both visual and audio analysis. It features a cyberpunk-themed UI with dual sequential ML pipelines.

### Component Structure

#### Main Components
- **ObjectIdentCameraWrapper**: Permission handling and loading states
- **ObjectIdentCamera**: Core camera and ML functionality
- **Detection Overlays**: SVG-based real-time visual feedback
- **Cyberpunk HUD**: Status displays and ML results

#### Key Dependencies
- `react-native-vision-camera`: Camera functionality
- `@infinitered/react-native-mlkit-object-detection`: Object detection
- `@infinitered/react-native-mlkit-image-labeling`: Image classification
- `expo-av`: Audio recording and playback
- `react-native-svg`: Detection overlay rendering
- `ultraSimpleBirdClassifier`: Custom audio ML pipeline

### Sequential ML Pipeline Architecture

#### Image ML Pipeline (Sequential)
**Flow**: wait → photo → object detection → per object crop → per crop classify → SVG → wait

1. **Step 1**: Photo capture (0.3 quality for performance)
2. **Step 2**: MLKit object detection on full image
3. **Step 3**: For each detected object:
   - **Step 3a**: Crop object from photo using frame coordinates
   - **Step 3b**: Classify cropped image using bird classifier
4. **Step 4**: Update SVG overlay with all results
5. **Step 5**: Wait for next cycle (Config.camera.pipelineDelay seconds)

**State Management**:
```typescript
const imageProcessingRef = useRef<{
    isCapturing: boolean;
    isDetecting: boolean;
    isCropping: boolean;
    isClassifying: boolean;
}>
```

#### Audio ML Pipeline (Sequential)
**Flow**: record → process → display → health check → wait → repeat

1. **Step 1**: Record audio (3 seconds, 48kHz, mono)
2. **Step 2**: Process through BirdNET classification
3. **Step 3**: Update UI with predictions (common + scientific names)
4. **Step 4**: Health check system status
5. **Step 5**: Wait 1 second before next cycle

**Total cycle time**: ~5 seconds between audio detections

**State Management**:
```typescript
const audioRecordingRef = useRef<{
    recording: Audio.Recording | null;
    isRecording: boolean;
    isCleaningUp: boolean;
    isProcessing: boolean;
}>
```

**Health Check Monitors**:
- audioMLReady: ML system operational
- hasPermission: Audio permission granted
- isContextActive: Camera/app is active
- recordingStateClean: No recording conflicts
- lastResultsCount: Track results being generated

### Visual Feedback System

#### SVG Detection Overlays
- **Coordinate System**: MLKit normalized coordinates (0-1) scaled to screen dimensions
- **Visual Elements**:
  - Main detection boxes with rounded corners
  - Cyberpunk corner brackets for aesthetic
  - Color-coded confidence levels
  - Dynamic label positioning with backgrounds
- **Rendering**: All detections rendered, first 5 logged for debugging
- **Performance**: React.Fragment optimization, proper key props

#### Confidence Color Coding
```typescript
function getCyberBoxStyle(confidence: number) {
    if (c > 0.8) return { color: CYBER_COLORS.success, opacity: 0.9 };    // Green
    if (c > 0.6) return { color: CYBER_COLORS.primary, opacity: 0.8 };    // Blue
    if (c > 0.4) return { color: CYBER_COLORS.accent, opacity: 0.7 };     // Emerald
    if (c > 0.2) return { color: CYBER_COLORS.warning, opacity: 0.6 };    // Amber
    return { color: CYBER_COLORS.danger, opacity: 0.5 };                  // Red
}
```

#### Cyberpunk HUD Layout
- **Top Panel**: Neural Vision System status
- **Visual Analysis**: Shows top 2 image detections with confidence bars
- **Audio Analysis**: Shows top 2 audio predictions with scientific names
- **Status Indicators**: Real-time ML system health
- **Control Panel**: Zoom slider and flash toggle

### Data Flow and Interfaces

#### Core Interfaces
```typescript
interface Detection {
    frame: { origin: { x: number; y: number }; size: { x: number; y: number } };
    labels: { text: string; confidence: number; index: number }[];
}

interface AudioPrediction {
    common_name: string;
    scientific_name: string;
    confidence: number;
    index: number;
    assetUrl?: string;
}
```

#### ML Integration Points
- **Image Pipeline**: MLKit → Bird Classifier → SVG Display
- **Audio Pipeline**: Expo Audio → BirdNET → HUD Display
- **Results Storage**: State management for UI updates
- **Error Handling**: Isolated error handling per pipeline step

### Performance Optimizations

#### Resource Management
- Sequential processing prevents resource conflicts
- Proper cleanup functions for audio recordings
- Quality reduction for photo capture (0.3)
- Limited UI results display (top 2 per category)

#### Error Isolation
- Each pipeline step has isolated try/catch blocks
- Failed operations don't block entire pipeline
- Graceful fallbacks (full image if crop fails)
- State cleanup in finally blocks

#### Debugging Features
- Comprehensive step-by-step logging
- Health check system validation
- Coordinate transformation logging
- Performance timing measurements

### Current Configuration
- **Image Pipeline Delay**: Config.camera.pipelineDelay seconds
- **Audio Cycle Time**: ~5 seconds total (3s record + 1s process + 1s wait)
- **Detection Limits**: Top 2 results displayed in HUD
- **Audio Format**: 48kHz, mono, 3-second clips
- **Image Quality**: 0.3 for ML processing

### Integration Points
- **Camera Operations**: capturePhoto service
- **Audio Classification**: ultraSimpleBirdClassifier service
- **File Management**: uriUtils for image cropping and saving
- **Species Mapping**: BirDex database integration for enriched data
- **User Feedback**: Haptic feedback and snackbar notifications

## Audio ML Pipeline Architecture (whoBIRD Implementation)

### Overview
The audio classification system is based on the whoBIRD implementation and uses a sophisticated dual-model TensorFlow Lite architecture for accurate bird identification from audio recordings.

### Dual Model System Architecture

#### 1. Primary Audio Model
**File**: `BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite`
- **Input**: Processed audio spectrograms (3-second clips, 144,000 Float32 samples)
- **Output**: Classification probabilities for 6,522 global bird species
- **Architecture**: BirdNET v2.4 with MobileNet backbone
- **Size**: ~15-20 MB (FP32 precision)
- **Inference Time**: 100-500ms per clip (device dependent)

#### 2. Meta Location Model  
**File**: `BirdNET_GLOBAL_6K_V2.4_MData_Model_FP16.tflite`
- **Input**: Geographic coordinates (lat, lng) + temporal data (week cosine)
- **Output**: Location-based probability modifiers for the same 6,522 species
- **Purpose**: Enhances predictions using biogeographic and seasonal data
- **Size**: ~2-5 MB (FP16 precision)
- **Meta Influence**: 30% weighting factor

### Species Classification System

#### Global Coverage
- **Total Species**: 6,522 global bird species
- **Geographic Coverage**: Worldwide bird populations
- **Taxonomic Scope**: Comprehensive avian diversity representation

#### Label Format Structure
```
"Scientific_Name_Common Name"
```
**Examples**:
- `"Turdus_migratorius_American Robin"`
- `"Passer_domesticus_House Sparrow"`
- `"Corvus_brachyrhynchos_American Crow"`

**Parsing Logic**:
- **Scientific Name**: Everything before the first underscore
- **Common Name**: Everything after the first underscore (underscores → spaces)

#### Multi-Language Support (40+ Languages)
**Primary Languages Supported**:
- English (en), German (de), Spanish (es), French (fr), Ukrainian (uk), Arabic (ar)
- Dutch (nl), Italian (it), Portuguese (pt), Russian (ru), Polish (pl), Czech (cs)
- Japanese (ja), Korean (ko), Chinese (zh), and 25+ additional languages

**Label Files**: Each language has dedicated label file (`labels_{lang}.txt`) with localized common names while preserving scientific names for taxonomic accuracy.

### Audio Processing Pipeline

#### Input Audio Requirements
- **Sample Rate**: 48,000 Hz (48 kHz) - fixed requirement
- **Duration**: Exactly 3.0 seconds (144,000 samples total)
- **Channels**: Mono (single channel)
- **Format**: Float32 array normalized to [-1.0, 1.0]
- **Bit Depth**: 16-bit input converted to Float32

#### Preprocessing Steps (Sequential)

1. **Audio Loading and Decoding**
   - Platform-specific audio decoders (WAV, M4A, etc.)
   - Convert to raw audio samples

2. **Sample Rate Conversion**
   - Target: 48,000 Hz uniformly
   - Method: Linear interpolation resampling
   - Quality preservation for bird call analysis

3. **Format Conversion**
   ```javascript
   // Int16 to Float32 conversion
   floatSample = int16Sample / 32768.0;
   ```

4. **Duration Standardization**
   - **Target**: Exactly 144,000 samples
   - **Trimming**: Center crop if longer
   - **Padding**: Center pad with zeros if shorter

5. **High-Pass Filtering**
   - **Cutoff**: 200 Hz
   - **Type**: First-order digital filter
   - **Purpose**: Remove low-frequency noise and environmental sounds
   ```javascript
   const rc = 1.0 / (2.0 * Math.PI * cutoff);
   const alpha = rc / (rc + dt);
   ```

#### Model Inference Process

##### Primary Audio Model Processing
1. **Input**: Processed Float32 array (144,000 samples)
2. **Output**: Raw logits for 6,522 species
3. **Activation**: Sigmoid conversion to probabilities
   ```javascript
   probability = 1 / (1 + Math.exp(-logit));
   ```

##### Meta Model Enhancement (When Location Available)
1. **Temporal Feature Calculation**:
   ```javascript
   const weekOfYear = Math.floor(daysSinceYearStart / 7);
   const weekCosine = Math.cos(2 * Math.PI * weekOfYear / 52);
   ```

2. **Meta Input**: `[latitude, longitude, weekCosine]`

3. **Probability Blending**:
   ```javascript
   const metaInfluence = 0.3;
   finalProbability = audioProb * (1 - metaInfluence + metaInfluence * metaProb);
   ```

#### Post-Processing and Results

##### Confidence Thresholding
- **Minimum Confidence**: 0.01 (1%)
- **Maximum Results**: Top 5 predictions
- **Sorting**: Descending order by confidence

##### Output Interface
```typescript
interface BirdPrediction {
  commonName: string;        // Localized common name
  scientificName: string;    // Latin scientific name  
  confidence: number;        // Probability score [0, 1]
  index: number;             // Species index in model
}

interface AudioPrediction {
  common_name: string;       // Pipeline compatible format
  scientific_name: string;   // Pipeline compatible format
  confidence: number;
  index: number;
  assetUrl?: string;         // Macaulay Library asset URL
}
```

### Asset Integration System

#### Macaulay Library Integration
- **Source File**: `assets.txt` (6,522 entries)
- **Format**: One asset ID per line, corresponding to species index
- **URL Pattern**: `https://macaulaylibrary.org/asset/{assetId}/embed`
- **Asset Types**: High-quality bird photographs, reference audio, behavioral videos, spectrograms

#### Asset URL Generation
```typescript
function getAssetUrl(speciesIndex: number): string | undefined {
  const assetId = assets[speciesIndex];
  if (assetId === 'NO_ASSET' || !assetId) return undefined;
  return `https://macaulaylibrary.org/asset/${assetId}/embed`;
}
```

### Service Implementation Architecture

#### Core Service: ultraSimpleBirdClassifier.ts
**Key Functions**:
- `classifyBirdAudio()`: Main classification function
- `classifyBirdAudioForPipeline()`: ObjectDetectCamera compatible
- `initializeBirdClassifier()`: Model loading and initialization
- `processAudio()`: Audio preprocessing pipeline
- `runInference()`: Dual-model inference execution

#### Supporting Services
- **BirdLabelsMap.ts**: Generated language mappings and label loading
- **speciesMapping.ts**: BirDex database integration and enrichment
- **audioDecoder.ts**: Platform-specific audio processing
- **audioWindowManager.ts**: Real-time audio windowing for continuous monitoring

### File Structure and Assets
```
/assets/models/whoBIRD-TFlite-master/
├── BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite     # Primary audio model
├── BirdNET_GLOBAL_6K_V2.4_MData_Model_FP16.tflite # Meta location model
└── /assets/model_labels_whoBird/
    ├── labels_en.txt                              # English labels (6,522 entries)
    ├── labels_de.txt                              # German labels
    ├── labels_es.txt                              # Spanish labels
    ├── labels_fr.txt                              # French labels
    ├── labels_uk.txt                              # Ukrainian labels
    ├── labels_ar.txt                              # Arabic labels
    ├── assets.txt                                 # Macaulay Library asset IDs
    └── [25+ additional language files]
```

### Performance Characteristics

#### Model Specifications
- **Total Memory Footprint**: ~25-30 MB for both models
- **Inference Time**: 100-500ms per 3-second clip
- **On-Device Processing**: No network dependency
- **Quantization**: FP16 meta model for size optimization

#### Real-Time Processing Capabilities
- **Continuous Monitoring**: Sliding window approach
- **Processing Pipeline**: Capture → Preprocess → Inference → Results
- **Background Processing**: Mobile-optimized performance
- **Result Aggregation**: Confidence smoothing and occurrence tracking

### Error Handling and Robustness

#### Audio Processing Resilience
- **Format Compatibility**: Multiple audio format support
- **Quality Adaptation**: Variable audio quality handling
- **Noise Robustness**: High-pass filtering for environmental noise
- **Graceful Degradation**: Fallback mechanisms for processing failures

#### Model Management
- **Lazy Loading**: On-demand model loading
- **Error Recovery**: Automatic retry mechanisms
- **Memory Management**: Proper cleanup and resource management
- **Metro Bundler Integration**: Asset loading through Expo Asset system

### Integration with ObjectDetectCamera

#### Pipeline Compatibility
The audio system integrates seamlessly with ObjectDetectCamera through:
- **classifyBirdAudioForPipeline()**: Returns AudioPrediction[] format
- **Sequential Processing**: Fits into 5-second audio cycle
- **Health Monitoring**: Validates ML system status
- **Error Isolation**: Independent failure handling
- **Real-time Updates**: Updates HUD display with predictions

This architecture provides a robust, scalable, and efficient solution for real-time bird classification using state-of-the-art machine learning techniques while maintaining excellent performance on mobile devices.