#!/bin/bash
# Status script for bird image fetcher and auto-commit system

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$SCRIPT_DIR/auto_commit.log"
PROGRESS_FILE="$SCRIPT_DIR/download_progress.json"
MANIFEST_FILE="$PROJECT_ROOT/assets/images/birds/bird_images_manifest.json"
FETCHER_LOG="$SCRIPT_DIR/bird_image_fetcher.log"

echo "=== LogChirpy Bird Image System Status ==="
echo ""

# Check if bird fetcher is running
if pgrep -f "bird_image_fetcher.py" > /dev/null; then
    echo "🟢 Bird Image Fetcher: RUNNING"
    echo "   Process: $(pgrep -f bird_image_fetcher.py)"
else
    echo "🔴 Bird Image Fetcher: NOT RUNNING"
fi

# Check auto-commit cron job
if crontab -l 2>/dev/null | grep -q "auto_commit_birds.sh"; then
    echo "🟢 Auto-Commit: ENABLED"
    echo "   Cron job: $(crontab -l | grep auto_commit_birds.sh)"
else
    echo "🔴 Auto-Commit: DISABLED"
fi

echo ""
echo "=== Download Progress ==="

# Check progress file
if [ -f "$PROGRESS_FILE" ]; then
    TOTAL_PROCESSED=$(python3 -c "
import json
try:
    with open('$PROGRESS_FILE', 'r') as f:
        data = json.load(f)
    total = len(data)
    successful = len([v for v in data.values() if v])
    failed = total - successful
    print(f'Processed: {total} | Successful: {successful} | Failed: {failed}')
except:
    print('Error reading progress file')
    ")
    echo "📊 $TOTAL_PROCESSED"
else
    echo "📊 No progress file found"
fi

# Check manifest
if [ -f "$MANIFEST_FILE" ]; then
    MANIFEST_INFO=$(python3 -c "
import json
try:
    with open('$MANIFEST_FILE', 'r') as f:
        data = json.load(f)
    total = data.get('total_species', 0)
    downloaded = data.get('downloaded_images', 0)
    print(f'Total species: {total} | Images downloaded: {downloaded} | Coverage: {downloaded/total*100:.1f}%')
except:
    print('Error reading manifest')
    ")
    echo "📁 $MANIFEST_INFO"
else
    echo "📁 No manifest file found"
fi

echo ""
echo "=== Recent Activity ==="

# Recent auto-commit activity
if [ -f "$LOG_FILE" ]; then
    echo "🔄 Last 5 auto-commit entries:"
    tail -5 "$LOG_FILE" | sed 's/^/   /'
else
    echo "🔄 No auto-commit log found"
fi

echo ""

# Recent git commits
echo "📝 Last 5 git commits:"
git -C "$PROJECT_ROOT" log --oneline -5 | sed 's/^/   /'

echo ""
echo "=== File System Status ==="

# Check disk space
IMAGES_DIR="$PROJECT_ROOT/assets/images/birds"
if [ -d "$IMAGES_DIR" ]; then
    IMAGE_COUNT=$(find "$IMAGES_DIR" -name "*.webp" | wc -l)
    JPEG_COUNT=$(find "$IMAGES_DIR" -name "*.jpg" | wc -l)
    TOTAL_SIZE=$(du -sh "$IMAGES_DIR" 2>/dev/null | cut -f1)
    echo "🖼️  Images: $IMAGE_COUNT WebP, $JPEG_COUNT JPEG (Total: $TOTAL_SIZE)"
else
    echo "🖼️  Images directory not found"
fi

# Check disk space
DISK_USAGE=$(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $4 " available (" $5 " used)"}')
echo "💾 Disk space: $DISK_USAGE"

echo ""
echo "=== Quick Commands ==="
echo "Monitor auto-commit:  tail -f $LOG_FILE"
echo "Monitor bird fetcher: tail -f $FETCHER_LOG"
echo "Test auto-commit:     ./run_auto_commit_now.sh"
echo "Setup auto-commit:    ./setup_auto_commit.sh"
echo "Stop auto-commit:     ./stop_auto_commit.sh"
echo "Start bird fetcher:   python bird_image_fetcher.py --limit 10"