#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -eo pipefail

# Initialize an empty string for error messages
errors=""

# Default environment
environment="local"

# Parse arguments
skip_prompts=""
for arg in "$@"; do
  if [[ "$arg" == "--skip-prompts" ]]; then
    skip_prompts="--skip-prompts"
    echo "Running in skip prompts mode. Will use existing values from environment files for user prompts."
  elif [[ "$arg" == "--environment" ]]; then
    # Next argument is the environment value
    read_env=true
  elif [[ "$read_env" == true ]]; then
    environment="$arg"
    read_env=false
    echo "Using environment: $environment"
  fi
done

# Check if node is installed
if ! command -v node &> /dev/null; then
  errors+="Error: Node is not installed. Please install Node.js before running this script.\n"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  errors+="Error: npm is not installed. Please install npm before running this script.\n"
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

# Execute ./create-test-env.ts
display_progress "Executing ./e2e-test-setup.ts..."
npx tsx ./scripts/e2e-test-setup.ts $skip_prompts --environment $environment