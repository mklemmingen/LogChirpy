import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions, TouchableWithoutFeedback, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';

const birdSprites = [
    require('@/assets/birds/spritesheet_magpie.png'),
    require('@/assets/birds/spritesheet_house finch.png'),
    require('@/assets/birds/spritesheet_white_dove.png'),
    require('@/assets/birds/spritesheet_wood_thrush.png'),
];

const birdSounds = [
    require('@/assets/birds/bird1.mp3'),
    require('@/assets/birds/bird2.mp3'),
    require('@/assets/birds/bird3.mp3'),
];

// Species-specific flight characteristics
const SPECIES_CONFIG = {
    magpie: {
        speed: { min: 0.4, max: 0.8 },
        waveAmplitude: { min: 25, max: 45 },
        waveFrequency: { min: 0.0008, max: 0.0015 },
        scale: { min: 0.8, max: 1.2 },
        frameRate: 250,
    },
    finch: {
        speed: { min: 0.6, max: 1.2 },
        waveAmplitude: { min: 15, max: 30 },
        waveFrequency: { min: 0.0012, max: 0.002 },
        scale: { min: 0.5, max: 0.8 },
        frameRate: 200,
    },
    dove: {
        speed: { min: 0.3, max: 0.6 },
        waveAmplitude: { min: 10, max: 20 },
        waveFrequency: { min: 0.0006, max: 0.001 },
        scale: { min: 0.9, max: 1.3 },
        frameRate: 300,
    },
    thrush: {
        speed: { min: 0.5, max: 0.9 },
        waveAmplitude: { min: 20, max: 35 },
        waveFrequency: { min: 0.001, max: 0.0018 },
        scale: { min: 0.7, max: 1.0 },
        frameRate: 220,
    },
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const EnhancedBirdAnimation = ({ numberOfBirds = 5 }) => {
    const [birds, setBirds] = useState([]);
    const [sounds, setSounds] = useState([]);
    const [windOffset, setWindOffset] = useState(0);

    const animationsRef = useRef([]);
    const frameIntervalsRef = useRef([]);
    const windAnimationRef = useRef();
    const isComponentMounted = useRef(true);
    const isScreenFocused = useRef(true);
    const birdsRef = useRef([]);
    const touchPositionsRef = useRef([]);

    // Wind effect for subtle environmental influence
    const windStrength = useRef(new Animated.Value(0)).current;

    // Load sounds on mount
    useEffect(() => {
        const loadSounds = async () => {
            try {
                const loaded = await Promise.all(
                    birdSounds.map(async (file) => {
                        const { sound } = await Audio.Sound.createAsync(file, { shouldPlay: false });
                        return sound;
                    })
                );
                if (isComponentMounted.current) {
                    setSounds(loaded);
                }
            } catch (error) {
                console.warn('Error loading bird sounds:', error);
            }
        };
        loadSounds();

        return () => {
            isComponentMounted.current = false;
            sounds.forEach((s) => s?.unloadAsync?.());
        };
    }, []);

    // Wind animation for environmental effects
    useEffect(() => {
        const animateWind = () => {
            windAnimationRef.current = Animated.loop(
                Animated.sequence([
                    Animated.timing(windStrength, {
                        toValue: 1,
                        duration: 8000,
                        easing: Easing.inOut(Easing.sin),
                        useNativeDriver: false,
                    }),
                    Animated.timing(windStrength, {
                        toValue: -1,
                        duration: 6000,
                        easing: Easing.inOut(Easing.sin),
                        useNativeDriver: false,
                    }),
                    Animated.timing(windStrength, {
                        toValue: 0,
                        duration: 4000,
                        easing: Easing.inOut(Easing.sin),
                        useNativeDriver: false,
                    }),
                ])
            );
            windAnimationRef.current.start();
        };

        if (isScreenFocused.current) {
            animateWind();
        }

        return () => {
            windAnimationRef.current?.stop();
        };
    }, []);

    // Handle screen focus for optimization
    useFocusEffect(
        useCallback(() => {
            console.log("[BirdAnimation] Screen focused, animations restarted");
            isScreenFocused.current = true;

            // Restart bird animations with staggered timing
            birdsRef.current.forEach((bird, index) => {
                if (bird) {
                    setTimeout(() => {
                        if (isComponentMounted.current && isScreenFocused.current) {
                            moveBird(bird);
                        }
                    }, index * 800); // Stagger bird starts
                }
            });

            return () => {
                console.log("[BirdAnimation] Screen unfocused, stopping animations");
                isScreenFocused.current = false;
                animationsRef.current.forEach(anim => anim?.stop?.());
                windAnimationRef.current?.stop();
            };
        }, [])
    );

    // Get species configuration
    const getSpeciesConfig = (spriteIndex) => {
        const speciesKeys = Object.keys(SPECIES_CONFIG);
        const speciesKey = speciesKeys[spriteIndex % speciesKeys.length];
        return SPECIES_CONFIG[speciesKey];
    };

    // Enhanced bird creation with realistic characteristics
    const createEnhancedBird = useCallback((index) => {
        const spriteIndex = Math.floor(Math.random() * birdSprites.length);
        const config = getSpeciesConfig(spriteIndex);

        // Random values within species ranges
        const speed = config.speed.min + Math.random() * (config.speed.max - config.speed.min);
        const waveAmplitude = config.waveAmplitude.min + Math.random() * (config.waveAmplitude.max - config.waveAmplitude.min);
        const waveFrequency = config.waveFrequency.min + Math.random() * (config.waveFrequency.max - config.waveFrequency.min);
        const scale = config.scale.min + Math.random() * (config.scale.max - config.scale.min);

        // Depth-based properties
        const depth = Math.random(); // 0 = far, 1 = near
        const opacity = 0.3 + depth * 0.7; // Atmospheric perspective
        const finalScale = scale * (0.6 + depth * 0.4); // Size perspective

        return {
            id: Math.random().toString(36).substring(7),
            sprite: birdSprites[spriteIndex],
            spriteIndex,
            x: new Animated.Value(-64 * finalScale),
            y: 50 + Math.random() * (screenHeight - 150), // Base Y position
            animatedY: new Animated.Value(0), // For wave movement
            frameIndex: 0,
            speed,
            scale: finalScale,
            opacity,
            depth,
            zIndex: Math.floor(depth * 10), // 0-9 for layering

            // Flight characteristics
            waveAmplitude,
            waveFrequency,
            waveOffset: Math.random() * Math.PI * 2,
            frameRate: config.frameRate + Math.random() * 100 - 50,

            // Wind interaction
            windSensitivity: 0.3 + Math.random() * 0.7,

            // Animation state
            startTime: 0,
            animationFrame: null,
        };
    }, []);

    // Enhanced bird movement with natural flight paths
    const moveBird = useCallback((bird) => {
        if (!isComponentMounted.current || !isScreenFocused.current) return;

        console.log(`[BirdAnimation] Starting enhanced flight for bird ${bird.id}`);

        bird.startTime = Date.now();
        bird.x.setValue(-64 * bird.scale);
        bird.animatedY.setValue(0);

        const animateNaturalFlight = () => {
            if (!isComponentMounted.current || !isScreenFocused.current) return;

            const elapsed = Date.now() - bird.startTime;
            const duration = (15000 / bird.speed);
            const progress = elapsed / duration;

            if (progress >= 1) {
                // Flight complete, restart
                const newY = 50 + Math.random() * (screenHeight - 150);

                // Update bird reference
                const birdIndex = birdsRef.current.findIndex(b => b && b.id === bird.id);
                if (birdIndex !== -1) {
                    birdsRef.current[birdIndex].y = newY;

                    // Update state
                    setBirds(prevBirds => {
                        const newBirds = [...prevBirds];
                        const stateBirdIndex = newBirds.findIndex(b => b.id === bird.id);
                        if (stateBirdIndex !== -1) {
                            newBirds[stateBirdIndex] = {
                                ...newBirds[stateBirdIndex],
                                y: newY
                            };
                        }
                        return newBirds;
                    });

                    // Restart with delay for natural spacing
                    setTimeout(() => {
                        if (isComponentMounted.current && isScreenFocused.current) {
                            moveBird(birdsRef.current[birdIndex]);
                        }
                    }, 1000 + Math.random() * 3000);
                }
                return;
            }

            // Calculate natural flight path
            const baseX = -64 * bird.scale + (screenWidth + 128 * bird.scale) * progress;

            // Sine wave flight pattern
            const wavePhase = progress * Math.PI * 6 + bird.waveOffset;
            const waveY = Math.sin(wavePhase) * bird.waveAmplitude * Math.sin(progress * Math.PI); // Fade wave at ends

            // Wind effect
            const windInfluence = windOffset * bird.windSensitivity * 15;

            // Subtle random drift for realism
            const randomDrift = Math.sin(elapsed * 0.003 + bird.id.charCodeAt(0)) * 5;

            // Apply transforms
            bird.x.setValue(baseX + windInfluence + randomDrift);
            bird.animatedY.setValue(waveY);

            // Continue animation
            bird.animationFrame = requestAnimationFrame(animateNaturalFlight);
        };

        // Start the animation
        animateNaturalFlight();

        // Store animation reference for cleanup
        const birdIndex = birdsRef.current.findIndex(b => b && b.id === bird.id);
        if (birdIndex !== -1) {
            animationsRef.current[birdIndex] = {
                stop: () => {
                    if (bird.animationFrame) {
                        cancelAnimationFrame(bird.animationFrame);
                        bird.animationFrame = null;
                    }
                }
            };
        }
    }, [windOffset]);

    // Setup birds with enhanced characteristics
    useEffect(() => {
        console.log(`[BirdAnimation] Setting up ${numberOfBirds} enhanced birds`);

        // Clear existing animations
        animationsRef.current.forEach(anim => anim?.stop?.());
        frameIntervalsRef.current.forEach(interval => clearInterval(interval));

        const createdBirds = Array.from({ length: numberOfBirds }, (_, index) =>
            createEnhancedBird(index)
        );

        // Sort by depth for proper layering
        createdBirds.sort((a, b) => a.depth - b.depth);

        setBirds(createdBirds);
        birdsRef.current = [...createdBirds];
        animationsRef.current = new Array(numberOfBirds).fill(null);

        // Start animations with staggered timing
        const animationStartTimer = setTimeout(() => {
            if (isComponentMounted.current && isScreenFocused.current) {
                console.log("[BirdAnimation] Starting staggered enhanced animations");
                createdBirds.forEach((bird, index) => {
                    setTimeout(() => {
                        if (isComponentMounted.current && isScreenFocused.current) {
                            moveBird(bird);
                        }
                    }, index * 1200); // Staggered start times
                });
            }
        }, 100);

        return () => {
            console.log("[BirdAnimation] Cleaning up enhanced birds");
            clearTimeout(animationStartTimer);
            animationsRef.current.forEach(anim => anim?.stop?.());
            frameIntervalsRef.current.forEach(interval => clearInterval(interval));
        };
    }, [numberOfBirds, createEnhancedBird, moveBird]);

    // Enhanced frame animation with species-specific timing
    useEffect(() => {
        console.log("[BirdAnimation] Setting up enhanced frame animations", birds.length);

        // Clean up previous intervals
        frameIntervalsRef.current.forEach(interval => clearInterval(interval));
        frameIntervalsRef.current = [];

        // Setup new intervals with species-specific frame rates
        const intervals = birds.map((bird) => {
            return setInterval(() => {
                if (isComponentMounted.current && isScreenFocused.current) {
                    setBirds(prevBirds => {
                        const newBirds = [...prevBirds];
                        const birdIndex = newBirds.findIndex(b => b.id === bird.id);
                        if (birdIndex !== -1) {
                            const newFrameIndex = (newBirds[birdIndex].frameIndex + 1) % 4;
                            newBirds[birdIndex] = {
                                ...newBirds[birdIndex],
                                frameIndex: newFrameIndex
                            };

                            // Update ref
                            if (birdsRef.current[birdIndex]) {
                                birdsRef.current[birdIndex].frameIndex = newFrameIndex;
                            }
                        }
                        return newBirds;
                    });
                }
            }, bird.frameRate);
        });

        frameIntervalsRef.current = intervals;

        return () => {
            intervals.forEach(clearInterval);
        };
    }, [birds.length]);

    // Wind effect listener
    useEffect(() => {
        const listener = windStrength.addListener(({ value }) => {
            setWindOffset(value);
        });

        return () => {
            windStrength.removeListener(listener);
        };
    }, []);

    // Enhanced sound playback with bird-specific audio
    const playRandomSound = useCallback(async (bird) => {
        if (sounds.length > 0 && isComponentMounted.current) {
            try {
                // Select sound based on bird species for variety
                const soundIndex = bird.spriteIndex % sounds.length;
                const randomSound = sounds[soundIndex];

                await randomSound.setPositionAsync(0);
                await randomSound.playAsync();

                // Stop after a short duration for ambient effect
                setTimeout(() => {
                    randomSound.pauseAsync().catch(() => {});
                }, 1000 + Math.random() * 2000);

            } catch (error) {
                console.warn("Error playing bird sound:", error);
            }
        }
    }, [sounds]);

    // Handle touch interactions with birds
    const handleBirdTouch = useCallback((bird, event) => {
        // Add touch position for birds to react to
        const touchX = event.nativeEvent.pageX;
        const touchY = event.nativeEvent.pageY;

        touchPositionsRef.current.push({
            x: touchX,
            y: touchY,
            timestamp: Date.now(),
        });

        // Clean old touch positions
        touchPositionsRef.current = touchPositionsRef.current.filter(
            touch => Date.now() - touch.timestamp < 3000
        );

        // Play sound
        playRandomSound(bird);
    }, [playRandomSound]);

    // Render enhanced birds with layering and effects
    const birdComponents = useMemo(() => {
        console.log("[BirdAnimation] Rendering enhanced bird components:", birds.length);

        return birds
            .sort((a, b) => a.zIndex - b.zIndex) // Ensure proper layering
            .map((bird) => {
                return (
                    <TouchableWithoutFeedback
                        key={bird.id}
                        onPress={(event) => handleBirdTouch(bird, event)}
                        hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
                    >
                        <Animated.View
                            style={[
                                styles.bird,
                                {
                                    transform: [
                                        { translateX: bird.x },
                                        { translateY: bird.y + bird.animatedY },
                                        { scale: bird.scale },
                                    ],
                                    opacity: bird.opacity,
                                    zIndex: bird.zIndex,
                                }
                            ]}
                        >
                            <View style={[
                                styles.frame,
                                {
                                    width: 16 * bird.scale,
                                    height: 16 * bird.scale,
                                    // Add subtle shadow for depth
                                    shadowColor: '#000',
                                    shadowOffset: {
                                        width: 0,
                                        height: bird.depth * 3
                                    },
                                    shadowOpacity: bird.depth * 0.2,
                                    shadowRadius: bird.depth * 4,
                                    elevation: bird.depth * 3,
                                }
                            ]}>
                                <Animated.Image
                                    source={bird.sprite}
                                    style={{
                                        width: 64 * bird.scale,
                                        height: 64 * bird.scale,
                                        transform: [
                                            { translateX: -bird.frameIndex * 16 * bird.scale },
                                            { translateY: 0 },
                                            { scaleX: -1 },
                                        ],
                                    }}
                                    resizeMode="cover"
                                />
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                );
            });
    }, [birds, handleBirdTouch]);

    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            {birdComponents}
        </View>
    );
};

const styles = StyleSheet.create({
    bird: {
        position: 'absolute',
        // Dynamic sizing handled in component
    },
    frame: {
        overflow: 'hidden',
        // Dynamic sizing handled in component
    },
});

export default EnhancedBirdAnimation;