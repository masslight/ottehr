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

echo "Deploying billing stack to environment: ${ENV}"

# Bundle only the billing stack's zambdas and generate its Terraform config
(cd .. && STACK=billing npm run bundle-zambdas && ENV="${ENV}" npm run generate-billing)

rm -f aws_override.tf
rm -f gcp_override.tf

# The billing stack shares deploy/backend.config with the clinical stack but stores
# its state under its own key. The key override only applies to the S3 backend; an
# empty backend.config (local backend) gets no override.
BACKEND_ARGS=(-backend-config=../backend.config)
if grep -q "bucket" ../backend.config; then
  BACKEND_ARGS+=(-backend-config=key=billing/terraform.tfstate)
fi

terraform init "${BACKEND_ARGS[@]}"
terraform workspace select -or-create ${ENV}
if grep "^aws_profile" ../${ENV}.tfvars; then
  cp aws.tf.override aws_override.tf
fi
if grep "^gcp_project" ../${ENV}.tfvars; then
  cp gcp.tf.override gcp_override.tf
fi
terraform init "${BACKEND_ARGS[@]}"

# To debug without applying, pass `plan` after the environment parameter
if [ "${action}" = "apply" ]; then
  terraform apply -no-color -parallelism=20 -var-file="../${ENV}.tfvars" ${AUTO_APPROVE}
else
  terraform plan -no-color -parallelism=20 -var-file="../${ENV}.tfvars"
fi
