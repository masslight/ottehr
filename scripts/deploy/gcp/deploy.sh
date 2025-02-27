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

pwd
cd ./scripts/deploy
npx ts-node ./gcp/deploy.ts
cd ../..

cd packages/intake/zambdas
ENV=$environment npm run deploy-zambdas $environment
ENV=$environment npm run setup-zapehr-secrets $environment

cd ../../../apps/intake
npm run build:env --env=$environment

cd ../../packages/ehr/zambdas
ENV=$environment npm run deploy-zambdas $environment
ENV=$environment npm run setup-zapehr-secrets $environment
ENV=$environment npm run setup-deployed-resources $environment

cd ../../../apps/ehr
npm run build:env --env=$environment

cd ../../scripts/deploy/gcp
terraform init
terraform apply

