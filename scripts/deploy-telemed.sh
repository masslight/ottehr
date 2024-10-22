#!/bin/bash

ENV=$1

# Deploy Telemed EHR
cd packages/telemed-ehr/app
pnpm run build:$ENV
pnpm run deploy:$ENV

cd ../zambdas
pnpm run deploy-zambdas $ENV

# Deploy Telemed Intake
cd ../../telemed-intake/app
pnpm build:$ENV
pnpm run deploy:$ENV

cd ../zambdas
pnpm run deploy-zambdas $ENV