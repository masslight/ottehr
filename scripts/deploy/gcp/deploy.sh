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
pushd ./scripts/deploy
# deploy dir has its own npm module
npm install
npx ts-node ./gcp/deploy.ts
popd

pushd packages/zambdas
ENV=$environment npm run deploy-zambdas $environment
ENV=$environment npm run setup-secrets $environment
ENV=$environment npm run setup-deployed-resources $environment
popd

pushd apps/intake
npm run build:env --env=$environment
popd

pushd apps/ehr
npm run build:env --env=$environment
popd

pushd scripts/deploy/gcp
terraform init
terraform apply
popd
