#!/usr/bin/env bash

# Times a series of read-only `terraform plan` runs to work out where the plan's
# time actually goes. Running them all inside one job is the point: runner,
# network, workspace and state size are identical across every sample, which
# comparing separately queued CI runs cannot give you.
#
# Three questions, three probe shapes:
#
#   full             — does widening the graph walk help? Repeat a -parallelism
#                      value at both ends to see how much drift there was.
#   full-norefresh   — how much of a plan is refreshing at all? The difference
#                      from `full` is the whole cost of reading 600+ resources,
#                      and also prices `-refresh=false` as a lever.
#   target[-norefresh] — how long is ONE read? The pair runs the same pruned
#                      graph and differs only in whether it refreshes, so the
#                      difference isolates the reads and nothing else.
#
# Together those give achieved concurrency: reads x single-read-latency divided
# by the measured refresh cost. If that lands far below the -parallelism we
# asked for, the ceiling is upstream of Terraform and no client-side change
# helps.
#
# Every probe is a plan, so this never mutates the environment.
#
# Usage: TF_PROFILE_DIR=<dir> ./plan-probes.sh <env> [comma-separated -parallelism values]

set -euo pipefail

ENV="${1:?environment required}"
PARALLELISM_LIST="${2:-${TF_PLAN_PROBE_PARALLELISM:-20,120,20}}"
# A Zambda is a good single-read subject: no dependencies of its own, and every
# environment has this one. `reads` in the output confirms what -target pulled in.
TARGET="${TF_PLAN_PROBE_TARGET:-module.oystehr.oystehr_zambda.VERSION}"
REPEATS="${TF_PLAN_PROBE_REPEATS:-3}"
BASE_PARALLELISM="${TF_PLAN_PROBE_BASE_PARALLELISM:-20}"

: "${TF_PROFILE_DIR:?TF_PROFILE_DIR required}"
mkdir -p "${TF_PROFILE_DIR}"

# shellcheck source=./profile-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/profile-lib.sh"

RESULTS="${TF_PROFILE_DIR}/plan-probes.tsv"
: >"${RESULTS}"

sample=0

# run_probe <label> <parallelism> [extra terraform plan args...]
run_probe() {
  local label="$1" parallelism="$2"
  shift 2

  sample=$((sample + 1))
  local stamped_log="${TF_PROFILE_DIR}/plan-${sample}-${label}.log"
  : >"${stamped_log}"

  echo "--- probe ${sample}: ${label} (-parallelism=${parallelism}) ${*} ---"
  local started finished status total refresh reads
  started=$(date +%s%N)
  status=ok
  terraform plan -no-color -parallelism="${parallelism}" -var-file="${ENV}.tfvars" -detailed-exitcode "$@" \
    | stamp_stdin "${stamped_log}" || status=$?
  finished=$(date +%s%N)

  # -detailed-exitcode returns 2 for "succeeded, changes present", which is the
  # expected result here and not a failure.
  if [ "${status}" = "2" ]; then
    status=ok
  fi

  total=$(awk -v ns="$((finished - started))" 'BEGIN { printf "%.1f", ns / 1000000000 }')
  refresh=$(refresh_seconds_from "${stamped_log}")
  reads=$(refresh_count_from "${stamped_log}")
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "${label}" "${parallelism}" "${reads}" "${total}" "${refresh:--}" "${status}" \
    >>"${RESULTS}"
  echo "${label}: ${reads} reads, total ${total}s, refresh window ${refresh:-—}s, status ${status}"
}

echo "Plan probes on ${ENV}: parallelism ${PARALLELISM_LIST}, target ${TARGET}"

# Does a wider graph walk help?
IFS=',' read -ra PARALLELISM_VALUES <<<"${PARALLELISM_LIST}"
for parallelism in "${PARALLELISM_VALUES[@]}"; do
  run_probe full "${parallelism}"
done

# What does refreshing cost at all?
run_probe full-norefresh "${BASE_PARALLELISM}" -refresh=false

# How long is one read? Interleaved so drift hits both halves of the pair.
for _ in $(seq 1 "${REPEATS}"); do
  run_probe target-norefresh "${BASE_PARALLELISM}" -target="${TARGET}" -refresh=false
  run_probe target "${BASE_PARALLELISM}" -target="${TARGET}"
done

echo "Wrote ${RESULTS}"
