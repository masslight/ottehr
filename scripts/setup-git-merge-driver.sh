#!/bin/bash

# Script to set up git merge drivers:
# - package-version: resolves version conflicts in package.json/package-lock.json
# - ours: keeps downstream version of seed data files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MERGE_DRIVER_SCRIPT="$REPO_ROOT/scripts/git-merge-driver-package-version.js"

echo "Setting up git merge drivers..."

# Check that the merge driver script exists
if [ ! -f "$MERGE_DRIVER_SCRIPT" ]; then
    echo "Error: file $MERGE_DRIVER_SCRIPT not found"
    exit 1
fi

# Make the script executable
chmod +x "$MERGE_DRIVER_SCRIPT"

# Configure git config for the current repository
# Use absolute path to the script for reliability
git config merge.package-version.driver "node $MERGE_DRIVER_SCRIPT %O %A %B"

# Configure "ours" merge driver for seed data (keeps downstream version)
git config merge.ours.driver true

echo "✓ Git merge drivers configured for repository"
echo ""
echo "Verifying configuration:"
echo "  package-version driver:"
git config --get merge.package-version.driver
echo "  ours driver:"
git config --get merge.ours.driver
echo ""
echo "Done! Merge drivers are now active for:"
echo "  - package.json / package-lock.json (auto-resolve version conflicts)"
echo "  - seed data files (keep downstream version)"
echo "  - config/ directory (keep current branch version)"

