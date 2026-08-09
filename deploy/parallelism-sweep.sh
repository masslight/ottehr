#!/usr/bin/env bash

# Measures how Terraform's -parallelism affects the read-heavy part of a deploy.
#
# Refresh dominates our apply (613 resources, ~29s at -parallelism=20) and is
# almost entirely request latency, so widening the graph walk should shorten it.
# This runs `terraform plan` — read-only, so it never mutates the environment —
# several times back to back at different parallelism values and records how long
# each took.
#
# Running the whole sweep inside one job is the point: runner, network, workspace
# and state size are identical across the samples, which comparing separately
# queued CI runs cannot give you. Repeat a value at both ends of the sweep (the
# default does) to see how much drift there was during the measurement.
#
# Usage: TF_PROFILE_DIR=<dir> ./parallelism-sweep.sh <env> [comma-separated values]

set -euo pipefail

ENV="${1:?environment required}"
SWEEP="${2:-${TF_PARALLELISM_SWEEP:-20,60,120,20}}"

: "${TF_PROFILE_DIR:?TF_PROFILE_DIR required}"
mkdir -p "${TF_PROFILE_DIR}"

# shellcheck source=./profile-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/profile-lib.sh"

RESULTS="${TF_PROFILE_DIR}/parallelism-sweep.tsv"
: >"${RESULTS}"

echo "Parallelism sweep on ${ENV}: ${SWEEP}"

sample=0
IFS=',' read -ra PARALLELISM_VALUES <<<"${SWEEP}"
for parallelism in "${PARALLELISM_VALUES[@]}"; do
  sample=$((sample + 1))
  stamped_log="${TF_PROFILE_DIR}/plan-sample${sample}-p${parallelism}.log"
  : >"${stamped_log}"

  echo "--- sample ${sample}: -parallelism=${parallelism} ---"
  started=$(date +%s%N)
  status=ok
  terraform plan -no-color -parallelism="${parallelism}" -var-file="${ENV}.tfvars" -detailed-exitcode \
    | stamp_stdin "${stamped_log}" || status=$?
  finished=$(date +%s%N)

  # -detailed-exitcode returns 2 for "succeeded, changes present", which is the
  # expected result here and not a failure.
  if [ "${status}" = "2" ]; then
    status=ok
  fi

  total=$(awk -v ns="$((finished - started))" 'BEGIN { printf "%.1f", ns / 1000000000 }')
  refresh=$(refresh_seconds_from "${stamped_log}")
  printf '%s\t%s\t%s\t%s\n' "${parallelism}" "${total}" "${refresh:--}" "${status}" >>"${RESULTS}"
  echo "-parallelism=${parallelism}: total ${total}s, refresh ${refresh:-—}s, status ${status}"
done

echo "Wrote ${RESULTS}"
