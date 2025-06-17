# whoBIRD FP32 Model Testing Suite

## Overview

This comprehensive testing suite validates the integration and functionality of the BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite model with embedded labels. The tests ensure correct data flow, model compatibility, and real-world performance for the LogChirpy bird identification application.

## Model Under Test

- **Model**: BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite
- **Features**: Embedded labels, 6,522 global bird species
- **Precision**: FP32 (maximum accuracy)
- **File Size**: ~49MB
- **Use Case**: High-accuracy bird identification

## Test Suites

### 1. Model Validation (`whobird_fp32_model_validation.test.ts`)
**Priority**: High | **Duration**: ~60s

Validates core model functionality:
- ✅ Model loading and configuration
- ✅ Tensor shape compatibility [224×224×3]
- ✅ Input/output validation
- ✅ Performance metrics
- ✅ Edge case handling

### 2. Audio Preprocessing Pipeline (`audio_preprocessing_pipeline.test.ts`)
**Priority**: High | **Duration**: ~45s

Tests audio data processing:
- ✅ 48kHz audio handling
- ✅ Mel-spectrogram generation
- ✅ Data type consistency (Float32Array)
- ✅ Normalization and formatting
- ✅ Duration trimming/padding

### 3. Model I/O Compatibility (`model_io_compatibility.test.ts`)
**Priority**: High | **Duration**: ~90s

Validates complete data pipeline:
- ✅ Synthetic input processing
- ✅ Data integrity maintenance
- ✅ Performance benchmarking
- ✅ Concurrent processing
- ✅ Error handling

### 4. Embedded Labels Validation (`embedded_labels_validation.test.ts`)
**Priority**: Medium | **Duration**: ~120s

Tests embedded labels functionality:
- ✅ Species name validation
- ✅ Scientific name accuracy
- ✅ Global species coverage
- ✅ Regional diversity
- ✅ Naming consistency

### 5. Real Audio Integration (`real_audio_integration.test.ts`)
**Priority**: Medium | **Duration**: ~180s

End-to-end testing with actual recordings:
- ✅ MP3 format compatibility
- ✅ Forest bird audio processing
- ✅ FP32 vs FP16 comparison
- ✅ Consistency across runs
- ✅ Error recovery

### 6. Camera Pipeline Integration (`camera_audio_pipeline.test.ts`)
**Priority**: Low | **Duration**: ~150s

Tests camera workflow integration:
- ✅ Concurrent visual/audio processing
- ✅ Resource management
- ✅ 5-second audio cycles
- ✅ Pause/resume functionality
- ✅ Extended operation stability

## Running Tests

### Quick Commands

```bash
# Run complete validation suite
npm run test:whobird

# Quick validation (skip low priority)
npm run test:whobird:quick

# Individual test suites
npm run test:model
npm run test:audio
npm run test:integration

# Custom Jest commands
npx jest __tests__/whobird_fp32_model_validation.test.ts --verbose
```

### Test Runner Options

```bash
# Full suite with all options
ts-node __tests__/run_whobird_fp32_tests.ts

# Skip low priority tests
ts-node __tests__/run_whobird_fp32_tests.ts --skip-low

# Quiet mode (minimal output)
ts-node __tests__/run_whobird_fp32_tests.ts --quiet

# Skip report generation
ts-node __tests__/run_whobird_fp32_tests.ts --no-report

# Show help
ts-node __tests__/run_whobird_fp32_tests.ts --help
```

## Expected Results

### Success Criteria

✅ **All High Priority Tests Pass**
- Model loads and processes data correctly
- Audio preprocessing generates compatible tensors
- Model produces valid predictions

✅ **Performance Benchmarks Met**
- Inference time < 3 seconds on mid-range devices
- Memory usage < 100MB during processing
- Stable operation under load

✅ **Real Audio Processing**
- Successfully processes MP3 bird recordings
- Produces meaningful species predictions
- Maintains consistent results

### Sample Success Output

```
📋 FINAL TEST SUMMARY
================================================================================
⏱️  Total Duration: 645.3s (10.8 minutes)
📊 Test Results: 6 passed, 0 failed
📈 Success Rate: 100.0%

1. ✅ Model Validation (high) - 58.2s
2. ✅ Audio Preprocessing Pipeline (high) - 42.1s
3. ✅ Model I/O Compatibility (high) - 87.5s
4. ✅ Embedded Labels Validation (medium) - 118.7s
5. ✅ Real Audio Integration (medium) - 203.2s
6. ✅ Camera Pipeline Integration (low) - 135.6s

💡 RECOMMENDATIONS:
✅ All tests passed! The FP32 model is ready for production use.
🚀 Consider running performance benchmarks on target devices.
📱 Test on various Android/iOS devices to ensure compatibility.

🎉 ALL TESTS PASSED! FP32 MODEL VALIDATION COMPLETE
```

## Troubleshooting

### Common Issues

#### Model Loading Failures
```
❌ Model Validation (high) - 15.2s
   Error: Failed to load model with any delegate
```

**Solutions:**
- Verify model file exists at `assets/models/whoBIRD-TFlite-master/`
- Check react-native-fast-tflite installation
- Ensure proper Metro bundler configuration

#### Audio Processing Errors
```
❌ Audio Preprocessing Pipeline (high) - 8.5s
   Error: AudioDecoder not found
```

**Solutions:**
- Install audio processing dependencies
- Check Expo AV configuration
- Verify microphone permissions

#### Memory Issues
```
❌ Model I/O Compatibility (high) - 45.2s
   Error: Out of memory during inference
```

**Solutions:**
- Close other applications
- Use smaller batch sizes
- Consider FP16 model for testing

### Test Environment Requirements

#### Dependencies
- Node.js >= 16
- React Native development environment
- Expo CLI
- Jest testing framework
- TypeScript

#### Hardware
- **Minimum**: 4GB RAM, dual-core processor
- **Recommended**: 8GB+ RAM, quad-core processor
- **Storage**: 2GB free space for models and test data

#### Audio Files
- Place test audio files in appropriate directories
- Supported formats: MP3, WAV, M4A
- Sample file: `assets/mixkit-forest-birds-singing-1212.mp3`

## Test Reports

Reports are automatically generated and saved to `test-reports/` directory:

```json
{
  "timestamp": "2024-12-28T10:30:45.123Z",
  "summary": {
    "totalTests": 6,
    "passed": 6,
    "failed": 0,
    "successRate": "100.0",
    "totalDuration": "645.3"
  },
  "results": [...],
  "recommendations": [...]
}
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: whoBIRD Model Validation
on: [push, pull_request]

jobs:
  test-model:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:whobird:quick
```

### Pre-deployment Checklist

- [ ] All high priority tests pass
- [ ] Performance benchmarks met
- [ ] Real audio processing validated
- [ ] No memory leaks detected
- [ ] Cross-platform compatibility verified

## Contributing

When adding new tests:

1. Follow existing naming conventions
2. Include comprehensive error handling
3. Add performance measurements
4. Update this README
5. Ensure tests are deterministic and repeatable

## Support

For issues or questions about the testing suite:

1. Check the troubleshooting section above
2. Review test logs and error messages
3. Verify all dependencies are installed
4. Ensure test environment meets requirements

---

**Last Updated**: December 2024  
**Test Suite Version**: 1.0  
**Compatible Model**: BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite