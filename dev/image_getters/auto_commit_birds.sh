#!/bin/bash
# Auto-commit script for bird images
# Runs every minute to commit and push new bird images

# Configuration
PROJECT_ROOT="/home/mklemmingen/WebstormProjects/moco_sose25_logchirpy"
ASSETS_PATH="assets/images/birds"
LOG_FILE="$PROJECT_ROOT/dev/image_getters/auto_commit.log"
MAX_LOG_SIZE=10485760  # 10MB

# Function to log with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to rotate log file if it gets too large
rotate_log() {
    if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null) -gt $MAX_LOG_SIZE ]; then
        mv "$LOG_FILE" "${LOG_FILE}.old"
        log_message "Log rotated due to size limit"
    fi
}

# Change to project directory
cd "$PROJECT_ROOT" || {
    log_message "ERROR: Cannot change to project directory: $PROJECT_ROOT"
    exit 1
}

# Rotate log if needed
rotate_log

log_message "Starting auto-commit check..."

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_message "ERROR: Not in a git repository"
    exit 1
fi

# Add all changes in assets directory
log_message "Adding changes in $ASSETS_PATH..."
git add "$ASSETS_PATH"

# Check if there are staged changes
if git diff --cached --quiet; then
    log_message "No staged changes after git add"
    exit 0
fi

# Get count of new/modified files
NEW_FILES=$(git diff --cached --name-only | grep "^$ASSETS_PATH" | wc -l)
NEW_IMAGES=$(git diff --cached --name-only | grep -E '\.(webp|jpg|jpeg|png)$' | wc -l)

log_message "Found $NEW_FILES new/modified files ($NEW_IMAGES images)"

# Create commit message
COMMIT_MSG="new birds dropped

- Added $NEW_IMAGES new bird images
- Total files updated: $NEW_FILES
- Auto-committed by bird image sync

🤖 Generated with LogChirpy Bird Image Fetcher
$(date '+%Y-%m-%d %H:%M:%S')"

# Commit the changes
log_message "Committing changes..."
if git commit -m "$COMMIT_MSG"; then
    log_message "Commit successful"
    
    # Push to remote
    log_message "Pushing to remote..."
    if git push; then
        log_message "Push successful - $NEW_IMAGES bird images synced!"
    else
        log_message "ERROR: Push failed"
        exit 1
    fi
else
    log_message "ERROR: Commit failed"
    exit 1
fi

log_message "Auto-commit completed successfully"