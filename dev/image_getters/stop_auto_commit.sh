#!/bin/bash
# Stop auto-commit script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTO_COMMIT_SCRIPT="$SCRIPT_DIR/auto_commit_birds.sh"

echo "=== Stop Auto-Commit ==="
echo ""

# Check if cron job exists
if crontab -l 2>/dev/null | grep -q "$AUTO_COMMIT_SCRIPT"; then
    echo "Found auto-commit cron job. Removing..."
    # Remove the cron job
    crontab -l 2>/dev/null | grep -v "$AUTO_COMMIT_SCRIPT" | crontab -
    echo "Auto-commit cron job removed!"
    echo ""
    echo "Current crontab:"
    crontab -l 2>/dev/null || echo "No crontab entries"
else
    echo "No auto-commit cron job found."
    echo ""
    echo "Current crontab:"
    crontab -l 2>/dev/null || echo "No crontab entries"
fi

echo ""
echo "Auto-commit is now disabled."
echo ""
echo "To re-enable, run:"
echo "  ./setup_auto_commit.sh"