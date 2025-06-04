# LogChirpy - Bird Identification App

A React Native app for bird identification using audio recordings and the BirdNET machine learning model.
 
**Ongoing Development** | **AGPL-3.0 License**

## Features

- **Audio Bird Identification**: Record bird sounds and get species identification
- **Offline-First**: Works without internet using local BirdNET model
- **6,522 Species Database**: Complete BirdNET v2.4 species catalog
- **Manual Logging**: Add bird sightings with photos, location, and notes
- **Personal Archive**: Track your bird observations over time
- **BirdDex**: Browse and search bird species information

## Tech Stack

**Frontend**: React Native with Expo | **AI/ML**: TensorFlow.js with BirdNET v2.4 model | **Database**: SQLite for local data storage | **Authentication**: Firebase Auth | **Cloud Storage**: Firebase Firestore

## Getting Started

### Prerequisites

- Node.js 18+ 
- Expo CLI
- Android Studio / Xcode for device testing

### Installation

```bash
# Clone the repository
git clone [repository-url]
cd l

# Install dependencies
npm install

# Start the development server
npm start
```

### Running on Device

```bash
# Android
npm run android

# iOS  
npm run ios
```

## Project Structure

```
├── app/                    # Main app screens and routing
│   ├── (tabs)/            # Tab navigation screens
│   ├── log/              # Bird logging workflows
│   └── context/          # React Context providers
├── components/           # Reusable UI components
├── services/            # Core business logic
│   ├── audioPreprocessing.ts    # Audio to spectrogram conversion
│   ├── tensorflowLiteModel.ts   # BirdNET model interface
│   ├── birdNetService.ts        # Bird identification service
│   └── database.ts              # SQLite database operations
├── assets/              # Static files and model data
│   └── models/birdnet/  # BirdNET model files (6.9MB)
└── hooks/               # Custom React hooks
```

## Key Services

### BirdNetService
Main bird identification interface with offline-first approach:
- Tries local model first
- Falls back to online API if available
- Handles network connectivity checks

### TensorFlowLiteModelService  
Manages the local BirdNET model:
- Loads 6,522 species labels
- Preprocesses audio to mel-spectrograms
- Runs inference and post-processes results

### AudioPreprocessingService
Converts audio files for model input:
- Resampling to 22kHz
- STFT with Hann windowing
- Mel-scale spectrogram generation
- Tensor formatting (224x224x3)

## Model Information

- **Model**: BirdNET v2.4 (Cornell Lab of Ornithology)
- **Species**: 6,522 bird species worldwide
- **Input**: Mel-spectrogram (224x224x3)
- **Size**: 6.9MB optimized for mobile
- **Accuracy**: ~89% on test dataset

## Development

### Adding New Features

1. Create service logic in `/services/`
2. Add UI components in `/components/` 
3. Wire up in app screens under `/app/`
4. Update database schema if needed

### Testing

```bash
# Run linting
npm run lint

# Type checking
npx tsc --noEmit
```

### Model Updates

To update the bird identification model:

1. Place new model files in `/assets/models/birdnet/`
2. Update species count in `TensorFlowLiteModelService`
3. Test with sample audio files

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with proper documentation
4. Test thoroughly on both platforms
5. Submit a pull request

## License

AGPL-3.0 License - see LICENSE file for details

## Acknowledgments

- Cornell Lab of Ornithology for BirdNET
- TensorFlow.js team for mobile ML support
- Expo team for React Native development tools