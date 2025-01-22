#!/usr/bin/env bash

# CI/CD build script
# Must be run from project root.

# Fail on error
set -e

# Echo commands
set -x

# Diagnostics
node --version
npm --version

# Install
[ ! -d "node_modules" ] && npm ci

# Lint intake
npm run intake:lint

# Build intake
npm run intake:build