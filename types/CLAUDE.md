# CLAUDE.md - LogChirpy Development Guide

## Project Overview

LogChirpy is a mobile bird watching application built with React Native, Expo, and TypeScript. The app enables ornithological documentation through photos, audio recordings, and manual entries, featuring AI-powered bird identification and comprehensive archival capabilities.

### Current Implementation Status

The project has evolved from its initial planning to include:
- **Fully local ML models** (no longer dependent on external APIs)
- **BirDex database** containing all global bird species (~30,000 species)
- **Multi-language support** in 6 languages: English, German, Spanish, French, Ukrainian, and Arabic
- **Firebase-synchronized bird spotting database** for cloud backup and cross-device sync

## User Stories

### User Story 1: Bird Recognition and Logging
**As an amateur hiker**, I want to use a bird recognition app that identifies birds by their calls, so I can log my sightings with optional images and GPS coordinates in my cloud archive.

**Acceptance Criteria:**
1. The app can accurately identify bird species by their calls
2. The app allows users to take and upload images of birds
3. The app logs GPS coordinates of sightings
4. The app stores all data in a cloud archive accessible to the user

### User Story 2: Digital Bird Watching Tool
**As a long-time hobby ornithologist**, I want an electronic alternative for bird identification and logging, so I can efficiently document observations, retrieve detailed bird information, and share data with other ornithologists.

**Acceptance Criteria:**
1. The app provides accurate bird identification by voice
2. The app allows users to log observations with images and GPS coordinates
3. The app provides detailed information about each bird species
4. The app enables data exchange with other ornithologists
5. The app stores all data in a cloud archive accessible to the user

### User Story 3: Archive Access and Export
**As an amateur hiker**, I want to occasionally switch to the archive tab, search for a beautiful bird image, and export it to other apps, so I can share my bird observations with friends and on social media.

**Acceptance Criteria:**
1. The app allows users to easily switch to the archive tab
2. The app provides a search function to find specific bird images
3. The app allows users to select and export images to other apps
4. The app maintains image quality during export
5. The app stores all data in a cloud archive accessible to the user

### User Story 4: Quick Image Sharing
**As a long-time hobby ornithologist**, I want to quickly share a recently captured image, so I can immediately share my bird observations with friends and other ornithologists.

**Acceptance Criteria:**
1. The app allows users to quickly access recently captured images
2. The app provides a simple sharing option directly from the image view
3. The app supports sharing on multiple platforms (social media, email)
4. The app maintains image quality during sharing
5. The app stores all data in a cloud archive accessible to the user

### User Story 5: Finding Sparrow Sighting
**As a long-time hobby ornithologist**, I want to find out where I saw a specific sparrow, so I can remember the location and possibly visit it again.

**Acceptance Criteria:**
1. The app allows users to open the map tab
2. The app provides a filter option to display birds by type (e.g., sparrow)
3. The app shows locations of all sparrow sightings on the map
4. The app allows users to click on a location to view sighting details
5. The app stores all data in a cloud archive accessible to the user

### User Story 6: First-time App Usage
**As a new user**, I want to understand how to use the bird identification and logging app, so I can effectively start identifying and logging bird observations.

**Acceptance Criteria:**
1. The app provides an inviting onboarding tutorial guiding users through main functions
2. The app includes a simple and intuitive user interface
3. The app allows users to perform a test bird identification to familiarize with the process
4. The app explains how to log sightings with images and GPS coordinates
5. The app shows how to access the archive and share sightings

## Key Technical Details

### Machine Learning
- **Local TFLite models** for bird classification (MobileNetV2)
- **MLKit integration** for object detection (SSD MobileNet)
- **BirdNet model** converted from .h5 to .tflite for audio classification
- All ML processing happens on-device for privacy and offline capability

### Database Architecture
- **Local SQLite** for offline-first operation
- **Firebase Firestore** for cloud synchronization
- **BirDex database** with 30,000+ bird species, fully translated

### Supported Languages
1. English (en)
2. German (de)
3. Spanish (es)
4. French (fr)
5. Ukrainian (uk)
6. Arabic (ar)

### Development Commands

```bash
# Run TypeScript type checking
npm run typecheck

# Start development server
npm start

# Run on Android device
npm run android:device

# Run tests
npm test
```

### Important File Locations
- **Contexts**: `/contexts/` (AuthContext, LogDraftContext)
- **ML Models**: `/assets/models/`
- **Localization**: `/locales/`
- **Services**: `/services/`
- **Components**: `/components/`

## Recent Changes
- Fixed BirdexLayout component naming issue
- Moved context files from `/app/context/` to `/contexts/`
- Updated all imports to use new context paths
- All TypeScript errors resolved