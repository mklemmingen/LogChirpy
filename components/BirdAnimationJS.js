import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Dimensions, Easing, StyleSheet, TouchableWithoutFeedback, View} from 'react-native';
import {Audio} from 'expo-av';

// Ensure global timers are available
/* global setInterval, clearInterval */

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

const BirdAnimation = ({ numberOfBirds = 3 }) => {
    const [birds, setBirds] = useState([]);
    const [sounds, setSounds] = useState([]);
    const animationFrameRef = useRef();
    const frameCountRef = useRef(0);

    useEffect(() => {
        const loadSounds = async () => {
            const loaded = await Promise.all(
                birdSounds.map(async (file) => {
                    const { sound } = await Audio.Sound.createAsync(file);
                    return sound;
                })
            );
            setSounds(loaded);
        };
        loadSounds();
    }, []);

    // Cleanup sounds when component unmounts
    useEffect(() => {
        return () => {
            sounds.forEach((s) => s.unloadAsync());
        };
    }, [sounds]);

    const moveBird = useCallback((bird) => {
        // Reset bird position with random entry height
        const startY = bird.baseY + (Math.random() - 0.5) * 100;
        bird.x.setValue(-64);
        bird.y.setValue(startY);
        
        // Create curved flight path with optimized timing
        const duration = (15000 + Math.random() * 8000) / bird.speed; // Slightly longer for less restarts
        const amplitude = 20 + Math.random() * 30;
        const frequency = 0.002 + Math.random() * 0.001;
        
        // Horizontal movement
        Animated.timing(bird.x, {
            toValue: screenWidth + 64,
            duration: duration,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) {
                bird.baseY = Math.random() * (screenHeight - 200) + 50;
                moveBird(bird);
            }
        });
        
        // Optimized vertical bobbing with 30fps
        const animateVertical = () => {
            let startTime = Date.now();
            const animate = () => {
                frameCountRef.current++;
                // Run at 30fps (every other frame)
                if (frameCountRef.current % 2 === 0) {
                    const elapsed = Date.now() - startTime;
                    if (elapsed < duration) {
                        const progress = elapsed / duration;
                        const xPos = progress * (screenWidth + 128) - 64;
                        const bobOffset = Math.sin(xPos * frequency) * amplitude;
                        bird.y.setValue(startY + bobOffset);
                    }
                }
                if (Date.now() - startTime < duration) {
                    animationFrameRef.current = requestAnimationFrame(animate);
                }
            };
            animate();
        };
        
        animateVertical();
    }, []);

    useEffect(() => {
        const createdBirds = Array.from({ length: numberOfBirds }).map(() => {
            const baseY = Math.random() * (screenHeight - 200) + 50;
            return {
                id: Math.random().toString(36).substring(7),
                sprite: birdSprites[Math.floor(Math.random() * birdSprites.length)],
                x: new Animated.Value(screenWidth + 16),
                y: new Animated.Value(baseY),
                baseY: baseY,
                frameIndex: 0,
                speed: 0.8 + Math.random() * 0.7,
            };
        });
        setBirds(createdBirds);

        // start movement immediately
        createdBirds.forEach(moveBird);
    }, [numberOfBirds, moveBird]);

    useEffect(() => {
        const intervals = birds.map((bird, index) =>
            setInterval(() => {
                bird.frameIndex = (bird.frameIndex + 1) % 4;
                // Force minimal re-render by updating only when necessary
                setBirds((prevBirds) => {
                    const newBirds = [...prevBirds];
                    return newBirds;
                });
            }, 180 + (index * 30)) // Slower but still smooth wing flapping
        );
        return () => {
            intervals.forEach(clearInterval);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [birds]);

    const playRandomSound = async () => {
        if (sounds.length > 0) {
            const randomSound = sounds[Math.floor(Math.random() * sounds.length)];
            await randomSound.replayAsync();
        }
    };

    return (
        <View style={StyleSheet.absoluteFill}>
            {birds.map((bird) => (
                <TouchableWithoutFeedback key={bird.id} onPress={playRandomSound}>
                    <Animated.View style={[styles.bird, { 
                        transform: [{ translateX: bird.x }, { translateY: bird.y }] 
                    }]}>
                        <View style={styles.frame}>
                            <Animated.Image
                                source={bird.sprite}
                                style={{
                                    width: 64,
                                    height: 64,
                                    transform: [
                                        { translateX: -bird.frameIndex * 16 },
                                        { translateY: 0 },
                                        { scaleX: -1 },
                                    ],
                                }}
                                resizeMode="cover"
                                shouldRasterizeIOS={true}
                            />
                        </View>
                    </Animated.View>
                </TouchableWithoutFeedback>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    bird: {
        position: 'absolute',
        width: 256,
        height: 256,
        zIndex: -1,
    },
    frame: {
        width: 16,
        height: 16,
        overflow: 'hidden',
    },
});

export default BirdAnimation;