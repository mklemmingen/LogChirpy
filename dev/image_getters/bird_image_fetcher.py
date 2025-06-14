#!/usr/bin/env python3
"""
Bird Image Fetcher for LogChirpy App

This script fetches bird images from Wikimedia Commons based on scientific names
from the birds CSV file and optimizes them for mobile use.

Features:
- Fetches high-quality images from Wikimedia Commons
- Compresses and optimizes for mobile devices
- Handles rate limiting and error cases
- Saves images with scientific names as filenames
- Creates WebP format for optimal mobile compression
- Generates a manifest file with image metadata

Usage:
    python bird_image_fetcher.py [--dry-run] [--limit N] [--resume]
"""

import os
import csv
import time
import requests
import json
import argparse
from typing import Dict, List, Optional, Tuple
from urllib.parse import quote, urljoin
from pathlib import Path
import hashlib
from PIL import Image, ImageOps
import io
import logging

# Configuration
WIKIMEDIA_API_BASE = "https://commons.wikimedia.org/w/api.php"
WIKIMEDIA_FILE_BASE = "https://commons.wikimedia.org/wiki/Special:FilePath/"
USER_AGENT = "LogChirpyBirdImageFetcher/1.0 (Educational bird watching app)"
MAX_IMAGE_SIZE = (512, 512)  # Max dimensions for mobile
JPEG_QUALITY = 85
WEBP_QUALITY = 80
MIN_IMAGE_SIZE = (200, 200)  # Minimum acceptable size
REQUEST_DELAY = 1.0  # Delay between requests (be nice to Wikimedia)

