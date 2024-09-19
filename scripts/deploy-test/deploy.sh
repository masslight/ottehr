project_id=$(jq -r '.project_id' config.json)
access_token=$(jq -r '.access_token' config.json)
provider_email=$(jq -r '.provider_email' config.json)
environment=$(jq -r '.environment' config.json)
ENV=$environment

npm install
cd ../../
sh scripts/ottehr-setup.sh $project_id $access_token $provider_email

cd packages/telemed-intake/zambdas
pnpm run deploy-zambdas $environment
pnpm run setup-zapehr-secrets $environment
cd ../app
pnpm run build:$environment

cd ../../../

cd packages/telemed-ehr/zambdas
pnpm run deploy-zambdas $environment
pnpm run setup-zapehr-secrets $environment
cd ../app
pnpm run build:$environment

cd ../../../scripts/deploy-test
cdk bootstrap
cdk deploy

cd ../../packages/telemed-intake/app
pnpm run build:$environment
cd ../../../packages/telemed-ehr/app
pnpm run build:$environment
cd ../../../scripts/deploy-test
cdk deploy
