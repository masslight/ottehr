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

# Lint EHR
npm run ehr:lint

# Build EHR
npm run ehr:build
