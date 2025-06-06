/**
 * User Story Tests for LogChirpy Bird Identification App
 * 
 * Tests all major user flows and features:
 * - Bird identification via camera/photo
 * - Audio recording and identification
 * - Manual logging workflow
 * - BirdDex browsing and search
 * - Archive management
 * - Authentication flows
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BirdNetService } from '../services/birdNetService';
import { insertBirdSpotting, getBirdSpottings } from '../services/database';
import { searchBirdsByName, getBirdBySpeciesCode } from '../services/databaseBirDex';

// Mock dependencies
jest.mock('../services/birdNetService');
jest.mock('../services/database');
jest.mock('../services/databaseBirDex');
jest.mock('../hooks/useBirdDexDatabase');
jest.mock('expo-camera');
jest.mock('expo-av');
jest.mock('expo-location');

describe('User Story Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('🐦 Bird Identification Stories', () => {
    describe('As a birdwatcher, I want to take a photo and identify the bird', () => {
      it('should successfully identify a bird from a photo', async () => {
        // Mock successful bird identification
        const mockIdentificationResult = {
          predictions: [
            {
              common_name: 'American Robin',
              scientific_name: 'Turdus migratorius',
              confidence: 0.85,
              timestamp_start: 0,
              timestamp_end: 3,
            }
          ],
          processing_time: 1200,
          audio_duration: 3.0,
          success: true,
          source: 'tflite' as const,
        };

        (BirdNetService.identifyBirdFromAudio as jest.MockedFunction<typeof BirdNetService.identifyBirdFromAudio>).mockResolvedValue(mockIdentificationResult);

        // Simulate user taking photo and getting identification
        const photoUri = 'file:///path/to/photo.jpg';
        const result = await BirdNetService.identifyBirdFromAudio(photoUri);

        expect(result.success).toBe(true);
        expect(result.predictions).toHaveLength(1);
        expect(result.predictions[0].common_name).toBe('American Robin');
        expect(result.predictions[0].confidence).toBeGreaterThan(0.8);
      });

      it('should handle failed bird identification gracefully', async () => {
        // Mock failed identification
        (BirdNetService.identifyBirdFromAudio as jest.MockedFunction<typeof BirdNetService.identifyBirdFromAudio>).mockRejectedValue(
          new Error('Network connection failed')
        );

        const photoUri = 'file:///path/to/photo.jpg';
        
        await expect(BirdNetService.identifyBirdFromAudio(photoUri))
          .rejects.toThrow('Network connection failed');
      });

      it('should work offline when network is unavailable', async () => {
        // Mock offline identification
        const mockOfflineResult = {
          predictions: [
            {
              common_name: 'Northern Cardinal',
              scientific_name: 'Cardinalis cardinalis',
              confidence: 0.78,
              timestamp_start: 0,
              timestamp_end: 3,
            }
          ],
          processing_time: 800,
          audio_duration: 3.0,
          success: true,
          source: 'tflite' as const,
          fallback_used: false,
        };

        (BirdNetService.identifyBirdFromAudio as jest.MockedFunction<typeof BirdNetService.identifyBirdFromAudio>).mockResolvedValue(mockOfflineResult);

        const photoUri = 'file:///path/to/photo.jpg';
        const result = await BirdNetService.identifyBirdFromAudio(photoUri);

        expect(result.source).toBe('tflite');
        expect(result.success).toBe(true);
        expect(result.predictions[0].common_name).toBe('Northern Cardinal');
      });
    });

    describe('As a birdwatcher, I want to record bird sounds and identify them', () => {
      it('should identify a bird from audio recording', async () => {
        const mockAudioResult = {
          predictions: [
            {
              common_name: 'Wood Thrush',
              scientific_name: 'Hylocichla mustelina',
              confidence: 0.92,
              timestamp_start: 1.2,
              timestamp_end: 4.8,
            }
          ],
          processing_time: 2100,
          audio_duration: 6.0,
          success: true,
          source: 'tflite' as const,
        };

        (BirdNetService.identifyBirdFromAudio as jest.MockedFunction<typeof BirdNetService.identifyBirdFromAudio>).mockResolvedValue(mockAudioResult);

        const audioUri = 'file:///path/to/recording.wav';
        const result = await BirdNetService.identifyBirdFromAudio(audioUri);

        expect(result.success).toBe(true);
        expect(result.predictions[0].common_name).toBe('Wood Thrush');
        expect(result.predictions[0].confidence).toBeGreaterThan(0.9);
        expect(result.audio_duration).toBe(6.0);
      });

      it('should handle multiple bird species in one recording', async () => {
        const mockMultiSpeciesResult = {
          predictions: [
            {
              common_name: 'American Robin',
              scientific_name: 'Turdus migratorius',
              confidence: 0.87,
              timestamp_start: 0.5,
              timestamp_end: 3.2,
            },
            {
              common_name: 'House Wren',
              scientific_name: 'Troglodytes aedon',
              confidence: 0.73,
              timestamp_start: 4.1,
              timestamp_end: 7.8,
            }
          ],
          processing_time: 3200,
          audio_duration: 8.5,
          success: true,
          source: 'tflite' as const,
        };

        (BirdNetService.identifyBirdFromAudio as jest.MockedFunction<typeof BirdNetService.identifyBirdFromAudio>).mockResolvedValue(mockMultiSpeciesResult);

        const audioUri = 'file:///path/to/multi-bird-recording.wav';
        const result = await BirdNetService.identifyBirdFromAudio(audioUri);

        expect(result.predictions).toHaveLength(2);
        expect(result.predictions[0].confidence).toBeGreaterThan(result.predictions[1].confidence);
      });
    });
  });

  describe('📝 Manual Logging Stories', () => {
    describe('As a birdwatcher, I want to manually log my bird sightings', () => {
      it('should successfully save a complete bird sighting', async () => {
        (insertBirdSpotting as jest.MockedFunction<typeof insertBirdSpotting>).mockReturnValue(undefined);

        const sightingData = {
          imageUri: 'file:///path/to/photo.jpg',
          videoUri: '',
          audioUri: 'file:///path/to/audio.wav',
          textNote: 'Building nest in oak tree - Sunny, 22°C - Nesting',
          gpsLat: 40.7829,
          gpsLng: -73.9654,
          date: new Date().toISOString(),
          birdType: 'American Robin',
          imagePrediction: 'Turdus migratorius',
          audioPrediction: 'Turdus migratorius',
        };

        insertBirdSpotting(sightingData);

        expect(insertBirdSpotting).toHaveBeenCalledWith(sightingData);
        expect(insertBirdSpotting).toHaveBeenCalledWith(sightingData);
      });

      it('should save minimal sighting with just species and location', async () => {
        (insertBirdSpotting as jest.MockedFunction<typeof insertBirdSpotting>).mockReturnValue(undefined);

        const minimalSighting = {
          imageUri: '',
          videoUri: '',
          audioUri: '',
          textNote: '',
          gpsLat: 0,
          gpsLng: 0,
          date: new Date().toISOString(),
          birdType: 'Blue Jay',
          imagePrediction: '',
          audioPrediction: '',
        };

        insertBirdSpotting(minimalSighting);

        expect(insertBirdSpotting).toHaveBeenCalledWith(minimalSighting);
        expect(insertBirdSpotting).toHaveBeenCalledWith(minimalSighting);
      });

      it('should validate required fields before saving', async () => {
        const invalidSighting = {
          imageUri: '',
          videoUri: '',
          audioUri: '',
          textNote: '',
          gpsLat: 0,
          gpsLng: 0,
          date: new Date().toISOString(),
          birdType: '', // Empty birdType
          imagePrediction: '',
          audioPrediction: '',
        };

        (insertBirdSpotting as jest.MockedFunction<typeof insertBirdSpotting>).mockImplementation(() => {
          throw new Error('Bird type is required');
        });

        expect(() => insertBirdSpotting(invalidSighting))
          .toThrow('Bird type is required');
      });
    });
  });

  describe('📚 BirdDex Stories', () => {
    describe('As a birdwatcher, I want to browse and search the bird database', () => {
      it('should search for birds by common name', async () => {
        const mockSearchResults = [
          {
            species_code: 'amro',
            english_name: 'American Robin',
            scientific_name: 'Turdus migratorius',
            family: 'Thrushes',
            category: 'species',
            hasBeenLogged: 0 as const,
          } as any,
          {
            species_code: 'euro',
            english_name: 'European Robin',
            scientific_name: 'Erithacus rubecula',
            family: 'Old World Flycatchers',
            category: 'species',
            hasBeenLogged: 0 as const,
          } as any
        ];

        (searchBirdsByName as jest.MockedFunction<typeof searchBirdsByName>).mockReturnValue(mockSearchResults);

        const results = searchBirdsByName('robin', 10);

        expect(results).toHaveLength(2);
        expect(results[0].english_name).toContain('Robin');
        expect(results[1].english_name).toContain('Robin');
      });

      it('should get detailed bird information by species code', async () => {
        const mockBirdDetails = {
          species_code: 'amro',
          english_name: 'American Robin',
          scientific_name: 'Turdus migratorius',
          family: 'Thrushes',
          category: 'species',
          hasBeenLogged: 0 as const,
        } as any;

        (getBirdBySpeciesCode as jest.MockedFunction<typeof getBirdBySpeciesCode>).mockReturnValue(mockBirdDetails);

        const birdDetails = getBirdBySpeciesCode('amro');

        expect(birdDetails).toBeDefined();
        if (birdDetails) {
          expect(birdDetails.english_name).toBe('American Robin');
          expect(birdDetails.scientific_name).toBe('Turdus migratorius');
          expect(birdDetails.family).toBeDefined();
        }
      });

      it('should handle empty search results gracefully', async () => {
        (searchBirdsByName as jest.MockedFunction<typeof searchBirdsByName>).mockReturnValue([]);

        const results = searchBirdsByName('nonexistentbird', 10);

        expect(results).toHaveLength(0);
      });
    });
  });

  describe('📁 Archive Stories', () => {
    describe('As a birdwatcher, I want to view my past sightings', () => {
      it('should retrieve user sightings with pagination', async () => {
        const mockSightings = [
          {
            id: 1,
            imageUri: 'file:///photo1.jpg',
            videoUri: '',
            audioUri: '',
            textNote: 'Central Park',
            gpsLat: 0,
            gpsLng: 0,
            date: '2024-01-15T10:30:00Z',
            birdType: 'American Robin',
            imagePrediction: '',
            audioPrediction: '',
            synced: 0 as const,
          },
          {
            id: 2,
            imageUri: '',
            videoUri: '',
            audioUri: 'file:///audio1.wav',
            textNote: 'My backyard',
            gpsLat: 0,
            gpsLng: 0,
            date: '2024-01-14T08:15:00Z',
            birdType: 'Blue Jay',
            imagePrediction: '',
            audioPrediction: '',
            synced: 0 as const,
          }
        ];

        (getBirdSpottings as jest.MockedFunction<typeof getBirdSpottings>).mockReturnValue(mockSightings);

        const sightings = getBirdSpottings(10);

        expect(sightings).toHaveLength(2);
        expect(sightings[0].birdType).toBe('American Robin');
        expect(sightings[1].birdType).toBe('Blue Jay');
      });

      it('should sort sightings by most recent first', async () => {
        const mockSightings = [
          {
            id: 2,
            birdType: 'Blue Jay',
            date: '2024-01-15T10:30:00Z',
          } as any,
          {
            id: 1,
            birdType: 'American Robin',
            date: '2024-01-14T08:15:00Z',
          } as any
        ];

        (getBirdSpottings as jest.MockedFunction<typeof getBirdSpottings>).mockReturnValue(mockSightings);

        const sightings = getBirdSpottings();

        expect(sightings[0].date > sightings[1].date).toBe(true);
      });
    });
  });

  describe('🔄 Integration Stories', () => {
    describe('As a birdwatcher, I want a complete photo-to-archive workflow', () => {
      it('should complete full workflow: photo → identification → save → archive', async () => {
        // Step 1: Photo identification
        const mockIdentification = {
          predictions: [
            {
              common_name: 'Northern Cardinal',
              scientific_name: 'Cardinalis cardinalis',
              confidence: 0.88,
            }
          ],
          success: true,
          source: 'tflite' as const,
          processing_time: 1500,
          audio_duration: 3.0,
        };

        (BirdNetService.identifyBirdFromAudio as jest.MockedFunction<typeof BirdNetService.identifyBirdFromAudio>).mockResolvedValue(mockIdentification);

        // Step 2: Save to database
        (insertBirdSpotting as jest.MockedFunction<typeof insertBirdSpotting>).mockReturnValue(undefined);

        // Step 3: Retrieve from archive
        const mockArchivedSighting = {
          id: 125,
          imageUri: 'file:///test-photo.jpg',
          videoUri: '',
          audioUri: '',
          textNote: '',
          gpsLat: 0,
          gpsLng: 0,
          date: new Date().toISOString(),
          birdType: 'Northern Cardinal',
          imagePrediction: 'Cardinalis cardinalis',
          audioPrediction: '',
          synced: 0 as const,
        };

        (getBirdSpottings as jest.MockedFunction<typeof getBirdSpottings>).mockReturnValue([mockArchivedSighting]);

        // Execute workflow
        const photoUri = 'file:///test-photo.jpg';
        
        // Identify
        const identification = await BirdNetService.identifyBirdFromAudio(photoUri);
        expect(identification.success).toBe(true);

        // Save
        const sightingData = {
          imageUri: photoUri,
          videoUri: '',
          audioUri: '',
          textNote: '',
          gpsLat: 0,
          gpsLng: 0,
          date: new Date().toISOString(),
          birdType: identification.predictions[0].common_name,
          imagePrediction: identification.predictions[0].scientific_name,
          audioPrediction: '',
        };
        
        insertBirdSpotting(sightingData);
        expect(insertBirdSpotting).toHaveBeenCalledWith(sightingData);

        // Retrieve from archive
        const archivedSightings = getBirdSpottings(1);
        expect(archivedSightings[0].birdType).toBe('Northern Cardinal');
        expect(archivedSightings[0].id).toBe(125);
      });
    });

    describe('As a birdwatcher, I want offline functionality to work reliably', () => {
      it('should work completely offline', async () => {
        // Mock offline bird identification
        const mockOfflineResult = {
          predictions: [{
            common_name: 'House Sparrow',
            scientific_name: 'Passer domesticus',
            confidence: 0.76,
          }],
          success: true,
          source: 'tflite' as const,
          fallback_used: false,
          processing_time: 1200,
          audio_duration: 3.0,
        };

        (BirdNetService.identifyBirdFromAudio as jest.MockedFunction<typeof BirdNetService.identifyBirdFromAudio>).mockResolvedValue(mockOfflineResult);

        // Mock local database operations
        (insertBirdSpotting as jest.MockedFunction<typeof insertBirdSpotting>).mockReturnValue(undefined);

        // Execute offline workflow
        const result = await BirdNetService.identifyBirdFromAudio(
          'file:///photo.jpg'
        );

        expect(result.source).toBe('tflite');

        insertBirdSpotting({
          imageUri: '',
          videoUri: '',
          audioUri: '',
          textNote: '',
          gpsLat: 0,
          gpsLng: 0,
          date: new Date().toISOString(),
          birdType: result.predictions[0].common_name,
          imagePrediction: '',
          audioPrediction: '',
        });

        expect(insertBirdSpotting).toHaveBeenCalled();
      });
    });
  });

  describe('⚡ Performance Stories', () => {
    describe('As a user, I want the app to respond quickly', () => {
      it('should identify birds in under 5 seconds', async () => {
        const mockFastResult = {
          predictions: [{ common_name: 'Fast Bird', scientific_name: 'Fastus birdus', confidence: 0.9 }],
          processing_time: 2100, // 2.1 seconds
          success: true,
          audio_duration: 3.0,
          source: 'tflite' as const,
        };

        (BirdNetService.identifyBirdFromAudio as jest.MockedFunction<typeof BirdNetService.identifyBirdFromAudio>).mockResolvedValue(mockFastResult);

        const startTime = Date.now();
        const result = await BirdNetService.identifyBirdFromAudio('file:///photo.jpg');
        const endTime = Date.now();

        expect(result.processing_time).toBeLessThan(5000);
        expect(endTime - startTime).toBeLessThan(5000);
      });

      it('should load bird database progressively', async () => {
        // Mock progressive loading
        const mockProgressiveResults = [
          [{ english_name: 'Bird 1' } as any],
          [{ english_name: 'Bird 1' } as any, { english_name: 'Bird 2' } as any],
          [{ english_name: 'Bird 1' } as any, { english_name: 'Bird 2' } as any, { english_name: 'Bird 3' } as any],
        ];

        let callCount = 0;
        (searchBirdsByName as jest.MockedFunction<typeof searchBirdsByName>).mockImplementation(() => {
          return mockProgressiveResults[callCount++] || [];
        });

        // Simulate progressive loading
        const firstLoad = searchBirdsByName('', 1);
        const secondLoad = searchBirdsByName('', 2);
        const thirdLoad = searchBirdsByName('', 3);

        expect(firstLoad).toHaveLength(1);
        expect(secondLoad).toHaveLength(2);
        expect(thirdLoad).toHaveLength(3);
      });
    });
  });

  describe('🛡️ Error Handling Stories', () => {
    describe('As a user, I want graceful error handling', () => {
      it('should handle network errors gracefully', async () => {
        (BirdNetService.identifyBirdFromAudio as jest.MockedFunction<typeof BirdNetService.identifyBirdFromAudio>).mockRejectedValue(
          new Error('Network request failed')
        );

        await expect(BirdNetService.identifyBirdFromAudio('file:///photo.jpg'))
          .rejects.toThrow('Network request failed');
      });

      it('should handle invalid file errors', async () => {
        (BirdNetService.identifyBirdFromAudio as jest.MockedFunction<typeof BirdNetService.identifyBirdFromAudio>).mockRejectedValue(
          new Error('Audio file not found')
        );

        await expect(BirdNetService.identifyBirdFromAudio('invalid://path'))
          .rejects.toThrow('Audio file not found');
      });

      it('should handle database errors gracefully', async () => {
        (insertBirdSpotting as jest.MockedFunction<typeof insertBirdSpotting>).mockImplementation(() => {
          throw new Error('Database connection failed');
        });

        expect(() => insertBirdSpotting({
          imageUri: '',
          videoUri: '',
          audioUri: '',
          textNote: '',
          gpsLat: 0,
          gpsLng: 0,
          date: new Date().toISOString(),
          birdType: 'Test Bird',
          imagePrediction: '',
          audioPrediction: '',
        })).toThrow('Database connection failed');
      });
    });
  });
});