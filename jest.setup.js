// Jest setup file for mocking React Native modules

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

// Mock other React Native modules that might cause issues in tests
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

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
      loadAsync = jest.fn().mockResolvedValue(undefined);
      playAsync = jest.fn().mockResolvedValue(undefined);
      stopAsync = jest.fn().mockResolvedValue(undefined);
      unloadAsync = jest.fn().mockResolvedValue(undefined);
    },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
}));