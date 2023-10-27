#!/usr/bin/env bash

# CI/CD build script
# Must be run from project root.

# Fail on error
set -e

# Echo commands
set -x

# Diagnostics
node --version
pnpm --version

# Install
pnpm install

# Build Ottehr
BUILD_ORDER=("zambdas" "app")
for PACKAGE in ${BUILD_ORDER[@]}; do
  pushd "packages/$PACKAGE"
  pnpm build
  popd
done

# Lint
pnpm lint
