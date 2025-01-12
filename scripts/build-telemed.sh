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

# Build the EHR project
echo "Building package: EHR zambdas"
pushd "packages/telemed-ehr/zambdas"
pnpm build
popd

echo "Building package: EHR app"
pushd "packages/telemed-ehr/app"
pnpm build
popd

# Build the Intake project
echo "Building package: Intake zambdas"
pushd "packages/telemed-intake/zambdas"
pnpm build
popd

echo "Building package: Intake app"
pushd "packages/telemed-intake/app"
pnpm build
popd

# Lint the project
echo "Linting the project..."
pnpm lint

echo "Build script finished successfully."
