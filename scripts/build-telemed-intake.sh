#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

# Print each command to stdout before executing it.
set -x

# Ensure the script is run from the root of the workspace
if [ ! -f ./pnpm-workspace.yaml ]; then
  echo "Error: This script must be run from the root of the workspace"
  exit 1
fi

# Print versions for diagnostics
echo "Node version: $(node --version)"
echo "pnpm version: $(pnpm --version)"

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Build the telemed-intake/app
echo "Building package: telemed-intake/app"
cd "packages/telemed-intake/app"
pnpm build
cd ../../../

# Build the telemed-intake/zambdas
echo "Building package: telemed-intake/zambdas"
cd "packages/telemed-intake/zambdas"
pnpm build
cd ../../../

# Lint the project
echo "Linting the project..."
pnpm lint

echo "Build script finished successfully."