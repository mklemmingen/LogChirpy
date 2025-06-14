#!/bin/bash

# Safe Git History Rewrite Script for Manjaro Linux
# This script commits your current work, clones fresh, processes, and pushes to GitHub

set -e

echo "Safe Git History Rewrite Script"
echo "==============================="
echo "This script will:"
echo "1. Commit and push your current changes to GitLab"
echo "2. Clone a fresh copy to a temporary directory"
echo "3. Process the history in the temporary copy"
echo "4. Push the cleaned history to GitHub"
echo "5. Leave your current working directory unchanged"
echo ""

# Configuration
GITLAB_REPO="https://gitlab.reutlingen-university.de/lauterba/moco_sose25_logchirpy.git"
GITHUB_REPO="https://github.com/mklemmingen/LogChirpy.git"

# Check if GitHub token is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo "GitHub token not found in environment variable."
    echo "Please enter your GitHub personal access token:"
    read -s GITHUB_TOKEN
    echo "Token received"

    if [ -z "$GITHUB_TOKEN" ]; then
        echo "ERROR: No token provided"
        exit 1
    fi
fi

TEMP_DIR="temp-git-cleanup-$(date +%Y%m%d-%H%M%S)"

# Check if we're in a Git repository
if [ ! -d ".git" ]; then
    echo "ERROR: Not in a Git repository root directory"
    exit 1
fi

# Install git-filter-repo if not available
if ! command -v git-filter-repo &> /dev/null; then
    echo "Installing git-filter-repo..."

    if command -v yay &> /dev/null; then
        echo "Installing via yay..."
        yay -S git-filter-repo --noconfirm
    elif command -v pamac &> /dev/null; then
        echo "Installing via pamac..."
        pamac install git-filter-repo --no-confirm
    elif command -v pacman &> /dev/null; then
        echo "Installing via pacman..."
        sudo pacman -S git-filter-repo --noconfirm
    elif command -v pip3 &> /dev/null; then
        pip3 install git-filter-repo
    else
        echo "Please install git-filter-repo first:"
        echo "sudo pacman -S git-filter-repo"
        exit 1
    fi
fi

echo "Step 1: Saving current work to GitLab"
echo "======================================"

# Check if there are any changes to commit
if ! git diff-index --quiet HEAD --; then
    echo "Found uncommitted changes, creating commit..."
    git add .
    git commit -m "WIP: Auto-commit before history cleanup"
    echo "Changes committed"
else
    echo "No uncommitted changes found"
fi

# Push current state to GitLab
echo "Pushing current state to GitLab..."
git push origin main
echo "Current work saved to GitLab"

echo ""
echo "Step 2: Setting up temporary directory"
echo "====================================="

mkdir "$TEMP_DIR"
cd "$TEMP_DIR"
echo "Working in temporary directory: $(pwd)"

echo ""
echo "Step 3: Cloning fresh copy from GitLab"
echo "======================================"

git clone "$GITLAB_REPO" repo
cd repo

echo "Initial repository stats:"
echo "Repository size: $(du -sh .git | cut -f1)"
echo "Total commits: $(git rev-list --all --count)"

echo ""
echo "Step 4: Processing Git history"
echo "=============================="

# Remove large files
echo "Step 4.1: Removing large files (>50MB for GitHub compatibility)..."
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | awk '/^blob/ {if($3 > 50*1024*1024) print $4}' > large_files.txt

if [ -s large_files.txt ]; then
    echo "Found $(wc -l < large_files.txt) large files to remove:"
    cat large_files.txt
    echo ""
    echo "Removing each file from history..."

    while IFS= read -r file; do
        echo "Removing: $file"
        git filter-repo --path "$file" --invert-paths --force
    done < large_files.txt

    echo "Large files removed - checking for any remaining..."

    # Double-check for remaining large files
    git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | awk '/^blob/ {if($3 > 50*1024*1024) print "WARNING: Still exists: " $4 " (" $3/1024/1024 "MB)"}'

    echo "Large files removal completed"
else
    echo "No large files found"
fi

# Additional cleanup for specific problematic files mentioned in the error
echo "Step 4.1b: Removing specific problematic files..."
problem_patterns=(
    "**/BirdNET_v2.4_keras/meta-model.h5"
    "**/variables.data-00000-of-00001"
    "**/*documentationAndConversionScripts*"
    "**/*model*conversion*"
    "**/*.h5"
    "**/*.data-*-of-*"
)

for pattern in "${problem_patterns[@]}"; do
    echo "Checking for pattern: $pattern"
    if git ls-files | grep -E "${pattern//\*\*/.*}" >/dev/null 2>&1; then
        echo "Found and removing: $pattern"
        git filter-repo --path-glob "$pattern" --invert-paths --force
    fi
