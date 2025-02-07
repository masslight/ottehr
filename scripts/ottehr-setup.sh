#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -eo pipefail

# Initialize an empty string for error messages
errors=""

# Check if node is installed
if ! command -v node &> /dev/null; then
  errors+="Error: Node is not installed. Please install Node.js before running this script.\n"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  errors+="Error: npm is not installed. Please install npm before running this script.\n"
fi

# Check Node.js version (18+)
node_version=$(node -v | cut -d'v' -f2)
node_major_version=$(echo $node_version | cut -d'.' -f1)
if [ $node_major_version -lt 18 ]; then
  errors+="Error: Node.js version must be 18 or higher. Current version: $node_version\n"
fi

# Check npm version (9+)
npm_version=$(npm -v)
npm_major_version=$(echo $npm_version | cut -d'.' -f1)
if [ $npm_major_version -lt 9 ]; then
  errors+="Error: npm version must be 9 or higher. Current version: $npm_version\n"
fi

# If there were any errors, print them and exit
if [ -n "$errors" ]; then
  echo -e $errors
  exit 1
fi

# Print versions for diagnostics
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"

# Function to display progress message
function display_progress() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Display progress messages
display_progress "Starting setup script"
display_progress "Installing dependencies..."
npm install
display_progress "Dependencies installed"

# Execute ./setup.ts
display_progress "Executing ./ottehr-setup.ts..."
npx tsx ./scripts/ottehr-setup.ts "$@"

if [ "$#" -eq 2 ]; then
  # Display progress messages
  display_progress "Starting the app/zambdas locally..."
  pnpm apps:start
fi

display_progress "Setup script completed"

# if no command line arguments are provided, npm run apps:start
if [ "$#" -eq 0 ]; then
  display_progress "Starting the apps locally..."
  npm run apps:start
fi