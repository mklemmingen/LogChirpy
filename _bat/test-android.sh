#!/bin/bash
echo "Testing Android build and launch..."

# Clean previous builds
cd android && ./gradlew clean && cd ..

# Clear metro cache
npx react-native start --reset-cache &
METRO_PID=$!

# Wait for metro to start
sleep 5

# Run android
npx react-native run-android

# Keep metro running
wait $METRO_PID