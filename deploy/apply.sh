#!/usr/bin/env bash

# cSpell:disable-next flags
set -xeuo pipefail

export ENV=${1:-local}
action=${2:-apply}

# Enable auto-approve for CI deployments
AUTO_APPROVE=""
if [ "${CI:-false}" = "true" ]; then
  AUTO_APPROVE="--auto-approve"
fi

echo "Deploying environment: ${ENV}"

npm run bundle-zambdas
ENV="${ENV}" npm run generate
rm -f aws_override.tf
rm -f gcp_override.tf
npm run terraform-init
terraform workspace select ${ENV}
if grep "^aws_profile" ${ENV}.tfvars; then
  cp aws.tf.override aws_override.tf
fi
if grep "^gcp_project" ${ENV}.tfvars; then
  cp gcp.tf.override gcp_override.tf
fi
npm run terraform-init

# To debug without applying, pass `plan` after the environment parameter
if [ "${action}" = "apply" ]; then
  terraform apply -no-color -parallelism=20 -var-file="${ENV}.tfvars" "${AUTO_APPROVE}"
else
  terraform plan -no-color -parallelism=20 -var-file="${ENV}.tfvars"
fi
