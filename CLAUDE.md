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