#!/usr/bin/env bash

# cSpell:disable-next flags
set -xeuo pipefail

export ENV=${1:-local}

AUTO_APPROVE="--auto-approve"
if [ "${ENV}" = "local" ] && [ "${CI}" != "true" ]; then
  AUTO_APPROVE=""
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

# To debug without applying, uncomment the plan command and comment out the apply command
TF_LOG=debug terraform apply -no-color -parallelism=20 -var-file="${ENV}.tfvars" "${AUTO_APPROVE}"
# terraform plan -no-color -parallelism=20 -var-file="${ENV}.tfvars"
