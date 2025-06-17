# Manual Bird Spotting Entry Component Specification

## Overview

The `manual.tsx` component is the core interface for creating bird spotting entries in LogChirpy. It provides a compact, visual interface that allows users to manually log bird sightings with multimedia support, AI-powered identification, and comprehensive metadata.

## Component Location

**Path:** `/app/log/manual.tsx`

## Core Functionality

### 1. Complete Bird Spotting Entry Management

The component manages a complete `BirdSpotting` entry with the following fields:

```typescript
interface BirdSpotting {
  id?: number;                    // Auto-generated primary key
  imageUri: string;               // Photo of the bird
  videoUri: string;               // Video recording
  audioUri: string;               // Audio recording of bird calls
  textNote: string;               // User's observation notes
  gpsLat: number;                 // GPS latitude coordinate
  gpsLng: number;                 // GPS longitude coordinate
  date: string;                   // ISO format date string
  birdType: string;               // Bird species name (required)
  imagePrediction: string;        // ML prediction from image
  audioPrediction: string;        // ML prediction from audio
  synced?: number;                // Cloud sync status (0/1)
  latinBirDex?: string;           // Scientific name reference
}
```

### 2. Context-Wrapped Media Creators

The component integrates with LogChirpy's context system to manage media creation:

#### LogDraftContext Integration
- Uses `useLogDraft()` hook for draft management
- Provides `draft`, `update`, and `clear` functions
- Maintains entry state across navigation
- Supports incremental updates as media is added

#### Media Navigation
The component navigates to dedicated media creation screens:
- **Photo:** `/log/photo-selection` - Camera/gallery selection
- **Video:** `/log/video` - Video recording interface
- **Audio:** `/log/audio` - Audio recording for bird calls

Each media creator updates the draft context upon completion, and the manual component receives updates via navigation params.

### 3. Input Fields and UI Components

#### Compact Header
- Back navigation with unsaved changes protection
- Title: "Manual Entry" (localized)
- Real-time completion percentage indicator (0-100%)

#### Horizontal Media Strip
Scrollable media card row with:
- **Photo Card**: Shows thumbnail or camera icon placeholder
- **Video Card**: Video preview with play overlay
- **Audio Card**: Play/pause functionality
- **AI ID Card**: Appears when audio is available for ML processing

Each card shows:
- Media type icon and label
- Green checkmark when media is captured
- Touch to add/preview media

#### Inline Form Fields

**Bird Type Input** (Required)
- Icon: Feather
- Text input with placeholder
- Shows AI badge when prediction available
- Validation: Required field

**Notes Input** (Optional)
- Icon: Edit pencil
- Multiline text input
- Supports detailed observations

**Metadata Row**
- **Date Selector**: Calendar icon, shows current/selected date
- **Location Capture**: Map pin icon, GPS coordinates display
  - Shows loading state during capture
  - Displays lat/long when available
  - Green check indicates captured location

### 4. ML Pipeline Integration

#### Audio Identification Pipeline

**Trigger**: AI ID card in media strip when audio is present

**Process Flow**:
1. User taps AI ID card
2. Shows loading spinner with timer (e.g., "3s")
3. Initializes AudioIdentificationService with HIGH_ACCURACY_FP32 model
4. Processes audio file through BirdNet model
5. Returns predictions with confidence scores

**ML Service Configuration**:
```typescript
AudioIdentificationService.identifyBirdFromAudio(
  audioUri,
  {
    latitude: draft.gpsLat,
    longitude: draft.gpsLng,
    minConfidence: 0.1,
    modelType: ModelType.HIGH_ACCURACY_FP32
  }
)
```

**Results Handling**:
- Displays modal with ranked predictions
- Each prediction shows:
  - Common name
  - Scientific name
  - Confidence percentage with visual indicator
  - Tap to select and populate bird type field

#### Image ML Pipeline (Future Enhancement)

While the current implementation focuses on audio ML, the structure supports image-based bird identification:
- `imagePrediction` field ready for ML results
- Integration point through photo capture workflow
- Would use MLKit object detection + classification pipeline

### 5. Data Validation and Saving

#### Validation Rules
1. **Bird Type**: Required field (must have value)
2. **Media/Notes**: At least one required (image, video, audio, OR notes)
3. Shows validation errors via snackbar notifications

#### Save Process
1. Validation check
2. Confirmation dialog
3. Creates complete BirdSpotting entry
4. Saves to local SQLite database
5. Marks for cloud sync (if enabled)
6. Clears draft and navigates to home

### 6. User Experience Features

#### Visual Feedback
- Haptic feedback on all interactions
- Color-coded status indicators
- Progress visualization
- Loading states for async operations

#### Accessibility
- Minimum 44px touch targets
- Screen reader labels
- High contrast design
- Keyboard navigation support

