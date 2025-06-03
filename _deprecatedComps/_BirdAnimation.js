import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions, TouchableWithoutFeedback, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import {
    useSharedValue,
    withRepeat,
    withTiming,
    withSequence,
    useAnimatedStyle,
    runOnJS,
    Easing,
} from 'react-native-reanimated';

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
    const [forceUpdateCounter, setForceUpdateCounter] = useState(0);

    const animationsRef = useRef([]);
    const frameIntervalsRef = useRef([]);
    const isComponentMounted = useRef(true);
    const isScreenFocused = useRef(true);
    const birdsRef = useRef([]);
    const touchPositionsRef = useRef([]);

    // Wind effect using reanimated at component level (not inside dynamic creation)
    const windStrength = useSharedValue(0);
    const [windOffset, setWindOffset] = useState(0);

    // Force update function for frame animations
    const forceUpdate = useCallback(() => {
        setForceUpdateCounter(prev => prev + 1);
    }, []);

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

    // Wind animation using reanimated at component level
    useEffect(() => {
        const animateWind = () => {
            windStrength.value = withRepeat(
                withSequence(
                    withTiming(1, {
                        duration: 8000,
                        easing: Easing.inOut(Easing.sin),
                    }),
                    withTiming(-1, {
                        duration: 6000,
                        easing: Easing.inOut(Easing.sin),
                    }),
                    withTiming(0, {
                        duration: 4000,
                        easing: Easing.inOut(Easing.sin),
                    }),
                )
            );
        };

        if (isScreenFocused.current) {
            animateWind();
        }
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
                    }, index * 800);
                }
            });

            return () => {
                console.log("[BirdAnimation] Screen unfocused, stopping animations");
                isScreenFocused.current = false;
                animationsRef.current.forEach(anim => anim?.stop?.());
            };
        }, [])
    );

    // Get species configuration
    const getSpeciesConfig = (spriteIndex) => {
        const speciesKeys = Object.keys(SPECIES_CONFIG);
        const speciesKey = speciesKeys[spriteIndex % speciesKeys.length];
        return SPECIES_CONFIG[speciesKey];
    };

    // Enhanced bird creation using react-native Animated (not reanimated hooks)
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
        const baseY = 50 + Math.random() * (screenHeight - 150);

        return {
            id: Math.random().toString(36).substring(7),
            sprite: birdSprites[spriteIndex],
            spriteIndex,
            frameIndex: 0,
            speed,
            scale: finalScale,
            opacity,
            depth,
            zIndex: Math.floor(depth * 10), // 0-9 for layering
            baseY,

            // Use react-native Animated.Value instead of reanimated hooks
            animatedValues: {
                x: new Animated.Value(-64 * finalScale),
                y: new Animated.Value(baseY),
                waveY: new Animated.Value(0),
            },

            // Flight characteristics
            waveAmplitude,
            waveFrequency,
            waveOffset: Math.random() * Math.PI * 2,
            frameRate: config.frameRate + Math.random() * 100 - 50,

            // Wind interaction
            windSensitivity: 0.3 + Math.random() * 0.7,

            // Animation state
            startTime: 0,
            isAnimating: false,
        };
    }, []);

    // Enhanced bird movement using react-native Animated
    const moveBird = useCallback((bird) => {
        if (!isComponentMounted.current || !isScreenFocused.current || bird.isAnimating) return;

        console.log(`[BirdAnimation] Starting enhanced flight for bird ${bird.id}`);
        bird.isAnimating = true;
        bird.startTime = Date.now();

        const duration = (15000 / bird.speed);
        const totalDistance = screenWidth + 128 * bird.scale;

        // Reset position
        bird.animatedValues.x.setValue(-64 * bird.scale);
        bird.animatedValues.waveY.setValue(0);

        // Main flight animation using react-native Animated
        const flightAnimation = Animated.timing(bird.animatedValues.x, {
            toValue: totalDistance,
            duration: duration,
            easing: Easing.linear,
            useNativeDriver: true,
        });

        // Wave animation using react-native Animated
        const waveAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(bird.animatedValues.waveY, {
                    toValue: bird.waveAmplitude,
                    duration: 2000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(bird.animatedValues.waveY, {
                    toValue: -bird.waveAmplitude,
                    duration: 2000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );

        // Start animations
        waveAnimation.start();
        flightAnimation.start((finished) => {
            bird.isAnimating = false;
            waveAnimation.stop();

            if (finished && isComponentMounted.current && isScreenFocused.current) {
                // Update bird reference for new Y position
                const newY = 50 + Math.random() * (screenHeight - 150);
                const birdIndex = birdsRef.current.findIndex(b => b && b.id === bird.id);

                if (birdIndex !== -1) {
                    birdsRef.current[birdIndex].baseY = newY;
                    birdsRef.current[birdIndex].animatedValues.y.setValue(newY);

                    // Update state
                    setBirds(prevBirds => {
                        const newBirds = [...prevBirds];
                        const stateBirdIndex = newBirds.findIndex(b => b.id === bird.id);
                        if (stateBirdIndex !== -1) {
                            newBirds[stateBirdIndex] = {
                                ...newBirds[stateBirdIndex],
                                baseY: newY
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
            }
        });

        // Store animation reference for cleanup
        const birdIndex = birdsRef.current.findIndex(b => b && b.id === bird.id);
        if (birdIndex !== -1) {
            animationsRef.current[birdIndex] = {
                stop: () => {
                    flightAnimation.stop();
                    waveAnimation.stop();
                    bird.isAnimating = false;
                }
            };
        }
    }, []);

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
                    }, index * 1200);
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
                    const birdIndex = birdsRef.current.findIndex(b => b && b.id === bird.id);
                    if (birdIndex !== -1) {
                        const newFrameIndex = (birdsRef.current[birdIndex].frameIndex + 1) % 4;
                        birdsRef.current[birdIndex].frameIndex = newFrameIndex;

                        // Force re-render for frame updates
                        forceUpdate();
                    }
                }
            }, bird.frameRate);
        });

        frameIntervalsRef.current = intervals;

        return () => {
            intervals.forEach(clearInterval);
        };
    }, [birds.length, forceUpdate]);

    // Wind effect listener using reanimated
    useEffect(() => {
        const listener = windStrength.addListener(({ value }) => {
            setWindOffset(value);
        });

        return () => {
            windStrength.removeListener(listener);
        };
    }, [windStrength]);

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
                                        { translateX: bird.animatedValues.x },
                                        {
                                            translateY: Animated.add(
                                                bird.animatedValues.y,
                                                Animated.add(
                                                    bird.animatedValues.waveY,
                                                    windOffset * bird.windSensitivity * 15
                                                )
                                            )
                                        },
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
    }, [birds, forceUpdateCounter, handleBirdTouch, windOffset]);

    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            {birdComponents}
        </View>
    );
};

const styles = StyleSheet.create({
    bird: {
        position: 'absolute',
    },
    frame: {
        overflow: 'hidden',
    },
});

export default EnhancedBirdAnimation;