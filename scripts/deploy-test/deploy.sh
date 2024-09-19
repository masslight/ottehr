project_id=$(jq -r '.project_id' config.json)
access_token=$(jq -r '.access_token' config.json)
provider_email=$(jq -r '.provider_email' config.json)
environment=$(jq -r '.environment' config.json)
ENV=$environment


if [ -f "../../packages/telemed-intake/app/env/.env.development" ]; then
    first_setup=false
else
    first_setup=true
fi

echo $first_setup

npm install
cd ../../

if $first_setup; then
    sh scripts/ottehr-setup.sh $project_id $access_token $provider_email $environment
fi

cd packages/telemed-intake/zambdas
ENV=$environment pnpm run deploy-zambdas $environment
ENV=$environment pnpm run setup-zapehr-secrets $environment
cd ../app
pnpm run build:$environment

cd ../../../

cd packages/telemed-ehr/zambdas
ENV=$environment pnpm run deploy-zambdas $environment
ENV=$environment pnpm run setup-zapehr-secrets $environment
cd ../app
pnpm run build:$environment

cd ../../../scripts/deploy-test
if $first_setup; then
    cdk bootstrap
    cdk deploy
fi

cd ../../packages/telemed-intake/app
pnpm run build:$environment
cd ../../../packages/telemed-ehr/app
pnpm run build:$environment
cd ../../../scripts/deploy-test
cdk deploy
