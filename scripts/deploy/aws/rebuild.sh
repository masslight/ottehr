#!/bin/bash

set -eo pipefail

environment=$(grep '"environment"' "$(dirname "$0")/../deploy-config.json" | sed 's/.*: "\(.*\)".*/\1/')
ENV=$environment

npm install

pushd packages/zambdas
ENV=$environment npm run deploy-zambdas $environment
ENV=$environment npm run setup-deployed-resources $environment
ENV=$environment npm run setup-secrets $environment
popd

pushd apps/intake
npm run build:env --env=$environment
popd

pushd apps/ehr
npm run build:env --env=$environment
popd
