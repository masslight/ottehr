#!/usr/bin/env bash
#
# Exercises the DICOM echo mechanism on the PACS gateway one layer at a time, so a failure points at the
# layer that is broken:
#
#   1. TCP connect from this host to the DICOM endpoint   (what pacs_poll_tcp_connect_success measures)
#   2. dcm4che C-ECHO from inside the bridgelink container (what the Mirth echo channel runs)
#   3. the Mirth echo channel over HTTP, positive and negative (what pacs-poll calls every cycle)
#   4. the pacs-poll metrics endpoint                      (what Prometheus scrapes)
#
# Run it on the gateway host as a user that can talk to docker (or with DOCKER="sudo docker").
#
# Usage: test-dicom-echo.sh -c CALLED_AET -H HOST -p PORT [options] [-- extra storescu arguments]
#
#   -c CALLED_AET   AE title of the remote SCP (required)
#   -H HOST         host of the remote SCP (required)
#   -p PORT         port of the remote SCP (required)
#   -b CALLING_AET  AE title to present; omitted, storescu uses STORESCU and the Mirth channel its own default
#   -u URL          Mirth echo channel URL            (default: http://localhost:8990/)
#   -m URL          pacs-poll metrics URL             (default: http://localhost:9090/metrics)
#   -C NAME         bridgelink container name         (default: bridgelink)
#   -t NAME         target name from connectivity.json, used to look up the metrics (default: lifesys-pacs)
#   -T SECONDS      timeout for each step             (default: 30)
#   -s STEPS        comma separated steps to skip: tcp, docker, mirth, metrics
#   -h              this help
#
# Anything after "--" is passed to storescu, for example "-- --tls --key-store /path/keystore.jks".
#
# Example:
#   ./test-dicom-echo.sh -c LIFESYS_AE -H 172.30.3.149 -p 6696 -b BRIDGELINK

set -u
set -o pipefail

usage() {
  # Print the comment block at the top of this file, minus the "# " prefixes.
  awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
  exit "${1:-0}"
}

CALLED=''
HOST=''
PORT=''
CALLING=''
MIRTH_URL='http://localhost:8990/'
METRICS_URL='http://localhost:9090/metrics'
CONTAINER='bridgelink'
TARGET='lifesys-pacs'
TIMEOUT=30
SKIP=''

while getopts ':c:H:p:b:u:m:C:t:T:s:h' opt; do
  case "$opt" in
    c) CALLED=$OPTARG ;;
    H) HOST=$OPTARG ;;
    p) PORT=$OPTARG ;;
    b) CALLING=$OPTARG ;;
    u) MIRTH_URL=$OPTARG ;;
    m) METRICS_URL=$OPTARG ;;
    C) CONTAINER=$OPTARG ;;
    t) TARGET=$OPTARG ;;
    T) TIMEOUT=$OPTARG ;;
    s) SKIP=$OPTARG ;;
    h) usage 0 ;;
    :) echo "option -$OPTARG needs a value" >&2; usage 2 ;;
    *) echo "unknown option -$OPTARG" >&2; usage 2 ;;
  esac
done
shift $((OPTIND - 1))
[ "${1:-}" = '--' ] && shift
STORESCU_EXTRA=("$@")

if [ -z "$CALLED" ] || [ -z "$HOST" ] || [ -z "$PORT" ]; then
  echo "-c, -H and -p are required" >&2
  usage 2
fi
case "$PORT" in
  '' | *[!0-9]*) echo "-p must be a port number" >&2; exit 2 ;;
esac

if [ -t 1 ]; then
  GREEN=$'\e[32m' RED=$'\e[31m' YELLOW=$'\e[33m' BOLD=$'\e[1m' RESET=$'\e[0m'
else
  GREEN='' RED='' YELLOW='' BOLD='' RESET=''
fi