done

# Remove security files and scripts
echo "Step 4.2: Removing security files and cleanup scripts..."

# Remove cleanup scripts
if git ls-files | grep -E 'clean\.sh$' >/dev/null 2>&1; then
    git filter-repo --path-glob '**/clean.sh' --invert-paths --force --quiet
    echo "Cleanup scripts removed"
fi

# Remove .env files
if git ls-files | grep -E '\.env' >/dev/null 2>&1; then
    git filter-repo --path-glob '**/.env*' --invert-paths --force --quiet
    echo ".env files removed"
fi

# Remove config files
for pattern in "config.json" "secrets.json" "credentials.json" ".npmrc"; do
    if git ls-files | grep -E "$pattern" >/dev/null 2>&1; then
        git filter-repo --path-glob "**/$pattern" --invert-paths --force --quiet
        echo "Removed $pattern files"
    fi
done

# Remove backup files
for ext in "bak" "backup" "old" "tmp" "log"; do
    if git ls-files | grep -E "\.$ext$" >/dev/null 2>&1; then
        git filter-repo --path-glob "**/*.$ext" --invert-paths --force --quiet
        echo "Removed .$ext files"
    fi
done

echo "Security cleanup completed"

# Remove problematic commit
echo "Step 4.3: Removing problematic commit..."
if git cat-file -e 6dc08e153ae7aa2670a085104a1dbb95dd64254c 2>/dev/null; then
    git filter-repo --commit-callback 'if commit.original_id == b"6dc08e153ae7aa2670a085104a1dbb95dd64254c": commit.skip()' --force --quiet
    echo "Problematic commit removed"
else
    echo "Commit not found"
fi

# Fix author attribution
echo "Step 4.4: Fixing author attribution..."
git filter-repo --commit-callback '
target_email = b"104225647+mklemmingen@users.noreply.github.com"
target_name = b"mklemmingen"

old_emails = [
    b"martin.lauterbach@student.reutlingen-university.de",
    b"mklemmingen@users.noreply.github.com",
    b"mklemmingen",
    b"LauterbachMK@protonmail,com",
    b"lauterbachmk@protonmail,com"
]

old_names = [
    b"Martin Lauterbach",
    b"martin.lauterbach",
    b"mklemmingen",
    b"Marty",
    b"Marty Lauterbach",
    b"Martin"
]

if commit.author_email in old_emails or commit.author_name in old_names:
    commit.author_name = target_name
    commit.author_email = target_email

if commit.committer_email in old_emails or commit.committer_name in old_names:
    commit.committer_name = target_name
    commit.committer_email = target_email
' --force --quiet

echo "Author attribution fixed"

# Clean commit messages
echo "Step 4.5: Cleaning commit messages..."
claude_commits=$(git log --grep="Claude" --oneline | wc -l)
if [ "$claude_commits" -gt 0 ]; then
    echo "Found $claude_commits commits mentioning Claude"
    git filter-repo --message-callback 'if b"Claude" in message: return b"Code update"
return message' --force --quiet
    echo "Claude mentions cleaned"
else
    echo "No Claude mentions found"
fi

# Repository optimization
echo "Step 4.6: Optimizing repository..."
git reflog expire --expire=now --all 2>/dev/null || true
git gc --aggressive --prune=now --quiet

# Configure Git user
git config user.email "104225647+mklemmingen@users.noreply.github.com"
git config user.name "mklemmingen"

echo ""
echo "Step 5: Pushing to GitHub"
echo "========================="

git remote remove origin 2>/dev/null || true
git remote add github "https://x-access-token:${GITHUB_TOKEN}@${GITHUB_REPO#https://}"

git checkout main 2>/dev/null || git checkout -b main

echo "Pushing cleaned history to GitHub..."
git push --force github main

echo ""
echo "Step 6: Final Results"
echo "===================="

echo "Final repository stats:"
echo "Repository size: $(du -sh .git | cut -f1)"
echo "Total commits: $(git rev-list --all --count)"
echo "All commits now attributed to:"
git log --format='%an <%ae>' | sort | uniq -c

echo ""
echo "Recent commits:"
git log --format='%h %an <%ae> %s' -5

echo ""
echo "SUCCESS: Git history rewritten and pushed to GitHub!"
echo "GitHub repository: $GITHUB_REPO"

# Cleanup
cd ../..
rm -rf "$TEMP_DIR"
echo "Temporary directory cleaned up"

echo ""
echo "IMPORTANT NOTES:"
echo "- Your current working directory is unchanged"
echo "- The cleaned repository is now on GitHub"
echo "- Your GitLab repository still contains the original history"
echo "- Team members can now clone from GitHub for the clean history"