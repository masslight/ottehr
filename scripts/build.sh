#!/usr/bin/env bash

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

# Build the EHR/front-end
echo "Building package: ehr/front-end"
pushd "packages/ehr/front-end"
pnpm build
popd

# Build the EHR/zambdas
echo "Building package: ehr/zambdas"
pushd "packages/ehr/zambdas"
pnpm build
popd

# Build the urgent-care/app
echo "Building package: urgent-care/app"
pushd "packages/urgent-care-intake/app"
pnpm build
popd

# Build the urgent-care/zambdas
echo "Building package: urgent-care/zambdas"
pushd "packages/urgent-care-intake/zambdas"
pnpm build
popd

# Lint the project
echo "Linting the project..."
pnpm lint

echo "Build script finished successfully."
