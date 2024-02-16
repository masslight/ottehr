#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Initialize an empty string for error messages
errors=""

# Check if script is being run from root directory
if [ ! -f ./pnpm-workspace.yaml ]; then
  errors+="Error: This script must be run from the root of the workspace\n"
fi

# Check if node is installed
if ! command -v node &> /dev/null; then
  errors+="Error: Node is not installed. Please install Node.js before running this script.\n"
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
  errors+="Error: pnpm is not installed. Please install pnpm before running this script.\n"
fi

# If there were any errors, print them and exit
if [ -n "$errors" ]; then
  echo -e $errors
  exit 1
fi

# Print versions for diagnostics
echo "Node version: $(node --version)"
echo "pnpm version: $(pnpm --version)"

# Function to display progress message
function display_progress() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Display progress messages
display_progress "Starting setup script"
display_progress "Installing dependencies..."
pnpm install
display_progress "Dependencies installed"

# Execute ./setup.ts with ts-node
display_progress "Executing ./ottehr-telemed/zambdas/scripts/setup.ts with ts-node..."
pnpx ts-node ./packages/ottehr-telemed/zambdas/scripts/setup.ts

# Display progress messages
display_progress "Starting the app/zambdas locally..."
pnpm --filter 'ottehr-telemed-*' start
display_progress "Setup script completed"