#!/bin/bash

# Git History Rewrite Script for Local Repository
# WARNING: This permanently rewrites Git history - there's no going back!

set -e  # Exit on any error

echo "Git History Rewrite Script"
echo "=========================="
echo "WARNING: This will permanently rewrite Git history!"
echo "Make sure you have backups before proceeding."
echo ""

# Check if we're in a Git repository
if [ ! -d ".git" ]; then
    echo "ERROR: Not in a Git repository root directory"
    echo "Please run this script from your project root"
    exit 1
fi

# Create backup
BACKUP_DIR="git-backup-$(date +%Y%m%d-%H%M%S)"
echo "Creating backup at: $BACKUP_DIR"
cp -r .git "$BACKUP_DIR"
echo "Backup created successfully"

# Install git-filter-repo if not available
if ! command -v git-filter-repo &> /dev/null; then
    echo "Installing git-filter-repo..."

    # Try different installation methods
    if command -v pip3 &> /dev/null; then
        pip3 install git-filter-repo
    elif command -v pip &> /dev/null; then
        pip install git-filter-repo
    elif command -v python3 &> /dev/null; then
        python3 -m pip install git-filter-repo
    elif command -v python &> /dev/null; then
        python -m pip install git-filter-repo
    elif command -v apt-get &> /dev/null; then
        echo "Trying to install via apt-get..."
        sudo apt-get update && sudo apt-get install -y git-filter-repo
    elif command -v brew &> /dev/null; then
        echo "Trying to install via homebrew..."
        brew install git-filter-repo
    else
        echo "ERROR: Cannot install git-filter-repo automatically"
        echo "Please install it manually:"
        echo "  Ubuntu/Debian: sudo apt-get install git-filter-repo"
        echo "  macOS: brew install git-filter-repo"
        echo "  Or: curl -O https://raw.githubusercontent.com/newren/git-filter-repo/main/git-filter-repo"
        echo "      chmod +x git-filter-repo"
        echo "      sudo mv git-filter-repo /usr/local/bin/"
        exit 1
    fi
fi

# Show current repository stats
echo ""
echo "Current repository stats:"
echo "Repository size: $(du -sh .git | cut -f1)"
echo "Total commits: $(git rev-list --all --count)"
echo "Current author emails:"
git log --format='%ae' | sort | uniq -c | head -5

echo ""
echo "Starting history rewrite..."

# Step 1: Remove large files (>100MB)
echo "Step 1: Removing large files (>100MB)..."
git rev-list --objects --all | \
git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
awk '/^blob/ {if($3 > 100*1024*1024) print $4}' > large_files.txt

if [ -s large_files.txt ]; then
    echo "Found $(wc -l < large_files.txt) large files to remove:"
    head -5 large_files.txt

    while IFS= read -r file; do
        echo "Removing: $file"
        git filter-repo --path "$file" --invert-paths --force --quiet
    done < large_files.txt

    echo "Large files removed"
else
    echo "No large files found"
fi

# Step 2: Remove .env files
echo "Step 2: Removing .env files..."
if git ls-files | grep -E '\.env(\.|$)' >/dev/null 2>&1; then
    git filter-repo --path-glob '**/.env' --path-glob '**/.env.*' --invert-paths --force --quiet
    echo ".env files removed"
else
    echo "No .env files found"
fi

# Step 3: Remove specific problematic commit
echo "Step 3: Removing problematic commit..."
if git cat-file -e 6dc08e153ae7aa2670a085104a1dbb95dd64254c 2>/dev/null; then
    git filter-repo --commit-callback '
if commit.original_id == b"6dc08e153ae7aa2670a085104a1dbb95dd64254c":
    commit.skip()
' --force --quiet
    echo "Problematic commit removed"
else
    echo "Commit not found (already removed or doesn't exist)"
fi

# Step 4: Fix author attribution
echo "Step 4: Fixing author attribution..."
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
    b"mklemmingen"
]

if commit.author_email in old_emails or commit.author_name in old_names:
    commit.author_name = target_name
    commit.author_email = target_email

if commit.committer_email in old_emails or commit.committer_name in old_names:
    commit.committer_name = target_name
    commit.committer_email = target_email
' --force --quiet

echo "Author attribution fixed"

# Step 5: Clean commit messages
echo "Step 5: Cleaning commit messages..."
claude_commits=$(git log --grep="Claude" --oneline | wc -l)
if [ "$claude_commits" -gt 0 ]; then
    echo "Found $claude_commits commits mentioning Claude"
    git filter-repo --message-callback '
if b"Claude" in message:
    return b"Code update"
return message
' --force --quiet
    echo "Claude mentions cleaned"
else
    echo "No Claude mentions found"
fi

# Step 6: Repository optimization
echo "Step 6: Optimizing repository..."
git reflog expire --expire=now --all 2>/dev/null || true
git gc --aggressive --prune=now --quiet

# Configure Git user for future commits
git config user.email "104225647+mklemmingen@users.noreply.github.com"
git config user.name "mklemmingen"

# Show final stats
echo ""
echo "History rewrite complete!"
echo "========================"
echo "Final repository stats:"
echo "Repository size: $(du -sh .git | cut -f1)"
echo "Total commits: $(git rev-list --all --count)"
echo "All commits now attributed to:"
git log --format='%an <%ae>' | sort | uniq -c

echo ""
echo "Recent commits:"
git log --format='%h %an <%ae> %s' -5

echo ""
echo "SUCCESS: Git history has been permanently rewritten"
echo "Backup available at: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "1. Review the changes above"
echo "2. Push to your remote repository with: git push --force origin main"
echo "3. All team members will need to re-clone the repository"

# Cleanup
rm -f large_files.txt

echo ""
echo "IMPORTANT: This rewrite is permanent and affects all branches."
echo "Anyone with existing clones will need to re-clone after you push."