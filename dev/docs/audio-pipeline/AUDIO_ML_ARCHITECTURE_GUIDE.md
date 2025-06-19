# Audio ML Architecture Guide for LogChirpy Bird Recognition

## Table of Contents
- [Overview](#overview)
- [Architecture Components](#architecture-components)
- [ML Model Implementation](#ml-model-implementation)
- [Data Flow Pipeline](#data-flow-pipeline)
- [Label and Asset Management](#label-and-asset-management)
- [Database Schema](#database-schema)
- [Multi-language Support](#multi-language-support)
- [React Native Implementation Guide](#react-native-implementation-guide)
- [Technical Implementation Details](#technical-implementation-details)
- [File References](#file-references)

## Overview

LogChirpy implements a sophisticated dual-model audio classification system for real-time bird species identification. The system combines a primary BirdNet-based acoustic model with a seasonal/geographic meta-model to provide context-aware predictions. This guide provides comprehensive documentation for ML engineers and developers implementing similar systems.

### Key Features
- **Real-time audio processing** at 48kHz sample rate
- **Dual TensorFlow Lite models** (primary + meta)
- **6,522 bird species** classification capability
- **Multi-language support** (40+ languages)
- **Seasonal/geographic context** integration
- **Local SQLite storage** with cloud synchronization
- **Macaulay Library integration** for species imagery

## Architecture Components

### Core Components
```
┌─────────────────────────────────────────────────────────────┐
│                    Audio Input Pipeline                     │
├─────────────────────────────────────────────────────────────┤
│ AudioRecord → Preprocessing → Circular Buffer → Model Input │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Dual Model System                        │
├─────────────────────────────────────────────────────────────┤
│  Primary Model (BirdNet)     │  Meta Model (Seasonal/Geo)   │
│  - Audio → Species Logits    │  - Location/Time → Probs     │
│  - 6,522 output classes      │  - 6,522 output classes      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│               Output Processing & Storage                   │
├─────────────────────────────────────────────────────────────┤
│ Sigmoid → Meta Blending → Top-2 Predictions → SQLite       │
└─────────────────────────────────────────────────────────────┘
```

### File Structure
```
app/src/main/
├── java/org/tensorflow/lite/examples/soundclassifier/
│   ├── SoundClassifier.kt          # Core ML implementation
│   ├── MainActivity.kt             # UI and lifecycle management
│   ├── BirdDBHelper.java          # Database operations
│   └── ViewActivity.kt            # Results visualization
├── assets/
│   ├── labels_[lang].txt          # Localized species labels
│   ├── assets.txt                 # Macaulay Library asset IDs
│   ├── model.tflite              # Primary BirdNet model
│   └── metaModel.tflite          # Seasonal/geographic model
└── res/
    └── [UI layouts and resources]
```

## ML Model Implementation

### Primary Model (model.tflite)
**Source**: BirdNet-based TensorFlow Lite model converted from .h5 format

**Input Specifications**:
- **Shape**: `[1, modelInputLength]` (typically 144,000 samples)
- **Type**: Float32
- **Sample Rate**: 48,000 Hz
- **Duration**: ~3 seconds of audio
- **Preprocessing**: PCM16 → Float32 normalization (`sample / 32768.0`)

**Model Architecture**:
```kotlin
// From SoundClassifier.kt:257-292
val inputShape = interpreter.getInputTensor(0).shape()
modelInputLength = inputShape[1]  // e.g., 144,000

val outputShape = interpreter.getOutputTensor(0).shape()
modelNumClasses = outputShape[1]  // 6,522 species
```

**Output Processing**:
```kotlin
// SoundClassifier.kt:550-578
interpreter.run(inputBuffer, outputBuffer)
outputBuffer.get(predictionProbs) // Raw logits

// Apply sigmoid activation
val modelProb = 1 / (1 + exp(-predictionProbs[i]))
```

### Meta Model (metaModel.tflite)
**Purpose**: Provides seasonal and geographic probability adjustments

**Input Specifications**:
- **Shape**: `[1, 3]`
- **Parameters**:
  1. `latitude` (Float32)
  2. `longitude` (Float32) 
  3. `seasonal_factor` (Float32)

**Seasonal Factor Calculation**:
```kotlin
// SoundClassifier.kt:332-376
val dayOfYear = LocalDate.now().dayOfYear
val week = ceil(dayOfYear * 48.0 / 366.0) // 48-week model year
val weekMeta = cos(Math.toRadians(week * 7.5)) + 1.0

metaInputBuffer.put(0, lat)
metaInputBuffer.put(1, lon)
metaInputBuffer.put(2, weekMeta.toFloat())
```

**Meta Model Processing Modes**:

1. **Standard Mode**: Current week only
2. **Extended Mode**: Maximum probability across all 48 weeks
```kotlin
// SoundClassifier.kt:385-396
if (metaExtended) {
    val blended = 0.5f * applyMetaThreshold(metaPredictionProbs[i]) +
                  0.5f * applyMetaThreshold(metaPredictionProbsMax[i])
    metaPredictionProbs[i] = blended
}
```

**Meta Thresholding**:
```kotlin
// SoundClassifier.kt:398-405
fun applyMetaThreshold(prob: Float): Float {
    return when {
        prob >= metaProbabilityThreshold1 -> 1f    // >= 0.01
        prob >= metaProbabilityThreshold2 -> 0.8f  // >= 0.008  
        prob >= metaProbabilityThreshold3 -> 0.5f  // >= 0.001
        else -> 0f
    }
}
```

## Data Flow Pipeline

### Audio Capture and Preprocessing

1. **Audio Record Setup**:
```kotlin
// SoundClassifier.kt:424-462
audioRecord = AudioRecord(
    audioSource,           // UNPROCESSED/MIC/CAMCORDER
    48000,                // Sample rate
    AudioFormat.CHANNEL_IN_MONO,
    AudioFormat.ENCODING_PCM_16BIT,
    bufferSize
)
```

2. **Circular Buffer Implementation**:
```kotlin
// SoundClassifier.kt:500-530
val circularBuffer = ShortArray(modelInputLength)
var j = 0 // Write pointer

// Copy new samples into circular buffer
for (i in 0 until sampleCounts) {
    circularBuffer[j] = recordingBuffer[i]
    j = (j + 1) % circularBuffer.size
}

// Extract ordered samples for model input
for (i in 0 until modelInputLength) {
    val s = circularBuffer[(i + j) % modelInputLength]
    inputBuffer.put(i, s.toFloat()) // or filtered version
}
```

3. **Optional High-Pass Filtering**:
```kotlin
// SoundClassifier.kt:496-530
val butterworth = Butterworth()
butterworth.highPass(6, 48000.0, highPass.toDouble())

// Apply filter if enabled
if (highPass == 0) inputBuffer.put(i, s.toFloat())
else inputBuffer.put(i, butterworth.filter(s.toDouble()).toFloat())
```

### Model Inference Pipeline

```kotlin
// SoundClassifier.kt:550-578
fun recognizeAndDisplay(inputBuffer: FloatBuffer, outputBuffer: FloatBuffer) {
    // 1. Primary model inference
    interpreter.run(inputBuffer, outputBuffer)
    outputBuffer.get(predictionProbs)
    
    // 2. Apply sigmoid and meta blending
    val metaInfluence = metaInfluenceSlider.value / 100.0f
    val probList = mutableListOf<Float>()
    
    for (i in predictionProbs.indices) {
        val modelProb = 1 / (1 + exp(-predictionProbs[i])) // Sigmoid
        val finalProb = modelProb * (1 - metaInfluence + 
                                   metaInfluence * metaPredictionProbs[i])
        probList.add(finalProb)
    }
    
    // 3. Find top 2 predictions
    val max = probList.withIndex().maxByOrNull { it.value }
    val secondMax = probList.withIndex()
                           .filterNot { it == max }
                           .maxByOrNull { it.value }
    
    // 4. Update UI and store results
    updateTextView(max, binding.text1, timeInMillis)
    updateTextView(secondMax, binding.text2, timeInMillis)
}
```

## Label and Asset Management

### Label File Structure
**Location**: `/app/src/main/assets/labels_[language].txt`

**Format**: Each line contains:
```
Scientific_Name_Common Name
```

**Examples**:
```
Abroscopus albogularis_Rufous-faced Warbler
Turdus migratorius_American Robin
Corvus corax_Common Raven
```

**Parsing Logic**:
```kotlin
// SoundClassifier.kt:644-645, 612-613
val label = labelList[element.index].split("_").last()       // "American Robin"
val scientificName = labelList[element.index].split("_").first() // "Turdus migratorius"
```

### Asset Mapping System
**Location**: `/app/src/main/assets/assets.txt`

**Structure**: One-to-one mapping with label files
- **Line N in labels_en.txt** ↔ **Line N in assets.txt**
- **Total entries**: 6,522 (matching number of species)

**Asset ID Usage**:
```kotlin
// SoundClassifier.kt:585-590
val url = if (max.value > displayImageThreshold && 
              assetList[max.index] != "NO_ASSET") {
    "https://macaulaylibrary.org/asset/" + assetList[max.index] + "/embed"
} else {
    binding.webview.url
}
```

**Asset Examples**:
```
38312361  // Corresponds to Abroscopus albogularis
144126191 // Corresponds to Abroscopus schisticeps
NO_ASSET  // No image available for this species
```

### Multi-language Label Loading
```kotlin
// SoundClassifier.kt:205-255
private fun loadLabels(context: Context) {
    val localeList = context.resources.configuration.locales
    var language = localeList.get(0).language
    
    // Handle regional variants
    if (language == "en") {
        val country = localeList.get(0).country
        language = when (country) {
            "GB" -> "en_uk"
            else -> "en"
        }
    }
    
    var filename = "labels_${language}.txt"
    
    // Fallback to English if language not available
    val assetManager = context.assets
    val mapList = assetManager.list("")?.toMutableList()
    if (mapList != null && !mapList.contains(filename)) {
        filename = "labels_en.txt"
    }
    
    // Load and process labels
    val reader = BufferedReader(InputStreamReader(context.assets.open(filename)))
    labelList = reader.useLines { lines ->
        lines.map { it.toTitleCase() }.toList()
    }
}
```

### Supported Languages
The system supports 40+ languages with dedicated label files:
- `labels_en.txt` - English
- `labels_de.txt` - German  
- `labels_es.txt` - Spanish
- `labels_fr.txt` - French
- `labels_ar.txt` - Arabic
- `labels_uk.txt` - Ukrainian
- `labels_zh.txt` - Chinese
- `labels_ja.txt` - Japanese
- ... and 30+ more

## Database Schema

### SQLite Table Structure
**Table**: `BirdObservations`

```sql
CREATE TABLE BirdObservations (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    TimeInMillis LONG,
    Latitude FLOAT,
    Longitude FLOAT,
    SpeciesName TEXT,
    BirdNET_ID INTEGER,
    Probability FLOAT
);
```

### Database Operations
**File**: `/app/src/main/java/org/tensorflow/lite/examples/soundclassifier/BirdDBHelper.java`

**Insert Operation**:
```java
// BirdDBHelper.java:50-62
public synchronized void addEntry(String name, float latitude, float longitude, 
                                  int speciesId, float probability, long timeInMillis) {
    SQLiteDatabase db = getWritableDatabase();
    ContentValues cv = new ContentValues();
    cv.put(COLUMN_NAME, name);
    cv.put(COLUMN_MILLIS, timeInMillis);
    cv.put(COLUMN_LATITUDE, latitude);
    cv.put(COLUMN_LONGITUDE, longitude);
    cv.put(COLUMN_SPECIES_ID, speciesId);
    cv.put(COLUMN_PROBABILITY, probability);
    
    db.insert(TABLE_NAME, null, cv);
}
```

**Data Storage Trigger**:
```kotlin
// SoundClassifier.kt:653-655
val currentLocation = LocationHelper.getPreciseLocation()
database?.addEntry(label, currentLocation.latitude.toFloat(), 
                  currentLocation.longitude.toFloat(), 
                  element.index, element.value, timeInMillis)
```

### Export Functionality
```java
// BirdDBHelper.java:71-95
public synchronized List<String> exportAllEntriesAsCSV() {
    String SELECT_ALL = "SELECT * FROM " + TABLE_NAME;
    Cursor cursor = db.rawQuery(SELECT_ALL, null);
    
    List<String> csvDataList = new ArrayList<>();
    if (cursor != null && cursor.moveToFirst()) {
        do {
            long millis = cursor.getLong(1);
            float latitude = cursor.getFloat(2);
            float longitude = cursor.getFloat(3);
            String nameStr = cursor.getString(4);
            int speciesId = cursor.getInt(5);
            float probability = cursor.getFloat(6);
            
            String csvString = millis + "," + latitude + "," + longitude + 
                              "," + nameStr + "," + speciesId + "," + probability;
            csvDataList.add(csvString);
        } while (cursor.moveToNext());
    }
    return csvDataList;
}
```

## Multi-language Support

### Implementation Strategy
1. **Label Files**: Separate translation files for each language
2. **Automatic Detection**: System locale determines language
3. **Fallback Mechanism**: Defaults to English if language unavailable
4. **Title Case Formatting**: Consistent capitalization across languages

### Adding New Languages
1. **Create Label File**: `labels_[lang_code].txt`
2. **Translate All 6,522 Entries**: Maintain scientific name prefix
3. **Format**: `Scientific_Name_Translated Common Name`
4. **Place in Assets**: `/app/src/main/assets/`

**Example Translation Process**:
```
English:    Turdus migratorius_American Robin
German:     Turdus migratorius_Wanderdrossel  
Spanish:    Turdus migratorius_Petirrojo Americano
French:     Turdus migratorius_Merle d'Amérique
```

## React Native Implementation Guide

### Core Architecture Translation

For implementing this system in React Native, follow these architectural patterns:

#### 1. Audio Processing Module
```typescript
// AudioClassifier.ts
import { TensorflowLite } from 'react-native-tensorflow-lite';
import { AudioRecord } from 'react-native-audio-record';

class AudioBirdClassifier {
  private model: TensorflowLite.Model;
  private metaModel: TensorflowLite.Model;
  private audioRecord: AudioRecord;
  private circularBuffer: Float32Array;
  
  constructor() {
    this.setupModels();
    this.setupAudioRecord();
  }
  
  private async setupModels() {
    this.model = await TensorflowLite.loadModel({
      model: 'assets/model.tflite',
      inputShape: [1, 144000],
      outputShape: [1, 6522]
    });
    
    this.metaModel = await TensorflowLite.loadModel({
      model: 'assets/metaModel.tflite', 
      inputShape: [1, 3],
      outputShape: [1, 6522]
    });
  }
}
```

#### 2. Label Management Service
```typescript
// LabelService.ts
class LabelService {
  private labels: string[] = [];
  private assets: string[] = [];
  
  async loadLabels(language: string = 'en') {
    try {
      const labelFile = `labels_${language}.txt`;
      const labelData = await RNFS.readFileAssets(labelFile);
      this.labels = labelData.split('\n').map(line => this.toTitleCase(line));
    } catch (error) {
      // Fallback to English
      const labelData = await RNFS.readFileAssets('labels_en.txt');
      this.labels = labelData.split('\n').map(line => this.toTitleCase(line));
    }
  }
  
  getCommonName(index: number): string {
    return this.labels[index].split('_').pop() || '';
  }
  
  getScientificName(index: number): string {
    return this.labels[index].split('_')[0] || '';
  }
  
  getAssetUrl(index: number): string {
    const assetId = this.assets[index];
    return assetId !== 'NO_ASSET' 
      ? `https://macaulaylibrary.org/asset/${assetId}/embed`
      : null;
  }
}
```

#### 3. Database Integration
```typescript
// DatabaseService.ts
import SQLite from 'react-native-sqlite-storage';

class BirdDatabase {
  private db: SQLite.SQLiteDatabase;
  
  async initDatabase() {
    this.db = await SQLite.openDatabase({
      name: 'BirdDatabase.db',
      location: 'default'
    });
    
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS BirdObservations (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        TimeInMillis INTEGER,
        Latitude REAL,
        Longitude REAL,
        SpeciesName TEXT,
        BirdNET_ID INTEGER,
        Probability REAL
      )
    `);
  }
  
  async addObservation(observation: BirdObservation) {
    await this.db.executeSql(
      'INSERT INTO BirdObservations (TimeInMillis, Latitude, Longitude, SpeciesName, BirdNET_ID, Probability) VALUES (?, ?, ?, ?, ?, ?)',
      [observation.timeInMillis, observation.latitude, observation.longitude, 
       observation.speciesName, observation.speciesId, observation.probability]
    );
  }
}
```

#### 4. Meta Model Integration
```typescript
// MetaModelService.ts
class MetaModelService {
  calculateSeasonalFactor(): number {
    const now = new Date();
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    const week = Math.ceil(dayOfYear * 48.0 / 366.0);
    return Math.cos((week * 7.5) * Math.PI / 180) + 1.0;
  }
  
  async runMetaModel(latitude: number, longitude: number): Promise<Float32Array> {
    const seasonalFactor = this.calculateSeasonalFactor();
    const input = new Float32Array([latitude, longitude, seasonalFactor]);
    
    const output = await this.metaModel.predict(input);
    return this.applyThresholding(output);
  }
  
  private applyThresholding(probs: Float32Array): Float32Array {
    return probs.map(prob => {
      if (prob >= 0.01) return 1.0;
      if (prob >= 0.008) return 0.8;
      if (prob >= 0.001) return 0.5;
      return 0.0;
    });
  }
}
```

#### 5. Real-time Processing Hook
```typescript
// useAudioClassification.ts
import { useEffect, useState } from 'react';

export const useAudioClassification = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  
  useEffect(() => {
    if (!isRecording) return;
    
    const processAudio = async () => {
      // Get audio buffer from circular buffer
      const audioBuffer = getLatestAudioBuffer();
      
      // Run primary model
      const modelOutput = await classifier.predict(audioBuffer);
      
      // Apply sigmoid activation
      const probabilities = modelOutput.map(logit => 1 / (1 + Math.exp(-logit)));
      
      // Blend with meta model predictions
      const location = await getCurrentLocation();
      const metaProbs = await metaService.runMetaModel(location.latitude, location.longitude);
      
      const metaInfluence = 0.5; // From UI slider
      const finalProbs = probabilities.map((prob, i) => 
        prob * (1 - metaInfluence + metaInfluence * metaProbs[i])
      );
      
      // Get top 2 predictions
      const indexed = finalProbs.map((prob, index) => ({ prob, index }));
      const sorted = indexed.sort((a, b) => b.prob - a.prob);
      
      setPredictions(sorted.slice(0, 2));
    };
    
    const interval = setInterval(processAudio, 800); // Every 800ms
    return () => clearInterval(interval);
  }, [isRecording]);
  
  return { predictions, isRecording, setIsRecording };
};
```

### Required React Native Dependencies
```json
{
  "react-native-tensorflow-lite": "^1.0.0",
  "react-native-audio-record": "^0.2.0", 
  "react-native-sqlite-storage": "^6.0.0",
  "react-native-fs": "^2.20.0",
  "react-native-permissions": "^3.0.0",
  "@react-native-community/geolocation": "^3.0.0"
}
```

## Technical Implementation Details

### Performance Optimizations

1. **Circular Buffer**: Prevents memory allocation on each audio read
```kotlin
// Efficient buffer management
val circularBuffer = ShortArray(modelInputLength)
// Reuse same buffer, only update write pointer
```

2. **Model Caching**: Models loaded once at startup
```kotlin
// Load models during initialization, not per-inference
setupInterpreter(context)
setupMetaInterpreter(context)
```

3. **Inference Timing**: Configurable interval (default 800ms)
```kotlin
// Balance between responsiveness and CPU usage
recognitionTask = Timer().scheduleAtFixedRate(inferenceInterval, inferenceInterval)
```

### Memory Management

1. **Buffer Allocation**: Pre-allocated buffers prevent GC pressure
```kotlin
inputBuffer = FloatBuffer.allocate(modelInputLength)
predictionProbs = FloatArray(modelNumClasses) { Float.NaN }
```

2. **Resource Cleanup**: Proper cleanup on stop/pause
```kotlin
fun stop() {
    recognitionTask?.cancel()
    audioRecord.stop()
    isRecording = false
}
```

### Error Handling

1. **Audio Record Validation**: Check for initialization errors
```kotlin
if (audioRecord.state != AudioRecord.STATE_INITIALIZED) {
    Log.e(TAG, "AudioRecord failed to initialize")
    return
}
```

2. **Model Loading Safety**: Graceful degradation on model load failure
```kotlin
try {
    interpreter = Interpreter(tfliteBuffer, Interpreter.Options())
} catch (e: IOException) {
    Log.e(TAG, "Failed to load TFLite model - ${e.message}")
    return
}
```

3. **Silent Audio Detection**: Prevent processing of empty audio
```kotlin
if (samplesAreAllZero) {
    Log.w(TAG, "Samples are all zero")
    return@task
}
```

### UI Integration

1. **Confidence Color Coding**:
```kotlin
// SoundClassifier.kt:648-652
if (element.value < 0.3) tv.setBackgroundResource(R.drawable.oval_red_dotted)
else if (element.value < 0.5) tv.setBackgroundResource(R.drawable.oval_red)
else if (element.value < 0.65) tv.setBackgroundResource(R.drawable.oval_orange)
else if (element.value < 0.8) tv.setBackgroundResource(R.drawable.oval_yellow)
else tv.setBackgroundResource(R.drawable.oval_green)
```

2. **Async UI Updates**: All UI updates on main thread
```kotlin
Handler(Looper.getMainLooper()).post {
    tv.setText(label + "  " + Math.round(element.value * 100.0) + "%")
}
```

## File References

### Core Implementation Files
- **Main ML Logic**: `/app/src/main/java/org/tensorflow/lite/examples/soundclassifier/SoundClassifier.kt`
- **Database Operations**: `/app/src/main/java/org/tensorflow/lite/examples/soundclassifier/BirdDBHelper.java`
- **UI Controller**: `/app/src/main/java/org/tensorflow/lite/examples/soundclassifier/MainActivity.kt`

### Data Assets
- **English Labels**: `/app/src/main/assets/labels_en.txt` (6,522 species)
- **Asset Mapping**: `/app/src/main/assets/assets.txt` (6,522 Macaulay Library IDs)
- **All Language Labels**: `/app/src/main/assets/labels_[lang].txt` (40+ languages)

### Model Files
- **Primary Model**: `/app/src/main/assets/model.tflite` (BirdNet-based)
- **Meta Model**: `/app/src/main/assets/metaModel.tflite` (Seasonal/Geographic)

### Configuration
- **Manifest**: `/app/src/main/AndroidManifest.xml`
- **Preferences**: `/app/src/main/res/xml/root_preferences.xml`

## Conclusion

This architecture provides a robust foundation for real-time bird audio classification with the following key strengths:

1. **Scalability**: Supports 6,522+ species with room for expansion
2. **Localization**: 40+ language support with consistent data structure
3. **Context Awareness**: Seasonal and geographic probability adjustments
4. **Performance**: Optimized for real-time mobile processing
5. **Data Integrity**: Comprehensive SQLite storage with export capabilities
6. **Extensibility**: Modular design supports additional ML models and features

The dual-model approach combining acoustic classification with meta-context represents a sophisticated ML system suitable for production bird monitoring applications. The comprehensive labeling system and asset integration provide rich user experiences while maintaining data consistency across all supported languages.