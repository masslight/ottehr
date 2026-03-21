#!/usr/bin/env bash

# cSpell:disable-next flags
set -xeuo pipefail

export ENV=${1:-local}
action=${2:-apply}

# Enable auto-approve for CI and local deployments
AUTO_APPROVE=""
if [ "${CI:-false}" = "true" ] || [ "${ENV}" = "local" ]; then
  AUTO_APPROVE="--auto-approve"
fi

echo "Deploying environment: ${ENV}"

# Smart bundling: skip if zambda source hasn't changed since last bundle
ZAMBDA_SRC="../packages/zambdas/src"
ZAMBDA_DIST="../packages/zambdas/.dist"
CHECKSUM_FILE="${ZAMBDA_DIST}/.bundle-checksum"

if [ -d "${ZAMBDA_SRC}" ]; then
  CURRENT_CHECKSUM=$(find "${ZAMBDA_SRC}" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.json' \) -exec shasum {} + 2>/dev/null | sort | shasum | awk '{print $1}')
else
  CURRENT_CHECKSUM="none"
fi

PREVIOUS_CHECKSUM=""
if [ -f "${CHECKSUM_FILE}" ]; then
  PREVIOUS_CHECKSUM=$(cat "${CHECKSUM_FILE}")
fi

if [ "${CURRENT_CHECKSUM}" = "${PREVIOUS_CHECKSUM}" ] && [ -d "${ZAMBDA_DIST}/zips" ]; then
  echo "Zambda source unchanged — skipping bundle"
else
  npm run bundle-zambdas
  mkdir -p "${ZAMBDA_DIST}"
  echo "${CURRENT_CHECKSUM}" > "${CHECKSUM_FILE}"
fi
ENV="${ENV}" npm run generate

# For local dev, patch generated configs
if [ "${ENV}" = "local" ]; then
  echo '{}' > oystehr/lab-routes.tf.json
  if command -v python3 &>/dev/null; then
    python3 -c "
import json

# Remove lab route output references
with open('oystehr/outputs.tf.json', 'r') as f:
    data = json.load(f)
outputs = data.get('output', {})
keys_to_remove = [k for k in outputs if 'lab_route' in k]
for k in keys_to_remove:
    del outputs[k]
with open('oystehr/outputs.tf.json', 'w') as f:
    json.dump(data, f, indent=2)

# Fix app redirect URIs: remove login_redirect_uri (Oystehr rejects https://localhost)
with open('oystehr/apps.tf.json', 'r') as f:
    apps = json.load(f)
for app in apps.get('resource', {}).get('oystehr_application', {}).values():
    if 'login_redirect_uri' in app:
        del app['login_redirect_uri']
with open('oystehr/apps.tf.json', 'w') as f:
    json.dump(apps, f, indent=2)
"
  fi
fi

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
