// Jest setup file for mocking React Native modules

// Setup React Native Testing Library (built-in matchers included in v12.4+)

// Mock AsyncStorage
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock MLKit Image Labeling
jest.mock('@infinitered/react-native-mlkit-image-labeling', () => ({
  ImageLabeling: {
    initialize: jest.fn().mockResolvedValue(undefined),
    label: jest.fn().mockResolvedValue([]),
  },
}));

// Removed react-native-reanimated mock since we no longer use reanimated

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
  readAsStringAsync: jest.fn().mockResolvedValue('mock file content'),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

jest.mock('expo-av', () => ({
  Audio: {
    RecordingOptionsPresets: {
      HIGH_QUALITY: {},
    },
    Recording: class MockRecording {
      prepareToRecordAsync = jest.fn().mockResolvedValue(undefined);
      startAsync = jest.fn().mockResolvedValue(undefined);
      stopAndUnloadAsync = jest.fn().mockResolvedValue({ uri: 'mock://audio.mp3' });
      getStatusAsync = jest.fn().mockResolvedValue({ isDoneRecording: true });
    },
    Sound: class MockSound {
      static createAsync = jest.fn().mockResolvedValue({
        sound: {
          getStatusAsync: jest.fn().mockResolvedValue({
            isLoaded: true,
            durationMillis: 3000
          }),
          unloadAsync: jest.fn().mockResolvedValue(undefined)
        }
      });
      loadAsync = jest.fn().mockResolvedValue(undefined);
      playAsync = jest.fn().mockResolvedValue(undefined);
      stopAsync = jest.fn().mockResolvedValue(undefined);
      unloadAsync = jest.fn().mockResolvedValue(undefined);
    },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock .tflite files
jest.mock('../assets/models/birdnet/birdnet_v24.tflite', () => 'mock-tflite-path', { virtual: true });

// Mock labels.json
jest.mock('../assets/models/birdnet/labels.json', () => ({
  labels: [
    { index: 0, scientific_name: 'Turdus migratorius', common_name: 'American Robin', label: 'Turdus migratorius_American Robin' },
    { index: 1, scientific_name: 'Passer domesticus', common_name: 'House Sparrow', label: 'Passer domesticus_House Sparrow' }
  ]
}), { virtual: true });

// Mock CSV files
jest.mock('../assets/birds_fully_translated.csv', () => 'mock-csv-data', { virtual: true });

// Mock whoBIRD TFLite models and related assets
jest.mock('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_Model_FP16.tflite', () => 'mock-whobird-fp16-path', { virtual: true });
jest.mock('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite', () => 'mock-whobird-fp32-path', { virtual: true });
jest.mock('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_MData_Model_FP16.tflite', () => 'mock-whobird-mdata-fp16-path', { virtual: true });
jest.mock('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16.tflite', () => 'mock-whobird-mdata-v2-fp16-path', { virtual: true });

// Mock react-native-fast-tflite
jest.mock('react-native-fast-tflite', () => {
  return require('./__mocks__/react-native-fast-tflite');
});

// Mock any additional ML Kit dependencies
jest.mock('@infinitered/react-native-mlkit-object-detection', () => ({
  ObjectDetection: {
    initialize: jest.fn().mockResolvedValue(undefined),
    detect: jest.fn().mockResolvedValue([]),
  },
}));