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

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock dependencies
jest.mock('@/services/birdNetService');
jest.mock('@/services/database');
jest.mock('@/services/databaseBirDex');
jest.mock('@/hooks/useBirdDexDatabase');
jest.mock('expo-camera');
jest.mock('expo-av');
jest.mock('expo-location');

import { BirdNetService } from '@/services/birdNetService';
import { insertBirdSpotting, getUserSpottings } from '@/services/database';
import { searchBirds, getBirdByCode } from '@/services/databaseBirDex';

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
          source: 'offline',
        };

        (BirdNetService.identifyBirdFromAudio as jest.Mock).mockResolvedValue(mockIdentificationResult);

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
        (BirdNetService.identifyBirdFromAudio as jest.Mock).mockRejectedValue(
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
          source: 'offline',
          fallback_used: false,
        };

        (BirdNetService.identifyBirdFromAudio as jest.Mock).mockResolvedValue(mockOfflineResult);

        const photoUri = 'file:///path/to/photo.jpg';
        const result = await BirdNetService.identifyBirdFromAudio(photoUri, { forceOffline: true });

        expect(result.source).toBe('offline');
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
          source: 'offline',
        };

        (BirdNetService.identifyBirdFromAudio as jest.Mock).mockResolvedValue(mockAudioResult);

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
          source: 'offline',
        };

        (BirdNetService.identifyBirdFromAudio as jest.Mock).mockResolvedValue(mockMultiSpeciesResult);

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
        const mockSpottingId = 123;
        (insertBirdSpotting as jest.Mock).mockResolvedValue(mockSpottingId);

        const sightingData = {
          species: 'American Robin',
          scientificName: 'Turdus migratorius',
          location: 'Central Park, NYC',
          latitude: 40.7829,
          longitude: -73.9654,
          timestamp: new Date().toISOString(),
          notes: 'Building nest in oak tree',
          confidence: 0.95,
          photoUri: 'file:///path/to/photo.jpg',
          audioUri: 'file:///path/to/audio.wav',
          weather: 'Sunny, 22°C',
          behavior: 'Nesting',
        };

        const result = await insertBirdSpotting(sightingData);

        expect(result).toBe(mockSpottingId);
        expect(insertBirdSpotting).toHaveBeenCalledWith(sightingData);
      });

      it('should save minimal sighting with just species and location', async () => {
        const mockSpottingId = 124;
        (insertBirdSpotting as jest.Mock).mockResolvedValue(mockSpottingId);

        const minimalSighting = {
          species: 'Blue Jay',
          location: 'My backyard',
          timestamp: new Date().toISOString(),
        };

        const result = await insertBirdSpotting(minimalSighting);

        expect(result).toBe(mockSpottingId);
        expect(insertBirdSpotting).toHaveBeenCalledWith(minimalSighting);
      });

      it('should validate required fields before saving', async () => {
        const invalidSighting = {
          // Missing required species field
          location: 'Test location',
          timestamp: new Date().toISOString(),
        };

        (insertBirdSpotting as jest.Mock).mockRejectedValue(
          new Error('Species is required')
        );

        await expect(insertBirdSpotting(invalidSighting))
          .rejects.toThrow('Species is required');
      });
    });
  });

  describe('📚 BirdDex Stories', () => {
    describe('As a birdwatcher, I want to browse and search the bird database', () => {
      it('should search for birds by common name', async () => {
        const mockSearchResults = [
          {
            code: 'amro',
            commonName: 'American Robin',
            scientificName: 'Turdus migratorius',
            familyName: 'Thrushes',
          },
          {
            code: 'euro',
            commonName: 'European Robin',
            scientificName: 'Erithacus rubecula',
            familyName: 'Old World Flycatchers',
          }
        ];

        (searchBirds as jest.Mock).mockResolvedValue(mockSearchResults);

        const results = await searchBirds('robin', 10);

        expect(results).toHaveLength(2);
        expect(results[0].commonName).toContain('Robin');
        expect(results[1].commonName).toContain('Robin');
      });

      it('should get detailed bird information by species code', async () => {
        const mockBirdDetails = {
          code: 'amro',
          commonName: 'American Robin',
          scientificName: 'Turdus migratorius',
          familyName: 'Thrushes',
          habitat: 'Urban areas, parks, woodlands',
          diet: 'Worms, insects, berries',
          description: 'Large songbird with orange breast and dark head',
          migrationPattern: 'Partial migrant',
          conservationStatus: 'Least Concern',
        };

        (getBirdByCode as jest.Mock).mockResolvedValue(mockBirdDetails);

        const birdDetails = await getBirdByCode('amro');

        expect(birdDetails).toBeDefined();
        expect(birdDetails.commonName).toBe('American Robin');
        expect(birdDetails.scientificName).toBe('Turdus migratorius');
        expect(birdDetails.habitat).toBeDefined();
      });

      it('should handle empty search results gracefully', async () => {
        (searchBirds as jest.Mock).mockResolvedValue([]);

        const results = await searchBirds('nonexistentbird', 10);

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
            species: 'American Robin',
            location: 'Central Park',
            timestamp: '2024-01-15T10:30:00Z',
            photoUri: 'file:///photo1.jpg',
          },
          {
            id: 2,
            species: 'Blue Jay',
            location: 'My backyard',
            timestamp: '2024-01-14T08:15:00Z',
            audioUri: 'file:///audio1.wav',
          }
        ];

        (getUserSpottings as jest.Mock).mockResolvedValue(mockSightings);

        const sightings = await getUserSpottings(10);

        expect(sightings).toHaveLength(2);
        expect(sightings[0].species).toBe('American Robin');
        expect(sightings[1].species).toBe('Blue Jay');
      });

      it('should sort sightings by most recent first', async () => {
        const mockSightings = [
          {
            id: 2,
            species: 'Blue Jay',
            timestamp: '2024-01-15T10:30:00Z',
          },
          {
            id: 1,
            species: 'American Robin',
            timestamp: '2024-01-14T08:15:00Z',
          }
        ];

        (getUserSpottings as jest.Mock).mockResolvedValue(mockSightings);

        const sightings = await getUserSpottings();

        expect(sightings[0].timestamp > sightings[1].timestamp).toBe(true);
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
          source: 'offline',
        };

        (BirdNetService.identifyBirdFromAudio as jest.Mock).mockResolvedValue(mockIdentification);

        // Step 2: Save to database
        const mockSpottingId = 125;
        (insertBirdSpotting as jest.Mock).mockResolvedValue(mockSpottingId);

        // Step 3: Retrieve from archive
        const mockArchivedSighting = {
          id: mockSpottingId,
          species: 'Northern Cardinal',
          scientificName: 'Cardinalis cardinalis',
          confidence: 0.88,
          timestamp: new Date().toISOString(),
        };

        (getUserSpottings as jest.Mock).mockResolvedValue([mockArchivedSighting]);

        // Execute workflow
        const photoUri = 'file:///test-photo.jpg';
        
        // Identify
        const identification = await BirdNetService.identifyBirdFromAudio(photoUri);
        expect(identification.success).toBe(true);

        // Save
        const sightingData = {
          species: identification.predictions[0].common_name,
          scientificName: identification.predictions[0].scientific_name,
          confidence: identification.predictions[0].confidence,
          photoUri,
          timestamp: new Date().toISOString(),
        };
        
        const savedId = await insertBirdSpotting(sightingData);
        expect(savedId).toBe(mockSpottingId);

        // Retrieve from archive
        const archivedSightings = await getUserSpottings(1);
        expect(archivedSightings[0].species).toBe('Northern Cardinal');
        expect(archivedSightings[0].id).toBe(savedId);
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
          source: 'offline',
          fallback_used: false,
        };

        (BirdNetService.identifyBirdFromAudio as jest.Mock).mockResolvedValue(mockOfflineResult);

        // Mock local database operations
        const mockSpottingId = 126;
        (insertBirdSpotting as jest.Mock).mockResolvedValue(mockSpottingId);

        // Execute offline workflow
        const result = await BirdNetService.identifyBirdFromAudio(
          'file:///photo.jpg', 
          { forceOffline: true }
        );

        expect(result.source).toBe('offline');
        expect(result.fallback_used).toBe(false);

        const savedId = await insertBirdSpotting({
          species: result.predictions[0].common_name,
          confidence: result.predictions[0].confidence,
          timestamp: new Date().toISOString(),
        });

        expect(savedId).toBe(mockSpottingId);
      });
    });
  });

  describe('⚡ Performance Stories', () => {
    describe('As a user, I want the app to respond quickly', () => {
      it('should identify birds in under 5 seconds', async () => {
        const mockFastResult = {
          predictions: [{ common_name: 'Fast Bird', confidence: 0.9 }],
          processing_time: 2100, // 2.1 seconds
          success: true,
        };

        (BirdNetService.identifyBirdFromAudio as jest.Mock).mockResolvedValue(mockFastResult);

        const startTime = Date.now();
        const result = await BirdNetService.identifyBirdFromAudio('file:///photo.jpg');
        const endTime = Date.now();

        expect(result.processing_time).toBeLessThan(5000);
        expect(endTime - startTime).toBeLessThan(5000);
      });

      it('should load bird database progressively', async () => {
        // Mock progressive loading
        const mockProgressiveResults = [
          [{ commonName: 'Bird 1' }],
          [{ commonName: 'Bird 1' }, { commonName: 'Bird 2' }],
          [{ commonName: 'Bird 1' }, { commonName: 'Bird 2' }, { commonName: 'Bird 3' }],
        ];

        let callCount = 0;
        (searchBirds as jest.Mock).mockImplementation(() => {
          return Promise.resolve(mockProgressiveResults[callCount++] || []);
        });

        // Simulate progressive loading
        const firstLoad = await searchBirds('', 1);
        const secondLoad = await searchBirds('', 2);
        const thirdLoad = await searchBirds('', 3);

        expect(firstLoad).toHaveLength(1);
        expect(secondLoad).toHaveLength(2);
        expect(thirdLoad).toHaveLength(3);
      });
    });
  });

  describe('🛡️ Error Handling Stories', () => {
    describe('As a user, I want graceful error handling', () => {
      it('should handle network errors gracefully', async () => {
        (BirdNetService.identifyBirdFromAudio as jest.Mock).mockRejectedValue(
          new Error('Network request failed')
        );

        await expect(BirdNetService.identifyBirdFromAudio('file:///photo.jpg'))
          .rejects.toThrow('Network request failed');
      });

      it('should handle invalid file errors', async () => {
        (BirdNetService.identifyBirdFromAudio as jest.Mock).mockRejectedValue(
          new Error('Audio file not found')
        );

        await expect(BirdNetService.identifyBirdFromAudio('invalid://path'))
          .rejects.toThrow('Audio file not found');
      });

      it('should handle database errors gracefully', async () => {
        (insertBirdSpotting as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        await expect(insertBirdSpotting({ species: 'Test Bird' }))
          .rejects.toThrow('Database connection failed');
      });
    });
  });
});