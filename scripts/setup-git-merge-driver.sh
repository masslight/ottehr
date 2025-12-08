#!/bin/bash

# Script to set up git merge driver for package.json and package-lock.json
# Automatically resolves version conflicts by selecting the greater version

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MERGE_DRIVER_SCRIPT="$REPO_ROOT/scripts/git-merge-driver-package-version.js"

echo "Setting up git merge driver for package.json and package-lock.json..."

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

echo "✓ Git merge driver configured for repository"
echo ""
echo "Verifying configuration:"
git config --get merge.package-version.driver
echo ""
echo "Done! Version conflicts in package.json and package-lock.json will now be resolved automatically."