FAILURES=0
pass() { printf '%s[PASS]%s %s\n' "$GREEN" "$RESET" "$1"; }
fail() { printf '%s[FAIL]%s %s\n' "$RED" "$RESET" "$1"; FAILURES=$((FAILURES + 1)); }
warn() { printf '%s[WARN]%s %s\n' "$YELLOW" "$RESET" "$1"; }
skip() { printf '[SKIP] %s\n' "$1"; }
step() { printf '\n%s== %s ==%s\n' "$BOLD" "$1" "$RESET"; }
show() { sed 's/^/    /' "$1" | head -n "${2:-25}" | sed '$a\'; }
skipped() { case ",$SKIP," in *",$1,"*) return 0 ;; *) return 1 ;; esac; }
json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "DICOM echo mechanism test"
echo "  remote SCP : ${CALLING:-<default>} -> $CALLED@$HOST:$PORT"
echo "  Mirth      : $MIRTH_URL"
echo "  metrics    : $METRICS_URL (target \"$TARGET\")"

# ── 1. TCP ──────────────────────────────────────────────────────────

step "1. TCP connect from this host to $HOST:$PORT"
if skipped tcp; then
  skip 'tcp'
else
  if timeout "$TIMEOUT" bash -c "exec 3<>/dev/tcp/$HOST/$PORT" 2>"$TMP/tcp.err"; then
    pass "connected to $HOST:$PORT"
  elif [ $? -eq 124 ]; then
    fail "no connection within ${TIMEOUT}s (tunnel down, no route, or a firewall dropping packets)"
  else
    fail "could not connect: $(tail -n 1 "$TMP/tcp.err" | sed 's/.*: //')"
  fi
fi

# ── 2. dcm4che inside the container ────────────────────────────────

step "2. dcm4che C-ECHO from inside the $CONTAINER container"
if skipped docker; then
  skip 'docker'
else
  read -r -a DOCKER <<<"${DOCKER:-docker}"
  if ! "${DOCKER[@]}" ps >/dev/null 2>"$TMP/docker.err"; then
    fail "cannot talk to docker ($(tail -n 1 "$TMP/docker.err")); add this user to the docker group or run with DOCKER='sudo docker'"
  elif [ "$("${DOCKER[@]}" inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" != 'true' ]; then
    fail "container $CONTAINER is not running"
  elif ! "${DOCKER[@]}" exec "$CONTAINER" test -x /opt/dcm4che/bin/storescu; then
    fail "/opt/dcm4che/bin/storescu is not executable inside $CONTAINER; is /opt/dcm4che mounted?"
  else
    MS=$((TIMEOUT * 1000))
    CMD=(/opt/dcm4che/bin/storescu -c "$CALLED@$HOST:$PORT" --connect-timeout "$MS" --accept-timeout "$MS" --response-timeout "$MS")
    [ -n "$CALLING" ] && CMD+=(-b "$CALLING")
    CMD+=("${STORESCU_EXTRA[@]}")
    echo "    running: ${CMD[*]}"
    if timeout "$((TIMEOUT + 10))" "${DOCKER[@]}" exec "$CONTAINER" "${CMD[@]}" >"$TMP/storescu.out" 2>&1; then
      pass 'storescu exited 0: the SCP accepted the association and answered the C-ECHO'
    else
      RC=$?
      if [ "$RC" -eq 124 ]; then
        fail "storescu did not finish within $((TIMEOUT + 10))s"
      else
        fail "storescu exited $RC (an A-ASSOCIATE-RJ usually means the called or calling AE title is not configured on the SCP)"
      fi
    fi
    show "$TMP/storescu.out"
  fi
fi

# ── 3. Mirth echo channel ──────────────────────────────────────────

mirth_echo() {
  # $1 = host, $2 = port, $3 = output file; prints the HTTP status, or "000" when Mirth could not be reached
  local calling_json=''
  [ -n "$CALLING" ] && calling_json=",\"callingAeTitle\":\"$(json_escape "$CALLING")\""
  local body
  body=$(printf '{"target":"%s","host":"%s","port":%s,"calledAeTitle":"%s"%s}' \
    "$(json_escape "$TARGET")" "$(json_escape "$1")" "$2" "$(json_escape "$CALLED")" "$calling_json")
  curl -sS -m "$TIMEOUT" -o "$3" -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
    --data "$body" "$MIRTH_URL" 2>"$TMP/curl.err" || printf '000'
}

step "3. Mirth echo channel at $MIRTH_URL"
if skipped mirth; then
  skip 'mirth'
