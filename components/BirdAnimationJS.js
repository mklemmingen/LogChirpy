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
        
        Animated.timing(bird.x, {
            toValue: screenWidth + 64,
            duration: 15000 / bird.speed,
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) {
                bird.baseY = Math.random() * (screenHeight - 200) + 100;
                bird.waveAmplitude = 30 + Math.random() * 40;
                bird.waveFrequency = 0.5 + Math.random() * 1.5;
                moveBird(bird);
            }
        });

        const waveAnimation = () => {
            const startTime = Date.now();
            const animateWave = () => {
                const elapsed = Date.now() - startTime;
                const progress = (elapsed / (15000 / bird.speed));
                
                if (progress < 1) {
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
        if (birds.length === 0) return;
        
        const intervals = birds.map((bird) =>
            setInterval(() => {
                bird.frameIndex = (bird.frameIndex + 1) % 4;
                setBirds((prevBirds) => [...prevBirds]);
            }, 300)
        );
        return () => intervals.forEach(clearInterval);
    }, [birds.length]);

    const playRandomSound = async () => {
        if (sounds.length > 0) {
            const randomSound = sounds[Math.floor(Math.random() * sounds.length)];
            await randomSound.replayAsync();
        }
    };

    return (
        <View style={styles.container} pointerEvents="box-none">
            {birds.map((bird) => (
                <TouchableWithoutFeedback 
                    key={bird.id} 
                    onPress={playRandomSound}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Flying bird animation"
                    accessibilityHint="Tap to play bird sound"
                >
                    <Animated.View style={[styles.bird, { 
                        transform: [
                            { translateX: bird.x },
                            { translateY: bird.y }
                        ]
                    }]}>
                        <View style={styles.frame}>
                            <Animated.Image
                                source={bird.sprite}
                                style={[styles.sprite, {
                                    transform: [
                                        { translateX: -bird.frameIndex * 16 },
                                        { scaleX: -1 },
                                    ],
                                }]}
                                resizeMode="cover"
                                accessible={false}
                            />
                        </View>
                    </Animated.View>
                </TouchableWithoutFeedback>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: -1,
    },
    bird: {
        position: 'absolute',
        width: 64,
        height: 64,
    },
    frame: {
        width: 16,
        height: 16,
        overflow: 'hidden',
    },
    sprite: {
        width: 64,
        height: 64,
    },
});

export default BirdAnimation;