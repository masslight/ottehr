#!/usr/bin/env bash

# cSpell:disable-next flags
set -xeuo pipefail

export ENV=${1:-local}
action=${2:-apply}
target=${3:-}

# Phase timing. Set TF_PROFILE_DIR to a writable directory to get a
# `phase<TAB>seconds` record of where the deploy spends its time plus a
# timestamped copy of the Terraform output; `npm run profile-report` turns those
# into a summary. Unset (the default, e.g. local dev) makes the hooks no-ops and
# leaves the commands below byte-for-byte what they were.
TF_PROFILE_DIR="${TF_PROFILE_DIR:-}"
TF_PROFILE_LOG=""
TF_PROFILE_TERRAFORM_LOG=""
if [ -n "${TF_PROFILE_DIR}" ]; then
  mkdir -p "${TF_PROFILE_DIR}"
  TF_PROFILE_LOG="${TF_PROFILE_DIR}/phases.tsv"
  TF_PROFILE_TERRAFORM_LOG="${TF_PROFILE_DIR}/terraform.log"
  : >"${TF_PROFILE_LOG}"
fi

_phase_name=""
_phase_start=0
# Flush the in-flight phase even when a command fails, so a failed deploy still
# reports how far it got and what that cost.
trap 'phase ""' EXIT
phase() {
  local now
  now=$(date +%s)
  if [ -n "${TF_PROFILE_LOG}" ] && [ -n "${_phase_name}" ]; then
    printf '%s\t%s\n' "${_phase_name}" "$((now - _phase_start))" >>"${TF_PROFILE_LOG}"
  fi
  _phase_name="${1:-}"
  _phase_start=${now}
}

# Streams stdin through unchanged while saving a wall-clock-stamped copy, so the
# refresh / plan / apply phases inside a single `terraform apply` can be
# separated after the fact. Terraform's own output is untouched.
export TF_PROFILE_TERRAFORM_LOG
tee_timestamped() {
  if [ -n "${TF_PROFILE_TERRAFORM_LOG}" ]; then
    perl -MTime::HiRes=time -e '
      $| = 1;
      open(my $fh, ">>", $ENV{TF_PROFILE_TERRAFORM_LOG}) or die "$!";
      select((select($fh), $| = 1)[0]);
      while (my $line = <STDIN>) { print $line; printf $fh "%.3f\t%s", time, $line; }
    '
  else
    cat
  fi
}

# Enable auto-approve for CI deployments
AUTO_APPROVE=""
if [ "${CI:-false}" = "true" ]; then
  AUTO_APPROVE="--auto-approve"
fi

TARGET=""
if [ "$target" != "" ]; then
  TARGET="-target=$target"
fi

PARALLELISM="${TF_PARALLELISM:-20}"

echo "Deploying environment: ${ENV}"

phase bundle-zambdas
npm run bundle-zambdas
phase generate-resources
ENV="${ENV}" npm run generate
rm -f aws_override.tf
rm -f billing_app/aws_override.tf
rm -f gcp_override.tf
rm -f billing_app/gcp_override.tf
phase terraform-init
npm run terraform-init
phase workspace-select
terraform workspace select ${ENV}
if grep "^aws_profile" ${ENV}.tfvars; then
  cp aws.tf.override aws_override.tf
  cp billing_app/aws.tf.override billing_app/aws_override.tf
fi
if grep "^gcp_project" ${ENV}.tfvars; then
  cp gcp.tf.override gcp_override.tf
  cp billing_app/gcp.tf.override billing_app/gcp_override.tf
fi
phase terraform-init-2
npm run terraform-init

# Compare the freshly built zips against the checksums Terraform already has in
# state, so a profiling run can report how many Zambdas are about to be
# re-uploaded and whether the build is reproducible. Read-only; never fatal.
if [ -n "${TF_PROFILE_DIR}" ]; then
  phase zambda-drift-audit
  TF_PROFILE_DIR="${TF_PROFILE_DIR}" npm run profile-zambda-drift || echo "zambda drift audit failed (non-fatal)"
fi

# To debug without applying, pass `plan` after the environment parameter
if [ "${action}" = "apply" ]; then
  phase terraform-apply
  terraform apply -no-color -parallelism="${PARALLELISM}" -var-file="${ENV}.tfvars" "${AUTO_APPROVE}" ${TARGET} \
    | tee_timestamped
else
  phase terraform-plan
  terraform plan -no-color -parallelism="${PARALLELISM}" -var-file="${ENV}.tfvars" ${TARGET} \
    | tee_timestamped
fi
phase ""
