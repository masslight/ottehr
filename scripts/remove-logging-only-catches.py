#!/usr/bin/env python3
"""
Removes try/catch blocks from zambda handler index.ts files where the catch block
ONLY contains console.log/console.error calls followed by a `throw`.
These are no-ops since wrapHandler already logs via topLevelCatch.
"""
import subprocess, re, os

BASE = '/home/user/ottehr'

SKIP_PATHS = [
    'packages/zambdas/src/shared/',
    'packages/zambdas/src/subscriptions/task/helpers.ts',
]


def read_file(filepath):
    with open(filepath, 'r') as f:
        return f.read().split('\n')


def write_file(filepath, lines):
    with open(filepath, 'w') as f:
        f.write('\n'.join(lines))


def find_handler_info(lines):
    """
    Find the wrapHandler async arrow function opening line and body indentation.
    Returns (open_idx, body_indent) or (None, None).
    body_indent = indentation of the opening line + 2
    """
    for i, line in enumerate(lines):
        if re.search(r'\): Promise<APIGatewayProxyResult> => \{$', line):
            stripped = line.lstrip()
            indent = len(line) - len(stripped)
            return i, indent + 2
    return None, None


def find_block_close(lines, open_idx):
    """
    Find the closing '}' line for the block opened at open_idx.
    Starts scanning from open_idx+1 with depth=1 (inside the opening brace on open_idx).
    Returns index of line where depth first reaches 0.
    """
    depth = 1
    for i in range(open_idx + 1, len(lines)):
        depth += lines[i].count('{') - lines[i].count('}')
        if depth == 0:
            return i
    return None


def find_catch_for_try(lines, try_idx, handler_close_idx, body_indent):
    """
    Find the `} catch (` line that belongs to the try block at try_idx.

    The `} catch (` line is at body_indent level and contains both `}` and `{`
    which cancel out in depth counting. So we use a different approach:
    track brace depth but treat `} catch (` lines specially — they close the
    try block AND open the catch block simultaneously.

    Returns (catch_start, body_end) where:
      - catch_start is the line index of `} catch (...) {`
      - body_end is catch_start (exclusive end of try body)
    Or (None, None) if not found.
    """
    catch_prefix_stripped = '} catch ('
    indent_str = ' ' * body_indent
    catch_line_pattern = re.compile(r'^\s*\}\s*catch\s*\(')

    # Scan forward, tracking nesting depth but watching for `} catch (` at body_indent level
    nesting = 0  # relative nesting inside the try body
    for i in range(try_idx + 1, handler_close_idx):
        line = lines[i]
        stripped = line.lstrip()
        actual_indent = len(line) - len(stripped)

        # Check if this could be a `} catch (` at body_indent level
        if actual_indent == body_indent and catch_line_pattern.match(line):
            # This is the catch line closing the try
            return i, i

        # Track nesting by counting braces, but only for lines that are not the catch/finally
        # We count net braces to know when we're back at body_indent level
        opens = line.count('{')
        closes = line.count('}')
        nesting += opens - closes

    return None, None


def is_logging_only_catch(lines, catch_start, catch_end):
    """
    Returns True if the catch body (between the } catch (...) { line and closing })
    contains ONLY:
      - blank lines
      - console.log/error/warn(...) calls (possibly multi-line)
      - a final `throw <var>;` statement
    The throw must be the last non-blank statement.
    """
    body_lines = lines[catch_start + 1:catch_end]  # excludes } catch (...) { and closing }

    # Filter non-blank lines
    non_blank = [(i, l) for i, l in enumerate(body_lines) if l.strip()]

    if not non_blank:
        return False  # empty catch body (no throw) — don't touch

    # Last non-blank must be throw <var>;
    last_stripped = non_blank[-1][1].strip()
    if not re.match(r'^throw \w+;$', last_stripped):
        return False

    # All other non-blank lines must be console.log/error/warn calls or their continuations
    # We track paren depth to handle multi-line calls
    paren_depth = 0

    for _, line in non_blank[:-1]:  # skip the final throw line
        stripped = line.strip()

        if paren_depth > 0:
            # We're inside a multi-line console call continuation
            paren_depth += stripped.count('(') - stripped.count(')')
            if paren_depth < 0:
                return False  # malformed
            continue

        # Check if this is a console.log/error/warn call start
        if re.match(r'^console\.(log|error|warn)\(', stripped):
            # Count parens to see if it closes on same line
            paren_depth = stripped.count('(') - stripped.count(')')
            continue

        # Anything else is not allowed
        return False

    # If we ended mid-call, something is wrong
    if paren_depth != 0:
        return False

    return True


