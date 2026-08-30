#!/usr/bin/env bash
# SessionStart hook: ensure TruffleHog is available for the pre-commit secret scan.
#
# Enforcement (blocking on missing tool / found secrets) lives in
# scan-staged-secrets.sh. This script just does best-effort installation so the
# block-on-missing policy does not permanently wedge the agent's commits.
# It must never hard-fail a session: all failures are logged and swallowed.

set -u

# Pin to the same TruffleHog line CI uses (see .github/workflows/lint-and-build.yml).
TRUFFLEHOG_VERSION="3.82.13"
DOCKER_IMAGE="ghcr.io/trufflesecurity/trufflehog:${TRUFFLEHOG_VERSION}"
INSTALL_DIR="${HOME}/.local/bin"

log() { echo "[install-trufflehog] $*" >&2; }

# Already installed? Nothing to do.
if command -v trufflehog >/dev/null 2>&1; then
  log "trufflehog already present: $(command -v trufflehog)"
  exit 0
fi

# Try the official install script (installs a pinned binary into INSTALL_DIR).
if command -v curl >/dev/null 2>&1; then
  mkdir -p "${INSTALL_DIR}"
  log "installing trufflehog v${TRUFFLEHOG_VERSION} into ${INSTALL_DIR} ..."
  if curl -fsSL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh \
      | sh -s -- -b "${INSTALL_DIR}" "v${TRUFFLEHOG_VERSION}" >&2; then
    if "${INSTALL_DIR}/trufflehog" --version >/dev/null 2>&1; then
      log "trufflehog binary installed at ${INSTALL_DIR}/trufflehog"
      exit 0
    fi
  fi
  log "binary install failed or unavailable; will rely on docker fallback at scan time"
fi

# Fall back to pre-pulling the docker image so the scan hook can use it.
if command -v docker >/dev/null 2>&1; then
  log "pre-pulling docker image ${DOCKER_IMAGE} ..."
  if docker pull "${DOCKER_IMAGE}" >&2 2>&1; then
    log "docker image ready: ${DOCKER_IMAGE}"
    exit 0
  fi
  log "docker pull failed (network policy?); scan hook will retry on demand"
fi

log "could not install trufflehog; commits will be BLOCKED until it is available"
# Do not fail the session — enforcement is the scan hook's job.
exit 0
