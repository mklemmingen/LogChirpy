import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions, TouchableWithoutFeedback } from 'react-native';
import { Audio } from 'expo-av';

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
            y: Math.random() * (screenHeight - 100),
            frameIndex: 0,
            speed: 0.2 + Math.random() * 1.5,
        }));
        setBirds(createdBirds);

        // start movement immediately
        createdBirds.forEach(moveBird);
    }, [numberOfBirds]);

    const moveBird = (bird) => {
        bird.x.setValue(-64);
        Animated.timing(bird.x, {
            toValue: screenWidth + 64,
            duration: 15000 / bird.speed,
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished) {
                bird.y = Math.random() * (screenHeight - 100); // just update y manually
                moveBird(bird); // restart
            }
        });
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
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {birds.map((bird) => {
                const offsetX = -bird.frameIndex * 64;
                return (
                    <TouchableWithoutFeedback key={bird.id} onPress={playRandomSound}>
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