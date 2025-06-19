# Audio Pipeline Analysis & Two-Model Architecture Investigation

**Timestamp: 2025-06-16 [Current Session]**  
**Status: IN PROGRESS - Architecture Verification Phase**

## 🎯 Current Objective

**PRIMARY GOAL**: Determine the correct whoBIRD model architecture and fix audio pipeline implementation

We need to definitively answer: **Are we using two separate TFLite models (audio + meta) OR single MData models with embedded metadata processing?**

## 📊 Current Knowledge & Status

### ✅ **What We've Fixed:**
1. **Metro Bundler Compatibility**: Fixed model loading using static require() approach via BirdLabelsMap
2. **Component Exports**: Resolved ObjectIdentCamera navigation issues  
3. **TypeScript Compilation**: All compilation errors resolved
4. **Label Loading**: Implemented reliable text file loading system

### 🔍 **Available Models (Confirmed):**
```
/assets/models/whoBIRD-TFlite-master/
├── BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite     (49MB - High accuracy)
├── BirdNET_GLOBAL_6K_V2.4_Model_FP16.tflite     (25MB - Balanced)  
├── BirdNET_GLOBAL_6K_V2.4_MData_Model_FP16.tflite (27MB - With metadata)
└── BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16.tflite (27MB - Enhanced)
```

### ❓ **Critical Architecture Questions:**

#### **Option A: Two-Model Architecture**
- Main audio model: Raw Float32 audio → species probabilities
- Separate meta model: [lat, lng, week] → location filters
- Blend results using whoBIRD formula

#### **Option B: Single MData Model** 
- Single model with multiple inputs: audio + metadata → enhanced predictions
- Models handle blending internally

### 📱 **Current Implementation Status:**

**File: `fastTfliteBirdClassifier.ts`** - Recently modified to use **single model approach**:
```typescript
// Current implementation (simplified after user feedback)
const modelInputs = [processedData]; // Only audio input
const outputs = this.model.runSync(modelInputs);
let probabilities = this.applySigmoid(outputs[0]);

// Optional meta model blending (if separate meta model exists)
if (this.config.useMetaModel && this.metaModelLoaded && location) {
    const metaProbabilities = await this.runMetaModelInference(location);
    probabilities = this.blendPredictions(probabilities, metaProbabilities);
}
```

**Issue**: We're still uncertain which approach is correct.

## 🔬 **Testing Infrastructure Ready**

### Model Properties Test Component
**File: `components/ModelPropertiesTest.tsx`** - Enhanced comprehensive testing tool:

**Features:**
- ✅ Load all 4 TFLite models
- ✅ Analyze input/output tensor shapes and sizes  
- ✅ Determine if models expect 1 or 2+ inputs
- ✅ Run inference with realistic dummy data
- ✅ Measure performance and memory usage
- ✅ Generate research findings and recommendations

**Access**: "Test Models" button added to ObjectIdentCamera screen

### Expected Test Results:
```
Input Analysis:
- 1 input (144k elements) = Audio-only model
- 2+ inputs (144k + 3 elements) = Audio + metadata model  
- 3 elements only = Pure metadata model

Output Analysis:  
- 6522 elements = Species classifications (global database)
- Raw logits requiring sigmoid activation
```

## 🎵 **Audio Pipeline Flow (Current):**
```
ObjectIdentCamera → LiveAudioRecordingService → FastTfliteBirdClassifier
                                             ↓
Raw 48kHz PCM → Float32Array → Model(s) → Species Predictions
```

**Audio Processing**: ✅ Correctly uses raw Float32 samples (not mel-spectrograms)  
**Sample Rate**: ✅ 48kHz, 3-second clips = 144,000 samples  
**Preprocessing**: ✅ AudioPreprocessingTFLite handles conversion properly

## 🗂️ **File Status Summary:**

### ✅ **Working Files:**
- `services/generated/BirdLabelsMap.ts` - Static label loading
- `services/modelConfig.ts` - Model path management
- `app/log/objectIdentCamera.tsx` - Camera with test button
- `components/ModelPropertiesTest.tsx` - Comprehensive model testing

### ⚠️ **Files Needing Updates (Based on Test Results):**
- `services/fastTfliteBirdClassifier.ts` - Architecture implementation
- `services/liveAudioRecordingService.ts` - Model integration
- `services/audioPreprocessingTFLite.ts` - Input preparation

## 🔄 **Next Steps (Priority Order):**

### **IMMEDIATE (Required to proceed):**
1. **Run Model Properties Test** - Use the "Test Models" button in ObjectIdentCamera
2. **Analyze Test Results** - Determine actual model input/output shapes
3. **Verify whoBIRD Source** - Check original implementation in whoBIRD-master

### **BASED ON TEST RESULTS:**

#### **If Models Have 1 Input Each (Option A - Two Models):**
- Implement proper two-model architecture
- Main model: audio → predictions  
- Meta model: [lat,lng,week] → filters
- Blend using whoBIRD formula

#### **If MData Models Have 2+ Inputs (Option B - Single Model):**
- Update input preparation to include metadata
- Modify `prepareModelInputs()` method
- Remove separate meta model concept

### **FOLLOW-UP:**
1. Fix any input shape mismatches found in testing
2. Optimize performance based on actual model requirements  
3. Add proper error handling and fallbacks
4. Test end-to-end pipeline with real audio

## 📋 **Todo List Status:**
- [x] Verify model pairing compatibility  
- [ ] Fix input shape mismatches (depends on test results)
- [ ] Validate two-model integration (depends on architecture)
- [ ] Test end-to-end pipeline performance
- [ ] Add debugging and monitoring capabilities

## 🚨 **Critical Blockers:**
1. **Architecture Uncertainty**: Need test results to determine correct implementation
2. **whoBIRD Source Analysis**: Should verify against original implementation

## 💡 **Key Insights:**
- Metro bundler requires static require() statements (fixed)
- All models expect 144k Float32 samples for 3-second audio at 48kHz
- MData models likely contain embedded metadata processing capabilities
- BirdLabelsMap approach successfully resolves asset loading issues

---

**For Next Developer**: Run the ModelPropertiesTest to get concrete evidence of model architecture, then implement the correct approach based on actual tensor shapes and input requirements.