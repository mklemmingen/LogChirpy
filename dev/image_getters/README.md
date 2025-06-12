# Bird Image Fetcher for LogChirpy

This Python script automatically fetches bird images from Wikimedia Commons for all birds in the LogChirpy database and optimizes them for mobile use.

## Features

- 🤖 **Fully automated by default** - zero human interaction needed
- ✅ **Automatic image fetching** from Wikimedia Commons API
- ✅ **Enhanced filtering** - avoids maps, eggs, nests, diagrams
- ✅ **Quality scoring** - prioritizes actual bird photographs
- ✅ **Smart overwrite handling** - automatically replaces with better quality
- ✅ **Auto-resume** - continues from where it left off
- ✅ **Mobile optimization** - resizes to max 512x512px
- ✅ **Dual format support** - saves as WebP (primary) and JPEG (fallback)
- ✅ **Smart compression** - optimized for mobile bandwidth
- ✅ **Progress tracking** - resume interrupted downloads
- ✅ **Rate limiting** - respects Wikimedia's servers
- ✅ **Error handling** - graceful failure and retry logic
- ✅ **Manifest generation** - creates metadata file for the app

## Quick Start

1. **Setup environment:**
   ```bash
   cd dev/image_getters
   ./setup_and_run.sh
   ```

2. **Test with dry run:**
   ```bash
   source venv/bin/activate
   python bird_image_fetcher.py --dry-run
   ```

3. **Download images (fully automated by default):**
   ```bash
   # Download 10 birds - completely automated
   python bird_image_fetcher.py --limit 10
   
   # Download ALL birds - fully automated (will take hours)
   python bird_image_fetcher.py
   ```

## Usage Options

### Basic Commands (Fully Automated by Default)
```bash
# See what would be downloaded (no actual downloads)
python bird_image_fetcher.py --dry-run

# Download first 10 bird images (auto-resume, smart overwrite)
python bird_image_fetcher.py --limit 10

# Download specific species
python bird_image_fetcher.py --species "Turdus migratorius"

# Download ALL images - FULLY AUTOMATED (~10,000+ images, takes hours)
python bird_image_fetcher.py

# Start fresh (ignore previous progress)
python bird_image_fetcher.py --no-resume
```

### Overwrite Handling
```bash
# Default: Automatically replace with better quality (RECOMMENDED)
python bird_image_fetcher.py --overwrite better

# Never overwrite existing files (fastest for reruns)
python bird_image_fetcher.py --overwrite never

# Always overwrite existing files
python bird_image_fetcher.py --overwrite always

# Ask before overwriting each file (INTERACTIVE MODE)
python bird_image_fetcher.py --overwrite ask

# Force redownload even if marked as processed
python bird_image_fetcher.py --force-redownload
```

### Advanced Usage
```bash
# Download with custom limit and resume capability
python bird_image_fetcher.py --limit 100 --resume

# Download images for birds containing "eagle" in the name
python bird_image_fetcher.py --species eagle
```

## Output Structure

The script creates the following files:

```
assets/images/birds/
├── scientific_name.webp          # Primary mobile-optimized format
├── scientific_name.jpg           # Fallback format
├── bird_images_manifest.json     # Metadata for the app
└── ...

dev/image_getters/
├── download_progress.json         # Progress tracking
├── bird_image_fetcher.log        # Detailed logs
└── venv/                         # Python virtual environment
```

## Technical Details

### Image Processing
- **Source**: Wikimedia Commons high-quality images
- **Formats**: WebP (primary), JPEG (fallback)
- **Max dimensions**: 512x512 pixels
- **WebP quality**: 80% (optimal for mobile)
- **JPEG quality**: 85% (good fallback quality)
- **Min dimensions**: 200x200 pixels (rejects too small images)

### API Usage
- **Rate limiting**: 1 second delay between requests
- **User agent**: Identifies as educational app
- **Enhanced search strategy**: Multiple targeted searches (male, female, adult, portrait)
- **Smart filtering**: Automatically avoids maps, eggs, nests, diagrams
- **Quality scoring**: Prioritizes actual bird photographs over related content

### Progress Tracking
- **Resume capability**: Can restart interrupted downloads
- **Progress file**: `download_progress.json` tracks completed downloads
- **Logging**: Detailed logs in `bird_image_fetcher.log`
- **Manifest**: `bird_images_manifest.json` contains metadata for app use

## Integration with LogChirpy App

The generated images and manifest can be used in the app:

1. **Image loading**: Use scientific names to load images
2. **Format selection**: Try WebP first, fallback to JPEG
3. **Manifest data**: Contains species info and availability

Example app integration:
```typescript
// Load bird image in the app
const scientificName = "Turdus_migratorius"; // sanitized name
const webpPath = `assets/images/birds/${scientificName}.webp`;
const jpgPath = `assets/images/birds/${scientificName}.jpg`;

// Check manifest for availability
import manifest from 'assets/images/birds/bird_images_manifest.json';
const hasImage = manifest.images[originalScientificName]?.has_image;
```

## Troubleshooting

### Common Issues

1. **"No images found"**: Some birds might not have good images on Commons
2. **"Image too small"**: Script rejects images smaller than 200x200px
3. **Network errors**: Script automatically retries with delays
4. **Permission errors**: Check write permissions to assets/images/birds/

### Performance Tips

1. **Start small**: Use `--limit 10` for testing
2. **Resume downloads**: Use `--resume` if interrupted
3. **Check logs**: Monitor `bird_image_fetcher.log` for issues
4. **Disk space**: Ensure enough space (~2-5MB per bird image)

### Debug Mode
```bash
# See detailed what's happening
tail -f bird_image_fetcher.log

# Check progress
python -c "import json; print(json.load(open('download_progress.json')))"
```

## Ethical Usage

This script:
- ✅ Respects Wikimedia's rate limits
- ✅ Uses proper User-Agent identification
- ✅ Only downloads Creative Commons/public domain images
- ✅ Attributes source in manifest file
- ✅ Educational use case (bird watching app)

## License

This script is for educational use with the LogChirpy bird watching app. All downloaded images maintain their original Wikimedia Commons licensing.