else
  STATUS=$(mirth_echo "$HOST" "$PORT" "$TMP/mirth.out")
  case "$STATUS" in
    000) fail "could not reach Mirth: $(tail -n 1 "$TMP/curl.err")" ;;
    2??) pass "Mirth answered $STATUS: echo succeeded" ;;
    *) fail "Mirth answered $STATUS: echo failed (if step 2 passed, the channel is not running the same storescu command)" ;;
  esac
  [ -s "$TMP/mirth.out" ] && show "$TMP/mirth.out"

  echo
  echo "    negative check: asking Mirth to echo 127.0.0.1:1, where nothing listens"
  STATUS=$(mirth_echo '127.0.0.1' 1 "$TMP/mirth-negative.out")
  case "$STATUS" in
    000) fail "could not reach Mirth: $(tail -n 1 "$TMP/curl.err")" ;;
    2??) fail "Mirth answered $STATUS for an echo that cannot succeed; the channel must map a non-zero storescu exit code to a non-2xx response or pacs_poll_dicom_echo_success will always read 1" ;;
    *) pass "Mirth answered $STATUS for the impossible echo, so failures are reported" ;;
  esac
  [ -s "$TMP/mirth-negative.out" ] && show "$TMP/mirth-negative.out" 5
fi

# ── 4. pacs-poll metrics ───────────────────────────────────────────

step "4. pacs-poll metrics at $METRICS_URL"
if skipped metrics; then
  skip 'metrics'
elif ! curl -sS -m 10 -o "$TMP/metrics" "$METRICS_URL" 2>"$TMP/curl.err"; then
  fail "could not fetch metrics: $(tail -n 1 "$TMP/curl.err"); is pacs-poll running?"
else
  grep -E "^pacs_poll_(tcp_connect|dicom_echo)_[a-z_]+\{[^}]*target=\"$TARGET\"" "$TMP/metrics" >"$TMP/target-metrics" || true
  if [ ! -s "$TMP/target-metrics" ]; then
    warn "no connectivity metrics for target \"$TARGET\" yet: check that .env/connectivity.json lists it and that a poll cycle has run since pacs-poll was restarted"
  else
    show "$TMP/target-metrics" 50
    TCP_VALUE=$(grep -E '^pacs_poll_tcp_connect_success\{' "$TMP/target-metrics" | awk '{ print $NF }')
    ECHO_VALUE=$(grep -E '^pacs_poll_dicom_echo_success\{' "$TMP/target-metrics" | awk '{ print $NF }')
    case "$TCP_VALUE" in
      1) pass 'pacs_poll_tcp_connect_success is 1' ;;
      0) fail 'pacs_poll_tcp_connect_success is 0' ;;
      *) warn 'pacs_poll_tcp_connect_success is missing for this target' ;;
    esac
    case "$ECHO_VALUE" in
      1) pass 'pacs_poll_dicom_echo_success is 1' ;;
      0) fail 'pacs_poll_dicom_echo_success is 0 (the failure reason is in the pacs-poll log and in pacs_poll_dicom_echo_failures_total)' ;;
      *) warn 'pacs_poll_dicom_echo_success is missing: does the target have a dicomEcho block and is mirthEchoUrl set?' ;;
    esac
  fi
fi

# ── Summary ────────────────────────────────────────────────────────

echo
if [ "$FAILURES" -eq 0 ]; then
  printf '%sAll checks passed.%s\n' "$GREEN" "$RESET"
else
  printf '%s%d check(s) failed.%s\n' "$RED" "$FAILURES" "$RESET"
fi
echo
echo "connectivity.json target block for this SCP:"
CALLING_JSON=''
[ -n "$CALLING" ] && CALLING_JSON=", \"callingAeTitle\": \"$(json_escape "$CALLING")\""
printf '    { "name": "%s", "host": "%s", "port": %s, "dicomEcho": { "calledAeTitle": "%s"%s } }\n' \
  "$(json_escape "$TARGET")" "$(json_escape "$HOST")" "$PORT" "$(json_escape "$CALLED")" "$CALLING_JSON"

[ "$FAILURES" -eq 0 ]