# File paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
BIRDS_CSV_PATH = PROJECT_ROOT / "assets" / "data" / "birds_fully_translated.csv"
OUTPUT_DIR = PROJECT_ROOT / "assets" / "images" / "birds"
MANIFEST_PATH = OUTPUT_DIR / "bird_images_manifest.json"
PROGRESS_PATH = SCRIPT_DIR / "download_progress.json"

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(SCRIPT_DIR / 'bird_image_fetcher.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class WikimediaImageFetcher:
    """Handles fetching and processing bird images from Wikimedia Commons."""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': USER_AGENT})
        self.download_count = 0
        self.success_count = 0
        self.error_count = 0
        
    def search_bird_images(self, scientific_name: str, common_name: str = "") -> List[Dict]:
        """Search for bird images on Wikimedia Commons with enhanced filtering."""
        # Enhanced search terms prioritizing actual bird photos
        search_terms = [
            f"{scientific_name} bird photo",
            f"{scientific_name} male",
            f"{scientific_name} female", 
            f"{scientific_name} adult",
            f"{scientific_name} portrait",
            scientific_name,
            f"{scientific_name} bird",
            f"{common_name} bird" if common_name else "",
            common_name if common_name else ""
        ]
        
        all_results = []
        for term in search_terms:
            if not term:
                continue
                
            try:
                results = self._search_commons_images(term)
                filtered_results = self._filter_bird_images(results, scientific_name)
                all_results.extend(filtered_results)
                if len(all_results) >= 15:  # More candidates for better filtering
                    break
                time.sleep(REQUEST_DELAY)
            except Exception as e:
                logger.warning(f"Search failed for '{term}': {e}")
                continue
                
        return self._deduplicate_and_score_results(all_results, scientific_name)
    
    def _search_commons_images(self, search_term: str) -> List[Dict]:
        """Search Wikimedia Commons for images."""
        params = {
            'action': 'query',
            'format': 'json',
            'list': 'search',
            'srsearch': f'filetype:bitmap {search_term}',
            'srnamespace': 6,  # File namespace
            'srlimit': 10,
            'srprop': 'size|wordcount|timestamp|snippet'
        }
        
        try:
            response = self.session.get(WIKIMEDIA_API_BASE, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            if 'query' not in data or 'search' not in data['query']:
                return []
                
            results = []
            for item in data['query']['search']:
                # Filter for likely bird images based on title
                title = item['title'].lower()
                if any(word in title for word in ['bird', 'aves', search_term.lower()]):
                    results.append({
                        'title': item['title'],
                        'size': item.get('size', 0),
                        'timestamp': item.get('timestamp', ''),
                        'snippet': item.get('snippet', '')
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Commons search error for '{search_term}': {e}")
            return []
    
    def _filter_bird_images(self, results: List[Dict], scientific_name: str) -> List[Dict]:
        """Filter results to prioritize actual bird photos."""
        # Keywords that indicate unwanted content
        bad_keywords = [
            'egg', 'eggs', 'nest', 'nesting', 'map', 'distribution', 'range', 
            'footprint', 'track', 'tracks', 'feather', 'feathers', 'skeleton', 
            'diagram', 'chart', 'graph', 'illustration', 'drawing', 'painting',
            'museum', 'specimen', 'skull', 'bone', 'wing', 'tail', 'beak',
            'habitat', 'environment', 'landscape', 'migration', 'call', 'song',
            'sound', 'audio', 'spectrogram', 'analysis', 'study', 'research'
        ]
        
        # Keywords that indicate good bird photos
        good_keywords = [
            'male', 'female', 'adult', 'juvenile', 'breeding', 'plumage',
            'portrait', 'photo', 'photograph', 'bird', 'flying', 'perched',
            'sitting', 'standing', 'feeding', 'foraging', scientific_name.lower()
        ]
        
        filtered_results = []
        for result in results:
            title = result['title'].lower()
            snippet = result.get('snippet', '').lower()
            
            # Skip if contains bad keywords
            if any(bad_word in title or bad_word in snippet for bad_word in bad_keywords):
                continue
            
            # Boost score if contains good keywords
            good_score = sum(1 for good_word in good_keywords if good_word in title or good_word in snippet)
            result['quality_score'] = good_score
            
            filtered_results.append(result)
        
        return filtered_results
    
    def _deduplicate_and_score_results(self, results: List[Dict], scientific_name: str) -> List[Dict]:
        """Remove duplicate results, score, and sort by quality."""
        seen_titles = set()
        unique_results = []
        
        for result in results:
            if result['title'] not in seen_titles:
                seen_titles.add(result['title'])
                unique_results.append(result)
        
        # Enhanced scoring system
        for result in unique_results:
            score = result.get('quality_score', 0)
            title = result['title'].lower()
            
            # Boost score for scientific name in title
            if scientific_name.lower() in title:
                score += 10
            
            # Boost score for file naming patterns that suggest good photos
            if any(pattern in title for pattern in ['male', 'female', 'adult', 'portrait']):
                score += 5
            
            # Boost score for larger images
            size_score = min(result.get('size', 0) / 1000000, 5)  # Up to 5 points for size
            score += size_score
            
            result['final_score'] = score
        
        # Sort by final score (highest first), then by size
        return sorted(unique_results, 
                     key=lambda x: (x.get('final_score', 0), x.get('size', 0)), 
                     reverse=True)
    
    def get_image_info(self, filename: str) -> Optional[Dict]:
        """Get detailed information about an image file."""
        params = {
            'action': 'query',
            'format': 'json',
            'prop': 'imageinfo',
            'iiprop': 'url|size|mime|metadata',
            'titles': filename
        }
        
        try:
            response = self.session.get(WIKIMEDIA_API_BASE, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            pages = data.get('query', {}).get('pages', {})
            for page_id, page_data in pages.items():
                if 'imageinfo' in page_data and page_data['imageinfo']:
                    return page_data['imageinfo'][0]
            
            return None
            
        except Exception as e:
            logger.error(f"Image info error for '{filename}': {e}")
            return None
    
    def download_and_process_image(self, scientific_name: str, image_url: str, overwrite_policy: str = 'never') -> Optional[str]:
        """Download and process an image for mobile use."""
        try:
            # Download image
            response = self.session.get(image_url, timeout=60, stream=True)
            response.raise_for_status()
            
            # Load image
            image_data = io.BytesIO()
            for chunk in response.iter_content(chunk_size=8192):
                image_data.write(chunk)
            image_data.seek(0)
            
            with Image.open(image_data) as img:
                # Validate image
                if img.size[0] < MIN_IMAGE_SIZE[0] or img.size[1] < MIN_IMAGE_SIZE[1]:
                    logger.warning(f"Image too small for {scientific_name}: {img.size}")
                    return None
                
                # Convert to RGB if necessary
                if img.mode not in ('RGB', 'L'):
                    img = img.convert('RGB')
                
                # Apply auto-orientation
                img = ImageOps.exif_transpose(img)
                
                # Resize for mobile
                img.thumbnail(MAX_IMAGE_SIZE, Image.Resampling.LANCZOS)
                
                # Generate filename
                safe_name = self._sanitize_filename(scientific_name)
                webp_filename = f"{safe_name}.webp"
                jpg_filename = f"{safe_name}.jpg"
                
                # Ensure output directory exists
                OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
                
                webp_path = OUTPUT_DIR / webp_filename
                jpg_path = OUTPUT_DIR / jpg_filename
                
                # Check overwrite policy
                should_save = self._should_overwrite_files(webp_path, jpg_path, img, overwrite_policy, scientific_name)
                if not should_save:
                    logger.info(f"Skipping {scientific_name} - files exist and overwrite policy is '{overwrite_policy}'")
                    return webp_filename  # Return existing filename
                
                # Save as WebP (primary format)
                img.save(webp_path, 'WEBP', quality=WEBP_QUALITY, optimize=True)
                
                # Save as JPEG (fallback)
                img.save(jpg_path, 'JPEG', quality=JPEG_QUALITY, optimize=True)
                
                logger.info(f"Saved images for {scientific_name}: {webp_filename}, {jpg_filename}")
                self.success_count += 1
                return webp_filename
                
        except Exception as e:
            logger.error(f"Download/process error for {scientific_name}: {e}")
            self.error_count += 1
            return None
    
    def _sanitize_filename(self, name: str) -> str:
        """Create a safe filename from scientific name."""
        # Replace spaces with underscores, remove special characters
        safe_name = name.replace(' ', '_').replace('.', '').replace(',', '')
        # Remove any non-alphanumeric characters except underscores and hyphens
        safe_name = ''.join(c for c in safe_name if c.isalnum() or c in '_-')
        return safe_name.lower()
    
    def _should_overwrite_files(self, webp_path: Path, jpg_path: Path, new_img: Image.Image, 
                               overwrite_policy: str, scientific_name: str) -> bool:
        """Determine if files should be overwritten based on policy."""
        webp_exists = webp_path.exists()
        jpg_exists = jpg_path.exists()
        
        if not webp_exists and not jpg_exists:
            return True  # No files exist, safe to save
        
        if overwrite_policy == 'never':
            return False
        elif overwrite_policy == 'always':
            return True
        elif overwrite_policy == 'ask':
            response = input(f"\nFiles exist for {scientific_name}. Overwrite? (y/N/a=always/n=never): ").lower()
            if response == 'a':
                # Update policy for remaining files
                self.overwrite_policy = 'always'
                return True
            elif response == 'n':
                self.overwrite_policy = 'never'
                return False
            return response.startswith('y')
        elif overwrite_policy == 'better':
            return self._is_new_image_better(webp_path, jpg_path, new_img)
        
        return False
    
    def _is_new_image_better(self, webp_path: Path, jpg_path: Path, new_img: Image.Image) -> bool:
        """Check if new image is better quality than existing."""
        try:
            # Use WebP if available, otherwise JPEG
            existing_path = webp_path if webp_path.exists() else jpg_path
            if not existing_path.exists():
                return True
            
            with Image.open(existing_path) as existing_img:
                # Compare dimensions (larger is usually better)
                new_pixels = new_img.size[0] * new_img.size[1]
                existing_pixels = existing_img.size[0] * existing_img.size[1]
                
                # New image is better if it has at least 25% more pixels
                if new_pixels > existing_pixels * 1.25:
                    logger.info(f"New image is larger: {new_img.size} vs {existing_img.size}")
                    return True
                
                # If similar size, check file size (as proxy for quality)
                new_file_size = len(new_img.tobytes())
                existing_file_size = existing_path.stat().st_size
                
                if new_file_size > existing_file_size * 1.1:  # 10% larger file
                    logger.info(f"New image likely higher quality (larger file size)")
                    return True
                
            return False
        except Exception as e:
            logger.warning(f"Error comparing images: {e}")
            return False  # When in doubt, don't overwrite
    
    def fetch_bird_image(self, scientific_name: str, common_name: str = "", overwrite_policy: str = 'never') -> Optional[str]:
        """Main method to fetch and process a bird image."""
        logger.info(f"Fetching image for: {scientific_name} ({common_name})")
        self.download_count += 1
        
        # Search for images
        search_results = self.search_bird_images(scientific_name, common_name)
        if not search_results:
            logger.warning(f"No images found for {scientific_name}")
            return None
        
        # Try each image until we get a good one
        for result in search_results[:3]:  # Try top 3 results
            try:
                image_info = self.get_image_info(result['title'])
                if not image_info:
                    continue
                
                image_url = image_info.get('url')
                if not image_url:
                    continue
                
                # Check if image is suitable
                width = image_info.get('width', 0)
                height = image_info.get('height', 0)
                if width < MIN_IMAGE_SIZE[0] or height < MIN_IMAGE_SIZE[1]:
                    continue
                
                # Check file size (not too large)
                file_size = image_info.get('size', 0)
                if file_size > 50 * 1024 * 1024:  # Skip files larger than 50MB
                    continue
                
                # Download and process
                filename = self.download_and_process_image(scientific_name, image_url, overwrite_policy)
                if filename:
                    return filename
                
                time.sleep(REQUEST_DELAY)
                
            except Exception as e:
                logger.error(f"Error processing {result['title']}: {e}")
                continue
        
        logger.warning(f"Could not download any suitable image for {scientific_name}")
        return None


def load_birds_from_csv() -> List[Dict[str, str]]:
    """Load bird data from the CSV file."""
    birds = []
    
    try:
        with open(BIRDS_CSV_PATH, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                # Skip empty rows and header rows
                if not row.get('scientific name') or row.get('scientific name').startswith('Clements'):
                    continue
                
                # Only process species (not families or other categories)
                if row.get('category') == 'species':
                    birds.append({
                        'scientific_name': row['scientific name'].strip(),
                        'common_name': row.get('English name', '').strip(),
                        'species_code': row.get('species_code', '').strip(),
                        'family': row.get('family', '').strip()
                    })
    
    except Exception as e:
        logger.error(f"Error reading CSV file: {e}")
        return []
    
    logger.info(f"Loaded {len(birds)} bird species from CSV")
    return birds


def load_progress() -> Dict[str, str]:
    """Load download progress from file."""
    if PROGRESS_PATH.exists():
        try:
            with open(PROGRESS_PATH, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load progress file: {e}")
    return {}


def get_progress_stats(progress: Dict[str, str]) -> Dict[str, int]:
    """Calculate progress statistics from the progress dictionary."""
    total_entries = len(progress)
    successful = len([f for f in progress.values() if f])
    failed = len([f for f in progress.values() if not f])
    
    return {
        'total_entries': total_entries,
        'successful': successful,
        'failed': failed,
        'completion_rate': (successful / max(total_entries, 1)) * 100
    }


def save_progress(progress: Dict[str, str]):
    """Save download progress to file."""
    try:
        SCRIPT_DIR.mkdir(parents=True, exist_ok=True)
        with open(PROGRESS_PATH, 'w') as f:
            json.dump(progress, f, indent=2)
    except Exception as e:
        logger.error(f"Could not save progress: {e}")


def create_manifest(progress: Dict[str, str], birds: List[Dict[str, str]]):
    """Create a manifest file with image metadata."""
    manifest = {
        'generated_at': time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime()),
        'total_species': len(birds),
        'downloaded_images': len([f for f in progress.values() if f]),
        'images': {}
    }
    
    for bird in birds:
        scientific_name = bird['scientific_name']
        filename = progress.get(scientific_name)
        
        manifest['images'][scientific_name] = {
            'common_name': bird['common_name'],
            'species_code': bird['species_code'],
            'family': bird['family'],
            'image_file': filename,
            'has_image': bool(filename)
        }
    
    try:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        with open(MANIFEST_PATH, 'w') as f:
            json.dump(manifest, f, indent=2)
        logger.info(f"Created manifest with {manifest['downloaded_images']} images")
    except Exception as e:
        logger.error(f"Could not create manifest: {e}")


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description='Fetch bird images from Wikimedia Commons')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without downloading')
    parser.add_argument('--limit', type=int, help='Limit number of images to download')
    parser.add_argument('--no-resume', action='store_true', help='Start fresh, ignore previous progress (default: resume)')
    parser.add_argument('--species', type=str, help='Download image for specific species (scientific name)')
    parser.add_argument('--overwrite', choices=['never', 'always', 'ask', 'better'], default='better',
                        help='Overwrite policy: better (replace if higher quality, default), never (skip existing), always (overwrite all), ask (prompt)')
    parser.add_argument('--force-redownload', action='store_true', help='Re-download even if marked as processed in progress file')
    
    args = parser.parse_args()
    
    logger.info("Starting bird image fetcher...")
    logger.info(f"Birds CSV: {BIRDS_CSV_PATH}")
    logger.info(f"Output directory: {OUTPUT_DIR}")
    
    # Load bird data
    birds = load_birds_from_csv()
    if not birds:
        logger.error("No bird data found!")
        return 1
    
    # Load previous progress (default behavior, unless --no-resume specified)
    progress = load_progress() if not args.no_resume else {}
    
    # Show overall progress statistics
    if progress:
        stats = get_progress_stats(progress)
        logger.info(f"Overall progress: {stats['successful']}/{stats['total_entries']} species ({stats['completion_rate']:.1f}% complete)")
        logger.info(f"Historical stats: {stats['successful']} successful, {stats['failed']} failed")
    
    # Filter birds if specific species requested
    if args.species:
        birds = [b for b in birds if args.species.lower() in b['scientific_name'].lower()]
        if not birds:
            logger.error(f"Species '{args.species}' not found!")
            return 1
    
    # Apply limit
    if args.limit:
        birds = birds[:args.limit]
    
    if args.dry_run:
        logger.info(f"DRY RUN: Would process {len(birds)} bird species")
        logger.info(f"Resume mode: {'ON (default)' if not args.no_resume else 'OFF'}")
        logger.info(f"Overwrite policy: {args.overwrite} (default: better quality)")
        logger.info(f"Force redownload: {args.force_redownload}")
        logger.info(f"Fully automated: {'YES' if args.overwrite != 'ask' else 'NO (interactive mode)'}")
        
        for bird in birds[:10]:  # Show first 10
            scientific_name = bird['scientific_name']
            # Check progress status
            in_progress = progress.get(scientific_name)
            
            # Check file status
            safe_name = ''.join(c.lower() for c in scientific_name.replace(' ', '_') if c.isalnum() or c in '_-')
            webp_path = OUTPUT_DIR / f"{safe_name}.webp"
            jpg_path = OUTPUT_DIR / f"{safe_name}.jpg"
            
            file_exists = webp_path.exists() or jpg_path.exists()
            
            if file_exists and in_progress:
                status = f"EXISTS+TRACKED (policy: {args.overwrite})"
            elif file_exists:
                status = f"EXISTS (not tracked, policy: {args.overwrite})"
            elif in_progress:
                status = "TRACKED (files missing)"
            else:
                status = "MISSING"
                
            logger.info(f"  {scientific_name} ({bird['common_name']}) - {status}")
        if len(birds) > 10:
            logger.info(f"  ... and {len(birds) - 10} more")
        return 0
    
    # Create fetcher
    fetcher = WikimediaImageFetcher()
    
    logger.info(f"Processing {len(birds)} bird species...")
    
    try:
        for i, bird in enumerate(birds):
            scientific_name = bird['scientific_name']
            common_name = bird['common_name']
            
            # Skip if already downloaded (unless force-redownload is set or no-resume specified)
            if not args.no_resume and scientific_name in progress and not args.force_redownload:
                existing_filename = progress[scientific_name]
                if existing_filename:  # Successfully downloaded before
                    # Check if files actually exist
                    safe_name = fetcher._sanitize_filename(scientific_name)
                    webp_path = OUTPUT_DIR / f"{safe_name}.webp"
                    jpg_path = OUTPUT_DIR / f"{safe_name}.jpg"
                    
                    if webp_path.exists() or jpg_path.exists():
                        logger.info(f"Skipping {scientific_name} (already processed and files exist)")
                        continue
                    else:
                        logger.info(f"Re-downloading {scientific_name} (marked as processed but files missing)")
                else:
                    logger.info(f"Skipping {scientific_name} (previously failed)")
                    continue
            
            # Calculate current position in overall progress
            overall_stats = get_progress_stats(progress)
            logger.info(f"Batch: {i+1}/{len(birds)} | Overall: {overall_stats['successful']}/{overall_stats['total_entries']} ({overall_stats['completion_rate']:.1f}%) - {scientific_name}")
            
            # Fetch image
            filename = fetcher.fetch_bird_image(scientific_name, common_name, args.overwrite)
            progress[scientific_name] = filename or ""
            
            # Save progress periodically
            if (i + 1) % 10 == 0:
                save_progress(progress)
                logger.info(f"Saved progress: {fetcher.success_count} successful, {fetcher.error_count} failed")
            
            # Be nice to Wikimedia
            time.sleep(REQUEST_DELAY)
    
    except KeyboardInterrupt:
        logger.info("Download interrupted by user")
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    
    finally:
        # Save final progress and create manifest
        save_progress(progress)
        create_manifest(progress, birds)
        
        logger.info("=== SUMMARY ===")
        logger.info(f"Session downloads attempted: {fetcher.download_count}")
        logger.info(f"Session successful downloads: {fetcher.success_count}")
        logger.info(f"Session failed downloads: {fetcher.error_count}")
        logger.info(f"Session success rate: {fetcher.success_count/max(fetcher.download_count,1)*100:.1f}%")
        
        # Show overall statistics
        final_stats = get_progress_stats(progress)
        logger.info(f"Overall progress: {final_stats['successful']}/{final_stats['total_entries']} species ({final_stats['completion_rate']:.1f}% complete)")
        logger.info(f"Images saved to: {OUTPUT_DIR}")
        logger.info(f"Manifest created: {MANIFEST_PATH}")
    
    return 0


if __name__ == "__main__":
    exit(main())