// Minimal Jest setup for model testing

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(undefined),
  multiRemove: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined)
}));

// Mock File System
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
  readAsStringAsync: jest.fn().mockResolvedValue('mock file content'),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn().mockResolvedValue([]),
  documentDirectory: '/mock/documents/',
  cacheDirectory: '/mock/cache/',
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64'
  }
}));

// Mock Audio
jest.mock('expo-av', () => ({
  Audio: {
    Recording: class MockRecording {
      prepareToRecordAsync = jest.fn().mockResolvedValue(undefined);
      startAsync = jest.fn().mockResolvedValue(undefined);
      stopAndUnloadAsync = jest.fn().mockResolvedValue(undefined);
      getURI = jest.fn().mockReturnValue('/mock/audio/recording.m4a');
    },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    AndroidOutputFormat: { MPEG_4: 'mp4' },
    AndroidAudioEncoder: { AAC: 'aac' },
    IOSOutputFormat: { MPEG4AAC: 'mp4' },
    IOSAudioQuality: { HIGH: 'high', MEDIUM: 'medium' }
  }
}));

// Model files are handled by moduleNameMapper in package.json

// Mock react-native-fast-tflite
jest.mock('react-native-fast-tflite', () => {
  return require('./__tests__/__mocks__/react-native-fast-tflite');
});

// Mock labels
jest.mock('../assets/models/birdnet/labels.json', () => ({
  labels: [
    { index: 0, scientific_name: 'Turdus migratorius', common_name: 'American Robin' },
    { index: 1, scientific_name: 'Passer domesticus', common_name: 'House Sparrow' }
  ]
}), { virtual: true });

// Mock other services that aren't critical for model testing
jest.mock('./services/audioDecoder', () => ({
  AudioDecoder: {
    decodeAudioFile: jest.fn().mockResolvedValue({
      data: new Float32Array(144000), // 3 seconds at 48kHz
      sampleRate: 48000
    })
  }
}));

// Global setup
global.console = {
  ...console,
  // Keep console.log but reduce noise from warnings
  warn: jest.fn(),
  error: jest.fn()
};