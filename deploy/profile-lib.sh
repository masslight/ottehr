#!/usr/bin/env bash
# Shared profiling helpers, sourced by apply.sh and parallelism-sweep.sh.

# Streams stdin through unchanged while appending a wall-clock-stamped copy to
# the file named by $1, so phases inside a single Terraform run (refresh, plan,
# apply) can be separated after the fact. Terraform's own output is untouched.
# With no destination, this is a plain `cat`.
stamp_stdin() {
  local destination="${1:-}"
  if [ -z "${destination}" ]; then
    cat
    return
  fi
  STAMP_STDIN_DESTINATION="${destination}" perl -MTime::HiRes=time -e '
    $| = 1;
    open(my $fh, ">>", $ENV{STAMP_STDIN_DESTINATION}) or die "$!";
    select((select($fh), $| = 1)[0]);
    while (my $line = <STDIN>) { print $line; printf $fh "%.3f\t%s", time, $line; }
  '
}

# Prints the number of seconds spanned by the "Refreshing state..." lines in a
# stamped log, or an empty string when the log has none (a plan with nothing in
# state, or a refresh that was skipped).
refresh_seconds_from() {
  local stamped_log="$1"
  [ -s "${stamped_log}" ] || return 0
  awk -F'\t' '
    /Refreshing state\.\.\./ { if (first == "") first = $1; last = $1 }
    END { if (first != "") printf "%.1f", last - first }
  ' "${stamped_log}"
}
