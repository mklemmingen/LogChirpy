import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, TouchableWithoutFeedback } from 'react-native';
import { Audio } from 'expo-av';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';

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

const BirdAnimation = ({ numberOfBirds = 5 }) => {
    const [birds, setBirds] = useState([]);
    const [sounds, setSounds] = useState([]);
    const dimensions = useResponsiveDimensions();
    
    const { width: screenWidth, height: screenHeight } = dimensions.screen;

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

        return () => {
            sounds.forEach((s) => s.unloadAsync());
        };
    }, []);

    useEffect(() => {
        const createdBirds = Array.from({ length: numberOfBirds }).map(() => ({
            id: Math.random().toString(36).substring(7),
            sprite: birdSprites[Math.floor(Math.random() * birdSprites.length)],
            x: new Animated.Value(screenWidth + 16), // 16 is frame width
            y: new Animated.Value(Math.random() * (screenHeight - 200) + 100), // Now animated
            baseY: Math.random() * (screenHeight - 200) + 100, // Store base height for wave calculation
            frameIndex: 0,
            speed: 0.2 + Math.random() * 1.5,
            waveAmplitude: 30 + Math.random() * 40, // Random wave height (30-70px)
            waveFrequency: 0.5 + Math.random() * 1.5, // Random wave frequency
        }));
        setBirds(createdBirds);

        // start movement immediately
        createdBirds.forEach(moveBird);
    }, [numberOfBirds]);

    const moveBird = (bird) => {
        bird.x.setValue(-64);
        bird.y.setValue(bird.baseY);
        
        // Create wavy flight path using parallel animations
        Animated.parallel([
            // Horizontal movement (same as before)
            Animated.timing(bird.x, {
                toValue: screenWidth + 64,
                duration: 15000 / bird.speed,
                useNativeDriver: false,
            }),
            // Vertical wave movement - creates sine wave pattern
            Animated.timing(bird.y, {
                toValue: bird.baseY + Math.sin(bird.waveFrequency * Math.PI) * bird.waveAmplitude,
                duration: 15000 / bird.speed,
                useNativeDriver: false,
            }),
        ]).start(({ finished }) => {
            if (finished) {
                // Generate new flight path parameters for next journey
                bird.baseY = Math.random() * (screenHeight - 200) + 100;
                bird.waveAmplitude = 30 + Math.random() * 40;
                bird.waveFrequency = 0.5 + Math.random() * 1.5;
                moveBird(bird); // restart with new path
            }
        });

        // Add continuous wave effect during flight
        const waveAnimation = () => {
            const startTime = Date.now();
            const animateWave = () => {
                const elapsed = Date.now() - startTime;
                const progress = (elapsed / (15000 / bird.speed)); // 0 to 1
                
                if (progress < 1) {
                    // Calculate sine wave Y position based on horizontal progress
                    const waveY = bird.baseY + 
                        Math.sin(progress * Math.PI * bird.waveFrequency * 4) * bird.waveAmplitude;
                    
                    bird.y.setValue(waveY);
                    requestAnimationFrame(animateWave);
                }
            };
            requestAnimationFrame(animateWave);
        };
        
        waveAnimation();
    };

    useEffect(() => {
        const intervals = birds.map((bird) =>
            setInterval(() => {
                bird.frameIndex = (bird.frameIndex + 1) % 4; // local change
                setBirds((prevBirds) => [...prevBirds]);
            }, 300)
        );
        return () => intervals.forEach(clearInterval);
    }, [birds]);

    const playRandomSound = async () => {
        if (sounds.length > 0) {
            const randomSound = sounds[Math.floor(Math.random() * sounds.length)];
            await randomSound.replayAsync();
        }
    };

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {birds.map((bird) => {
                const offsetX = -bird.frameIndex * 64;
                return (
                    <TouchableWithoutFeedback 
                        key={bird.id} 
                        onPress={playRandomSound}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Flying bird animation"
                        accessibilityHint="Tap to play bird sound"
                    >
                        <Animated.View style={[styles.bird, { top: bird.y, left: bird.x }]}>
                            <View style={styles.frame}>
                                <Animated.Image
                                    source={bird.sprite}
                                    style={{
                                        width: 64,   // full sprite sheet width
                                        height: 64,  // full sprite sheet height
                                        transform: [
                                            { translateX: -bird.frameIndex * 16 }, // 16px shift per frame
                                            { translateY: 0 },
                                            { scaleX: -1 },
                                        ],
                                    }}
                                    resizeMode="cover"
                                    accessible={false} // Decorative image
                                />
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                );
            })}
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