project_id=$(grep '"project_id"' "$(dirname "$0")/../deploy-config.json" | sed 's/.*: "\(.*\)".*/\1/')
access_token=$(grep '"access_token"' "$(dirname "$0")/../deploy-config.json" | sed 's/.*: "\(.*\)".*/\1/')
provider_email=$(grep '"provider_email"' "$(dirname "$0")/../deploy-config.json" | sed 's/.*: "\(.*\)".*/\1/')
environment=$(grep '"environment"' "$(dirname "$0")/../deploy-config.json" | sed 's/.*: "\(.*\)".*/\1/')
ENV=$environment

if [ -f "apps/intake/env/.env.$environment" ]; then
    first_setup=false
else
    first_setup=true
fi

echo $first_setup

if $first_setup; then
    sh scripts/ottehr-setup.sh $project_id $access_token $provider_email $environment
else
    npm install
fi

pushd packages/zambdas
ENV=$environment npm run deploy-zambdas $environment
ENV=$environment npm run setup-zapehr-secrets $environment
ENV=$environment npm run setup-deployed-resources $environment
popd

pushd apps/intake
npm run build:env --env=$environment
popd

pushd apps/ehr
npm run build:env --env=$environment
popd

# first cdk deploy creates cloudformation distributions
pushd scripts/deploy/aws
if $first_setup; then
    npx cdk bootstrap
    npx cdk deploy
fi
popd

# second cdk deploy updates env files
pushd apps/intake
npm run build:env --env=$environment
popd
pushd apps/ehr
npm run build:env --env=$environment
popd
pushd scripts/deploy/aws
npx cdk deploy
popd

# third cdk deploy deploys updated code with updated env vars
pushd apps/intake
npm run build:env --env=$environment
popd
pushd apps/ehr
npm run build:env --env=$environment
popd
pushd scripts/deploy/aws
npx cdk deploy
popd
