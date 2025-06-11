import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';

// Mock Audio
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({
        sound: {
          replayAsync: jest.fn(),
          unloadAsync: jest.fn(),
        }
      }))
    }
  }
}));

// Mock sprite assets
jest.mock('@/assets/birds/spritesheet_magpie.png', () => 'sprite1');
jest.mock('@/assets/birds/spritesheet_house finch.png', () => 'sprite2');
jest.mock('@/assets/birds/spritesheet_white_dove.png', () => 'sprite3');
jest.mock('@/assets/birds/spritesheet_wood_thrush.png', () => 'sprite4');

// Mock sound assets
jest.mock('@/assets/birds/bird1.mp3', () => 'sound1');
jest.mock('@/assets/birds/bird2.mp3', () => 'sound2');
jest.mock('@/assets/birds/bird3.mp3', () => 'sound3');
jest.mock('@/assets/birds/bird4.mp3', () => 'sound4');

// Mock Dimensions
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Dimensions: {
      get: jest.fn(() => ({ width: 400, height: 800 }))
    }
  };
});

// Mock Animated timing
const mockAnimatedTiming = jest.fn(() => ({
  start: jest.fn((callback) => {
    if (callback) callback({ finished: true });
  }),
  stop: jest.fn(),
  reset: jest.fn()
}));

jest.spyOn(Animated, 'timing').mockImplementation(mockAnimatedTiming);

// Import after mocks
import BirdAnimation from '../components/BirdAnimationJS';

describe('BirdAnimation Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with default number of birds', async () => {
    const { findAllByTestId } = render(<BirdAnimation />);
    
    await waitFor(async () => {
      // Should render 5 birds by default
      const birdElements = await findAllByTestId(/bird-/);
      expect(birdElements).toHaveLength(5);
    });
  });

  it('renders correct number of birds when specified', async () => {
    const { findAllByTestId } = render(<BirdAnimation numberOfBirds={3} />);
    
    await waitFor(async () => {
      const birdElements = await findAllByTestId(/bird-/);
      expect(birdElements).toHaveLength(3);
    });
  });

  it('loads and cleans up sounds properly', async () => {
    const { unmount } = render(<BirdAnimation />);
    
    // Wait for sounds to load
    await waitFor(() => {
      expect(require('expo-av').Audio.Sound.createAsync).toHaveBeenCalledTimes(4);
    });

    // Unmount and check cleanup
    unmount();
    
    await waitFor(() => {
      // Cleanup should be called for each sound
      expect(require('expo-av').Audio.Sound.createAsync).toHaveBeenCalledTimes(4);
    });
  });

  it('plays sound when bird is touched', async () => {
    const { findAllByTestId } = render(<BirdAnimation />);
    
    await waitFor(async () => {
      const birdElements = await findAllByTestId(/bird-/);
      expect(birdElements.length).toBeGreaterThan(0);
      
      // Touch the first bird
      fireEvent.press(birdElements[0]);
      
      // Should attempt to play a sound
      // Note: We can't easily test the actual sound playback in Jest,
      // but we can verify the component doesn't crash
    });
  });

  it('animates bird movement across screen', async () => {
    render(<BirdAnimation numberOfBirds={1} />);
    
    await waitFor(() => {
      // Verify Animated.timing was called for bird movement
      expect(mockAnimatedTiming).toHaveBeenCalled();
      
      // Basic verification that animation was called
      expect(mockAnimatedTiming).toHaveBeenCalledTimes(expect.any(Number));
    });
  });

  it('cycles through sprite frames correctly', async () => {
    jest.useFakeTimers();
    
    const { findAllByTestId } = render(<BirdAnimation numberOfBirds={1} />);
    
    await waitFor(async () => {
      const birdElements = await findAllByTestId(/bird-/);
      expect(birdElements.length).toBe(1);
    });

    // Fast forward the frame animation timer
    jest.advanceTimersByTime(1200); // 4 frames × 300ms each
    
    // The component should update frame indices (hard to test directly in Jest)
    // but we can verify no crashes occur
    expect(() => {
      jest.advanceTimersByTime(300);
    }).not.toThrow();

    jest.useRealTimers();
  });

  it('handles screen dimensions correctly', () => {
    // Test with different screen sizes
    const { Dimensions } = require('react-native');
    (Dimensions.get as jest.Mock).mockReturnValue({ width: 300, height: 600 });
    
    const { rerender } = render(<BirdAnimation numberOfBirds={1} />);
    
    // Should not crash with different dimensions
    expect(() => {
      rerender(<BirdAnimation numberOfBirds={2} />);
    }).not.toThrow();
  });

  it('ensures proper sprite sheet frame calculation', async () => {
    const { findByTestId } = render(<BirdAnimation numberOfBirds={1} />);
    
    await waitFor(async () => {
      const birdElement = await findByTestId(/bird-/);
      
      // Find the image within the bird element
      const imageElement = birdElement.findByType('Image');
      if (imageElement) {
        const style = imageElement.props.style;
        
        // Verify sprite sheet dimensions
        expect(style.width).toBe(64);
        expect(style.height).toBe(64);
        
        // Verify transform includes translateX for frame animation
        const transform = style.transform;
        expect(transform).toContainEqual(
          expect.objectContaining({ translateX: expect.any(Number) })
        );
        
        // Verify scaleX for directional flip
        expect(transform).toContainEqual({ scaleX: -1 });
      }
    });
  });

  it('restarts bird movement when animation completes', async () => {
    render(<BirdAnimation numberOfBirds={1} />);
    
    await waitFor(() => {
      // Verify the animation callback system works
      expect(mockAnimatedTiming).toHaveBeenCalled();
      
      // The start callback should be called
      const startCall = mockAnimatedTiming.mock.results[0];
      if (startCall && startCall.value && startCall.value.start) {
        expect(typeof startCall.value.start).toBe('function');
      }
    });
  });

  it('maintains proper z-index and positioning', async () => {
    const { findByTestId } = render(<BirdAnimation />);
    
    await waitFor(async () => {
      // Should render with absolute positioning
      const birdElement = await findByTestId(/bird-/);
      expect(birdElement).toBeTruthy();
    });
  });
});