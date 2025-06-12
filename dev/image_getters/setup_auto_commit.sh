#!/bin/bash
# Setup script for automatic bird image commits

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTO_COMMIT_SCRIPT="$SCRIPT_DIR/auto_commit_birds.sh"

echo "=== LogChirpy Auto-Commit Setup ==="
echo ""

# Check if auto_commit_birds.sh exists and is executable
if [ ! -x "$AUTO_COMMIT_SCRIPT" ]; then
    echo "ERROR: Auto-commit script not found or not executable: $AUTO_COMMIT_SCRIPT"
    echo "Please ensure the script exists and run: chmod +x $AUTO_COMMIT_SCRIPT"
    exit 1
fi

echo "Auto-commit script found: $AUTO_COMMIT_SCRIPT"
echo ""

# Show current crontab
echo "Current crontab entries:"
crontab -l 2>/dev/null || echo "No crontab entries found"
echo ""

# Create crontab entry
CRON_ENTRY="* * * * * $AUTO_COMMIT_SCRIPT"

# Check if entry already exists
if crontab -l 2>/dev/null | grep -q "$AUTO_COMMIT_SCRIPT"; then
    echo "Auto-commit cron job already exists!"
    echo ""
    echo "Existing entry:"
    crontab -l | grep "$AUTO_COMMIT_SCRIPT"
    echo ""
    read -p "Do you want to replace it? (y/N): " replace
    if [[ $replace =~ ^[Yy]$ ]]; then
        # Remove existing entry and add new one
        (crontab -l 2>/dev/null | grep -v "$AUTO_COMMIT_SCRIPT"; echo "$CRON_ENTRY") | crontab -
        echo "Cron job updated!"
    else
        echo "Keeping existing cron job"
    fi
else
    # Add new entry
    echo "Adding auto-commit cron job..."
    (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
    echo "Cron job added!"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "The auto-commit script will now run every minute and:"
echo "  ✅ Check for new files in /assets directory"
echo "  ✅ Add, commit, and push new bird images automatically"
echo "  ✅ Log all activity to: $SCRIPT_DIR/auto_commit.log"
echo ""
echo "Current crontab:"
crontab -l | grep "$AUTO_COMMIT_SCRIPT"
echo ""
echo "To monitor activity:"
echo "  tail -f $SCRIPT_DIR/auto_commit.log"
echo ""
echo "To disable auto-commit:"
echo "  crontab -e  (then remove the line containing $AUTO_COMMIT_SCRIPT)"
echo ""
echo "To test the script manually:"
echo "  $AUTO_COMMIT_SCRIPT"