def remove_logging_only_catch(lines, relpath):
    """
    Find the outermost try/catch at body_indent level and remove it if
    the catch is logging-only. Returns new lines or None if no change.
    """
    open_idx, body_indent = find_handler_info(lines)
    if open_idx is None:
        return None

    handler_close_idx = find_block_close(lines, open_idx)
    if handler_close_idx is None:
        return None

    try_prefix = ' ' * body_indent + 'try {'

    # Find the OUTERMOST try block at body_indent level
    # (the first one after open_idx at exactly body_indent spaces)
    try_idx = None
    for i in range(open_idx + 1, handler_close_idx):
        if lines[i] == try_prefix:
            try_idx = i
            break

    if try_idx is None:
        return None  # no outer try block found

    # Find the catch block for this try
    catch_start, body_end = find_catch_for_try(lines, try_idx, handler_close_idx, body_indent)
    if catch_start is None:
        return None  # no catch (or unusual pattern)

    # Find catch block close
    catch_end = find_block_close(lines, catch_start)
    if catch_end is None:
        return None

    # Check there's no finally block (we won't process those)
    nxt = catch_end + 1
    if nxt < len(lines) and re.match(r'\s*\} finally \{', lines[nxt]):
        return None  # has finally, skip

    # Check if catch is logging-only
    if not is_logging_only_catch(lines, catch_start, catch_end):
        return None

    # Perform the transformation:
    # 1. Remove the `try {` line (try_idx)
    # 2. Dedent the try body by 2 spaces (lines[try_idx+1 .. body_end-1])
    # 3. Remove the entire catch block (catch_start .. catch_end inclusive)
    # Note: body_end is the exclusive end of the try body.
    # If catch_start == body_end: body is lines[try_idx+1 .. catch_start-1]
    # If catch_start == body_end + 1: body is lines[try_idx+1 .. body_end-1], then skip the `}` at body_end

    body_start = try_idx + 1

    new_lines = []
    # Lines before the try { line
    new_lines.extend(lines[:try_idx])

    # Dedented try body lines (up to but not including body_end)
    for line in lines[body_start:body_end]:
        if line.startswith('  '):
            new_lines.append(line[2:])
        elif line == '':
            new_lines.append(line)
        else:
            new_lines.append(line)  # can't dedent, keep as-is

    # Lines after catch end (skip catch block entirely)
    new_lines.extend(lines[catch_end + 1:])

    return new_lines


def verify_no_dangling_braces(lines, relpath):
    """Basic check: brace counts should balance."""
    depth = 0
    for line in lines:
        # Skip string literals roughly (not perfect but good enough)
        depth += line.count('{') - line.count('}')
    if depth != 0:
        print(f'  WARNING: {relpath} has unbalanced braces (depth={depth}) after transform')
        return False
    return True


# ─────────────────────────────────────────
# Main
# ─────────────────────────────────────────

result = subprocess.run(
    ['git', 'diff', '--name-only', 'HEAD~2..HEAD'],
    capture_output=True, text=True, cwd=BASE
)
changed_files = [f for f in result.stdout.strip().split('\n')
                 if f.startswith('packages/zambdas/src/') and f.endswith('/index.ts')]

# Apply skip rules
def should_skip(relpath):
    for skip in SKIP_PATHS:
        if relpath.startswith(skip) or relpath == skip:
            return True
    return False

changed_files = [f for f in changed_files if not should_skip(f)]

processed = []
skipped_no_try = []
skipped_non_logging = []
errors = []

for relpath in changed_files:
    filepath = os.path.join(BASE, relpath)
    if not os.path.exists(filepath):
        skipped_no_try.append(f'{relpath} (file not found)')
        continue

    lines = read_file(filepath)
    new_lines = remove_logging_only_catch(lines, relpath)

    if new_lines is None:
        # Determine why we skipped
        open_idx, body_indent = find_handler_info(lines)
        if open_idx is None:
            skipped_no_try.append(f'{relpath} (no handler found)')
        else:
            try_prefix = ' ' * body_indent + 'try {'
            has_try = any(l == try_prefix for l in lines)
            if not has_try:
                skipped_no_try.append(relpath)
            else:
                skipped_non_logging.append(relpath)
        continue

    # Verify
    ok = verify_no_dangling_braces(new_lines, relpath)
    if not ok:
        errors.append(f'{relpath}: unbalanced braces after transform — SKIPPING')
        continue

    write_file(filepath, new_lines)
    processed.append(relpath)

print(f'Transformed {len(processed)} files:')
for f in processed:
    print(f'  {f}')

print(f'\nSkipped {len(skipped_non_logging)} files (has outer try/catch but catch has extra logic):')
for f in skipped_non_logging:
    print(f'  {f}')

print(f'\nSkipped {len(skipped_no_try)} files (no outer try at handler level):')
for f in skipped_no_try:
    print(f'  {f}')

if errors:
    print(f'\nErrors ({len(errors)}):')
    for e in errors:
        print(f'  {e}')