#### Internationalization
- Full i18n support via react-i18next
- Supports 6 languages
- All text strings localized

### 7. State Management

The component manages several state categories:

**Core State**:
- `isSaving`: Save operation in progress
- `isLoadingLocation`: GPS capture active
- `validationErrors`: Current validation issues

**Media State**:
- `sound`: Audio playback instance
- `imageLoadError`: Image loading failure flag
- `previewPlayer`/`fullscreenPlayer`: Video players

**ML State**:
- `isIdentifyingBird`: ML processing active
- `birdPredictions`: Array of predictions
- `showPredictions`: Modal visibility
- `processingTimer`: Processing duration display

**Modal State**:
- `isVideoModalVisible`: Video fullscreen view
- `isDatePickerVisible`: Date selection modal
- `selectedDate`: Currently selected date

### 8. Integration Points

#### Navigation Parameters
Receives media URIs from media creation screens:
- `params.audioUri`
- `params.imageUri`
- `params.videoUri`

#### Database Integration
- Uses `insertBirdSpotting()` from database service
- Automatically handles local storage
- Sets sync flag for cloud backup

#### Firebase Integration (when authenticated)
- Entries marked for sync
- Media files uploaded to Firebase Storage
- Firestore document created

## Technical Implementation Details

### Performance Optimizations
- Lazy loading of media components
- Efficient state updates with useCallback
- Resource cleanup on unmount
- Optimized re-renders with useMemo

### Error Handling
- Try-catch blocks for all async operations
- User-friendly error messages
- Graceful degradation for missing features
- Network failure resilience

### Platform Considerations
- iOS/Android specific date picker handling
- Platform-appropriate styling
- Native video controls
- Cross-platform file URI handling

## Usage Flow

1. **Entry Creation**
   - User navigates to manual entry screen
   - Sees empty form with media strip

2. **Media Capture**
   - Taps media cards to add content
   - Navigates to specialized capture screens
   - Returns with media added to draft

3. **Bird Identification**
   - With audio captured, AI ID card appears
   - Tap to process through ML pipeline
   - Select from predictions or enter manually

4. **Metadata Addition**
   - Set observation date
   - Capture GPS location
   - Add detailed notes

5. **Save and Complete**
   - Validation ensures required fields
   - Confirmation before saving
   - Entry saved to database
   - Navigation to home screen

## Implementation Status

### ✅ Implemented Features

1. **Bird Spotting Entry Fields** - All fields correctly implemented:
   - ✅ All 12 fields from the BirdSpotting interface
   - ✅ Including optional `latinBirDex` field in database
   - ✅ Proper handling of required vs optional fields

2. **Context-Wrapped Media Creators** - Fully functional:
   - ✅ LogDraftContext integration with `useLogDraft()` hook
   - ✅ Navigation to `/log/photo-selection`, `/log/video`, `/log/audio`
   - ✅ Receives media URIs via navigation params
   - ✅ Auto-saves draft to AsyncStorage

3. **Audio ML Pipeline** - Complete implementation:
   - ✅ AudioIdentificationService integration
   - ✅ BirdNet model processing with HIGH_ACCURACY_FP32
   - ✅ Predictions modal with confidence indicators
   - ✅ Timer showing processing duration
   - ✅ Updates `audioPrediction` field on selection

4. **UI Components** - All as specified:
   - ✅ Compact header with progress indicator
   - ✅ Horizontal media strip with status indicators
   - ✅ Inline form fields with icons
   - ✅ Metadata row (date/location)
   - ✅ Save button with validation

5. **Additional Features**:
   - ✅ Haptic feedback on all interactions
   - ✅ Unsaved changes protection
   - ✅ Validation with error messages
   - ✅ Internationalization support
   - ✅ Loading states and error handling

### ❌ Not Yet Implemented

1. **Image ML Pipeline**:
   - ❌ No image classification implementation
   - ❌ `imagePrediction` field exists but is never populated
   - ❌ No MLKit integration for photo analysis in manual entry
   - ❌ No UI elements for triggering image analysis

### 📝 Minor Discrepancies

1. **Field Naming**: Database uses `latinBirDex` but LogDraftContext doesn't include this field
2. **Sync Status**: The `synced` field is handled in database but not exposed in UI

## Future Enhancements

1. **Image-based ML Pipeline** (Primary Missing Feature)
   - Integration with MLKit object detection
   - Real-time bird identification from photos
   - Multi-modal prediction combining audio + image
   - Add "AI ID" button for photos similar to audio

2. **Enhanced Metadata**
   - Weather conditions
   - Habitat type selection
   - Behavior observations
   - Group size/count

3. **Social Features**
   - Share to community
   - Expert verification
   - Collaborative identification

4. **Offline Improvements**
   - Queue for later sync
   - Conflict resolution
   - Selective sync options