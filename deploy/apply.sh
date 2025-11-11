#!/usr/bin/env bash

# cSpell:disable-next flags
set -xeuo pipefail

ENV=${1:-local}
AUTO_APPROVE="--auto-approve"
if [ "${ENV}" = "local" ]; then
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
terraform apply -no-color -parallelism=40 -var-file="${ENV}.tfvars" "${AUTO_APPROVE}"