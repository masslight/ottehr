#!/bin/bash
echo "Full project cleanup..."

# Node.js cache
echo "Clean npm cache..."
npm cache clean --force

echo "Remove node_modules..."
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
rm -rf packages/*/*/node_modules

# Turbo cache
echo "Clean turbo cache..."
npx turbo clean
rm -rf .turbo/
rm -rf apps/*/.turbo/
rm -rf packages/*/.turbo/

# Playwright cache
echo "Clean playwright cache..."
rm -rf ~/.cache/ms-playwright/

# Build cache
echo "Clean build cache..."
rm -rf dist/
rm -rf build/
rm -rf .dist/
rm -rf .vite/
rm -rf apps/*/dist/
rm -rf apps/*/build/
rm -rf apps/*/.vite/
rm -rf packages/*/dist/
rm -rf packages/*/.vite/

# TypeScript cache
echo "Clean TypeScript cache..."
rm -rf .tsbuildinfo
rm -rf apps/*/.tsbuildinfo
rm -rf packages/*/.tsbuildinfo

# Test cache
echo "Clean test cache..."
rm -rf coverage/
rm -rf apps/*/coverage/
rm -rf packages/*/coverage/

# Vitest cache
echo "Clean Vitest cache..."
rm -rf apps/*/node_modules/.vitest/
rm -rf packages/*/node_modules/.vitest/

# ESLint cache
echo "Clean ESLint cache..."
rm -rf .eslintcache
rm -rf apps/*/.eslintcache
rm -rf packages/*/.eslintcache

# Prettier cache
echo "Clean Prettier cache..."
# cSpell:disable-next prettier cache
rm -rf .prettiercache

echo "Cleanup completed"

echo "Reinstall dependencies..."
npm install

echo "Reinstall Playwright browsers..."
npx playwright install chromium

echo "Done! All caches cleaned and dependencies reinstalled."