import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions, TouchableWithoutFeedback } from 'react-native';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';

/* global setTimeout, clearTimeout, setInterval, clearInterval */

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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const BirdAnimation = ({ numberOfBirds = 5 }) => {
    const [birds, setBirds] = useState([]);
    const [sounds, setSounds] = useState([]);
    const animationsRef = useRef([]);
    const frameIntervalsRef = useRef([]);
    const isComponentMounted = useRef(true);
    const isScreenFocused = useRef(true);
    const birdsRef = useRef([]);

    // Load sounds on mount
    useEffect(() => {
        const loadSounds = async () => {
            const loaded = await Promise.all(
                birdSounds.map(async (file) => {
                    const { sound } = await Audio.Sound.createAsync(file);
                    return sound;
                })
            );
            if (isComponentMounted.current) {
                setSounds(loaded);
            }
        };
        loadSounds();

        return () => {
            isComponentMounted.current = false;
            sounds.forEach((s) => s.unloadAsync());
        };
    }, [sounds]);

    // Handle screen focus for optimization
    useFocusEffect(
        useCallback(() => {
            console.log("[BirdAnimation] Screen focused, animation restart triggered");
            isScreenFocused.current = true;

            // Restart animations when screen is focused
            birdsRef.current.forEach((bird) => {
                if (bird) {
                    moveBird(bird);
                }
            });

            return () => {
                console.log("[BirdAnimation] Screen unfocused, stopping animations");
                isScreenFocused.current = false;
                // Stop all animations when screen is unfocused
                animationsRef.current.forEach(anim => {
                    if (anim) {
                        anim.stop();
                        anim.reset();
                    }
                });
                // Clear frame intervals
                frameIntervalsRef.current.forEach(interval => {
                    if (interval) clearInterval(interval);
                });
                frameIntervalsRef.current = [];
            };
        }, [moveBird]) // Include moveBird dependency
    );

    // Stable moveBird function that doesn't depend on birds state
    const moveBird = useCallback((bird) => {
        if (!isComponentMounted.current || !isScreenFocused.current) return;

        console.log(`[BirdAnimation] Moving bird ${bird.id}`);
        bird.x.setValue(-64);

        // Find the bird in our ref array to update animation
        const idx = birdsRef.current.findIndex(b => b && b.id === bird.id);
        if (idx >= 0) {
            // Stop any existing animation
            if (animationsRef.current[idx]) {
                animationsRef.current[idx].stop();
            }

            animationsRef.current[idx] = Animated.timing(bird.x, {
                toValue: screenWidth + 64,
                duration: 15000 / bird.speed,
                useNativeDriver: true, // Always use native driver for Android performance
                easing: Easing.linear,
            });

            animationsRef.current[idx].start(({ finished }) => {
                if (finished && isComponentMounted.current && isScreenFocused.current) {
                    console.log(`[BirdAnimation] Animation for bird ${bird.id} completed, restarting`);
                    // Update y position for next flight
                    const newY = Math.random() * (screenHeight - 100);
                    // Update the bird reference without triggering a state update
                    if (birdsRef.current[idx]) {
                        birdsRef.current[idx].y = newY;

                        // Update the state version only once animation completes
                        setBirds(prevBirds => {
                            const newBirds = [...prevBirds];
                            const birdIdx = newBirds.findIndex(b => b.id === bird.id);
                            if (birdIdx !== -1) {
                                newBirds[birdIdx] = {
                                    ...newBirds[birdIdx],
                                    y: newY
                                };
                            }
                            return newBirds;
                        });

                        moveBird(birdsRef.current[idx]); // restart
                    }
                }
            });
        }
    }, []); // Empty dependency array is correct

    // Setup birds - properly wrapped in useEffect with dependencies
    useEffect(() => {
        console.log(`[BirdAnimation] Setting up ${numberOfBirds} birds`);
        // Clear any existing animations
        animationsRef.current.forEach(anim => {
            if (anim) anim.stop();
        });

        const createdBirds = Array.from({ length: numberOfBirds }).map(() => ({
            id: Math.random().toString(36).substring(7),
            sprite: birdSprites[Math.floor(Math.random() * birdSprites.length)],
            x: new Animated.Value(screenWidth + 16),
            y: Math.random() * (screenHeight - 100),
            frameIndex: 0,
            speed: 0.5 + Math.random() * 1.5,
        }));

        setBirds(createdBirds);
        birdsRef.current = [...createdBirds]; // Store in ref for stable access
        animationsRef.current = new Array(numberOfBirds).fill(null);

        // Start movement immediately if component is mounted and screen is focused
        // Using a dedicated animation start effect to separate concerns
        const animationStartTimer = setTimeout(() => {
            if (isComponentMounted.current && isScreenFocused.current) {
                console.log("[BirdAnimation] Starting initial animations");
                createdBirds.forEach(moveBird);
            }
        }, 50);

        return () => {
            console.log("[BirdAnimation] Cleaning up birds effect");
            clearTimeout(animationStartTimer);
            isComponentMounted.current = false;
            isScreenFocused.current = false;
            
            // Clean up all animations
            animationsRef.current.forEach(anim => {
                if (anim) {
                    anim.stop();
                    anim.reset();
                }
            });
            animationsRef.current = [];
            
            // Clean up frame intervals
            frameIntervalsRef.current.forEach(interval => {
                if (interval) clearInterval(interval);
            });
            frameIntervalsRef.current = [];
        };
    }, [numberOfBirds, moveBird]); // Added moveBird as dependency since it's used in the effect

    // Frame animation with optimized updates
    useEffect(() => {
        console.log("[BirdAnimation] Setting up frame animations", birds.length);
        // Clean up previous intervals
        frameIntervalsRef.current.forEach(interval => clearInterval(interval));
        frameIntervalsRef.current = [];

        // Setup new intervals
        const intervals = birds.map((bird) => {
            return setInterval(() => {
                if (isComponentMounted.current && isScreenFocused.current) {
                    setBirds(prevBirds => {
                        const newBirds = [...prevBirds];
                        const birdIndex = newBirds.findIndex(b => b.id === bird.id);
                        if (birdIndex !== -1) {
                            // Only update the frameIndex property, not the entire bird object
                            const newFrameIndex = (newBirds[birdIndex].frameIndex + 1) % 4;
                            newBirds[birdIndex] = {
                                ...newBirds[birdIndex],
                                frameIndex: newFrameIndex
                            };

                            // Also update the ref to keep them in sync
                            if (birdsRef.current[birdIndex]) {
                                birdsRef.current[birdIndex].frameIndex = newFrameIndex;
                            }
                        }
                        return newBirds;
                    });
                }
            }, 300);
        });

        frameIntervalsRef.current = intervals;

        return () => {
            intervals.forEach(clearInterval);
        };
    }, [birds]);

    const playRandomSound = useCallback(async () => {
        if (sounds.length > 0 && isComponentMounted.current) {
            const randomSound = sounds[Math.floor(Math.random() * sounds.length)];
            try {
                await randomSound.replayAsync();
            } catch (error) {
                console.warn("Error playing bird sound:", error);
            }
        }
    }, [sounds]);

    // Use useMemo for bird view components to prevent unnecessary re-renders
    const birdComponents = useMemo(() => {
        console.log("[BirdAnimation] Rendering bird components:", birds.length);
        return birds.map((bird) => {
            return (
                <TouchableWithoutFeedback
                    key={bird.id}
                    onPress={playRandomSound}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} // Expand touch area
                >
                    <Animated.View
                        style={[
                            styles.bird,
                            { transform: [{ translateX: bird.x }, { translateY: bird.y }] }
                        ]}
                    >
                        <View style={styles.frame}>
                            <View
                                style={{
                                    width: 64,
                                    height: 64,
                                    transform: [
                                        { translateX: -bird.frameIndex * 16 },
                                        { translateY: 0 },
                                        { scaleX: -1 },
                                    ],
                                }}
                            >
                                <Animated.Image
                                    source={bird.sprite}
                                    style={{
                                        width: 64,
                                        height: 64,
                                    }}
                                    resizeMode="cover"
                                />
                            </View>
                        </View>
                    </Animated.View>
                </TouchableWithoutFeedback>
            );
        });
    }, [birds, playRandomSound]); // Depend only on birds array and sound function

    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            {birdComponents}
        </View>
    );
};

const styles = StyleSheet.create({
    bird: {
        position: 'absolute',
        width: 32,
        height: 32,
        zIndex: -1,
    },
    frame: {
        width: 16,
        height: 16,
        overflow: 'hidden',
    },
});

export default BirdAnimation;

