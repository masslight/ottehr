#!/usr/bin/env bash

set -xeuo pipefail

ENV=${1:-local}
npm run bundle-zambdas
ENV=${ENV} npm run generate
rm -f aws_override.tf
rm -f gcp_override.tf
terraform workspace select ${ENV}
if grep "^aws_profile" ${ENV}.tfvars; then
  cp aws.tf.override aws_override.tf
fi
if grep "^gcp_project" ${ENV}.tfvars; then
  cp gcp.tf.override gcp_override.tf
fi
npm run terraform-init
terraform apply -parallelism=40 -var-file="${ENV}.tfvars"