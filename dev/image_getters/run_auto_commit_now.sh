#!/bin/bash
# Manual trigger for auto-commit (for testing)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTO_COMMIT_SCRIPT="$SCRIPT_DIR/auto_commit_birds.sh"

echo "=== Manual Auto-Commit Trigger ==="
echo "Running auto-commit script manually..."
echo ""

if [ -x "$AUTO_COMMIT_SCRIPT" ]; then
    "$AUTO_COMMIT_SCRIPT"
    echo ""
    echo "Script completed. Check the log for details:"
    echo "  tail $SCRIPT_DIR/auto_commit.log"
else
    echo "ERROR: Auto-commit script not found or not executable: $AUTO_COMMIT_SCRIPT"
    exit 1
fi