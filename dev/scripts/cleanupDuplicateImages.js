#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to identify and move duplicate bird images (JPG versions when WebP exists)
 * 
 * Logic:
 * 1. Scan assets/images/birds/ for all files
 * 2. Group by base name (without extension)  
 * 3. If both .webp and .jpg exist for same bird, move .jpg to dev/birdJPGS/
 * 4. Report statistics
 */

const BIRDS_DIR = path.join(__dirname, '../../assets/images/birds');
const BACKUP_DIR = path.join(__dirname, '../../dev/birdJPGS');

async function cleanupDuplicateImages() {
  console.log('🔍 Starting duplicate image cleanup...');
  
  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
  }

  // Read all files in birds directory
  const files = fs.readdirSync(BIRDS_DIR);
  console.log(`📊 Found ${files.length} total files in birds directory`);

  // Group files by base name (without extension)
  const fileGroups = {};
  
  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    const basename = path.basename(file, ext);
    
    if (!fileGroups[basename]) {
      fileGroups[basename] = {};
    }
    
    fileGroups[basename][ext] = file;
  });

  console.log(`🏷️  Found ${Object.keys(fileGroups).length} unique bird names`);

  // Find duplicates (birds with both .webp and .jpg)
  let duplicatesFound = 0;
  let jpgsMoved = 0;
  let totalSizeSaved = 0;

  for (const [basename, extensions] of Object.entries(fileGroups)) {
    const hasWebp = extensions['.webp'];
    const hasJpg = extensions['.jpg'] || extensions['.jpeg'];

    if (hasWebp && hasJpg) {
      duplicatesFound++;
      
      // Move JPG to backup directory
      const jpgFile = hasJpg;
      const sourcePath = path.join(BIRDS_DIR, jpgFile);
      const destPath = path.join(BACKUP_DIR, jpgFile);
      
      try {
        // Get file size before moving
        const stats = fs.statSync(sourcePath);
        const fileSizeKB = Math.round(stats.size / 1024);
        
        // Move the file
        fs.renameSync(sourcePath, destPath);
        
        jpgsMoved++;
        totalSizeSaved += stats.size;
        
        console.log(`📦 Moved: ${jpgFile} (${fileSizeKB}KB) -> dev/birdJPGS/`);
        
      } catch (error) {
        console.error(`❌ Error moving ${jpgFile}:`, error.message);
      }
    }
  }

  // Generate summary report
  console.log('\n📈 CLEANUP SUMMARY:');
  console.log('=====================================');
  console.log(`🔍 Total files scanned: ${files.length}`);
  console.log(`🏷️  Unique bird names: ${Object.keys(fileGroups).length}`);
  console.log(`🔄 Duplicates found: ${duplicatesFound}`);
  console.log(`📦 JPG files moved: ${jpgsMoved}`);
  console.log(`💾 Total size saved: ${Math.round(totalSizeSaved / 1024 / 1024)}MB`);
  
  // Calculate remaining files
  const remainingFiles = fs.readdirSync(BIRDS_DIR);
  console.log(`📁 Remaining files in assets/images/birds/: ${remainingFiles.length}`);
  
  // Show format breakdown of remaining files
  const formatCounts = {};
  remainingFiles.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    formatCounts[ext] = (formatCounts[ext] || 0) + 1;
  });
  
  console.log('\n📊 REMAINING FILE FORMATS:');
  Object.entries(formatCounts).forEach(([ext, count]) => {
    console.log(`${ext}: ${count} files`);
  });

  // Generate regeneration notice
  console.log('\n⚠️  IMPORTANT NOTES:');
  console.log('- You need to regenerate BirdImageMap.ts after this cleanup');
  console.log('- Run: npm run generate:bird-images');
  console.log('- JPG backups are stored in dev/birdJPGS/ if needed');
  
  console.log('\n✅ Cleanup completed successfully!');
}

// Run the cleanup
if (require.main === module) {
  cleanupDuplicateImages().catch(console.error);
}

module.exports = { cleanupDuplicateImages };