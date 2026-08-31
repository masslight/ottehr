#!/usr/bin/env python3
"""
Restores try/catch blocks in zambda handlers that had extra logic beyond
just calling topLevelCatch. Replaces topLevelCatch with throw error so
wrapHandler handles error reporting.
"""
import subprocess, re, os

BASE = '/home/user/ottehr'

def get_original_lines(relpath):
    result = subprocess.run(['git', 'show', f'HEAD~1:{relpath}'],
                            capture_output=True, text=True, cwd=BASE)
    if result.returncode != 0:
        return None
    return result.stdout.split('\n')

def read_file(filepath):
    with open(filepath, 'r') as f:
        return f.read().split('\n')

def write_file(filepath, lines):
    with open(filepath, 'w') as f:
        f.write('\n'.join(lines))

def find_block_close(lines, open_idx):
    """
    Find the closing '}' line for the block opened at open_idx.
    Starts scanning from open_idx+1 with depth=1 (inside the opening brace).
    """
    depth = 1
    for i in range(open_idx + 1, len(lines)):
        depth += lines[i].count('{') - lines[i].count('}')
        if depth == 0:
            return i
    return None

def find_handler_info(lines):
    """
    Find the wrapHandler async arrow function opening line and body indentation.
    Returns (open_idx, body_indent) or (None, None).
    """
    for i, line in enumerate(lines):
        if re.search(r'\): Promise<APIGatewayProxyResult> => \{$', line):
            stripped = line.lstrip()
            return i, len(line) - len(stripped) + 2
    return None, None

def extract_toplevelcatch_try_catch(orig_lines):
    """
    Find the try/catch block in the original file that contains the
    topLevelCatch call (this is the specific one that was removed by the refactor).
    Returns (body_indent, try_idx, catch_lines, finally_lines) or
    (None, None, None, None) if not found.
    """
    open_idx, body_indent = find_handler_info(orig_lines)
    if open_idx is None:
        return None, None, None, None

    catch_prefix = ' ' * body_indent + '} catch ('
    try_prefix   = ' ' * body_indent + 'try {'

    # Find all catch blocks at body_indent level that contain topLevelCatch
    i = open_idx + 1
    while i < len(orig_lines):
        if orig_lines[i].startswith(catch_prefix):
            catch_start = i
            catch_end = find_block_close(orig_lines, catch_start)
            if catch_end is None:
                i += 1
                continue

            catch_body = orig_lines[catch_start:catch_end + 1]

            # Is this the catch that had topLevelCatch?
            has_toplevel = any(
                re.search(r'(?:return\s+)?(?:await\s+)?topLevelCatch\s*\(', l)
                for l in catch_body
            )

            if has_toplevel:
                # Scan backward for the matching try {
                try_idx = None
                for j in range(catch_start - 1, open_idx, -1):
                    if orig_lines[j] == try_prefix:
                        try_idx = j
                        break

                if try_idx is None:
                    i = catch_end + 1
                    continue

                # Check for finally block immediately after catch
                finally_lines = []
                nxt = catch_end + 1
                if nxt < len(orig_lines) and re.match(r'\s*\} finally \{', orig_lines[nxt]):
                    fin_end = find_block_close(orig_lines, nxt)
                    if fin_end is not None:
                        finally_lines = orig_lines[nxt:fin_end + 1]

                return body_indent, try_idx, catch_body, finally_lines

            i = catch_end + 1
        else:
            i += 1

    return body_indent, None, None, None

def has_extra_logic(catch_lines):
    """Return True if catch has anything beyond ENVIRONMENT assignment + topLevelCatch call."""
    for line in catch_lines[1:-1]:  # skip } catch (...) { and closing }
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r'const (?:ENVIRONMENT|environment)\s*=\s*getSecret\(', stripped):
            continue
        if re.match(r'return\s+(?:await\s+)?topLevelCatch\s*\(', stripped):
            continue
        if re.match(r'await\s+topLevelCatch\s*\(', stripped):
            continue
        return True
    return False

def transform_catch_block(catch_lines):
    """
    Keep all extra logic, replace topLevelCatch with throw, and remove
    the ENVIRONMENT variable if it's only used by topLevelCatch.

    Handles two patterns:
    A) return [await] topLevelCatch(...) → throw error_var
    B) await topLevelCatch(...); <optional extra lines>; return { 500 }
       → keep extra lines, remove await topLevelCatch and return {...}, add throw error_var
    """
    # Extract error variable name from the catch signature (first line)
    catch_sig = catch_lines[0] if catch_lines else ''
    error_var_match = re.search(r'} catch \((\w+)', catch_sig)
    error_var = error_var_match.group(1) if error_var_match else 'error'

    # Check if ENVIRONMENT/environment is referenced in lines OTHER than
    # the topLevelCatch call and its own definition.
    env_used_elsewhere = False
    for line in catch_lines:
        stripped = line.strip()
        if re.match(r'const (?:ENVIRONMENT|environment)\s*=\s*getSecret\(', stripped):
            continue  # skip the definition line itself
        if re.match(r'(?:return\s+)?(?:await\s+)?topLevelCatch\s*\(', stripped):
            continue  # skip topLevelCatch call — ENVIRONMENT there is being removed
        if re.search(r'\bENVIRONMENT\b|\benvironment\b', stripped):
            env_used_elsewhere = True
            break

    # Detect Pattern B: catch has `await topLevelCatch(...)` (side effect only, not return)
    has_await_toplevel = any(
        re.match(r'\s*await\s+topLevelCatch\s*\(', l) for l in catch_lines
    )

    result = []
    skip_return_block = False  # used in Pattern B to skip the old return { 500 }
    return_block_depth = 0

    for line in catch_lines:
        stripped = line.strip()

        # Handle skipping the old return { ... } block in Pattern B
        if skip_return_block:
            return_block_depth += stripped.count('{') - stripped.count('}')
            if return_block_depth <= 0:
                skip_return_block = False
            continue

        # Optionally drop ENVIRONMENT assignment if only used by topLevelCatch
        if re.match(r'const (?:ENVIRONMENT|environment)\s*=\s*getSecret\(', stripped):
            if env_used_elsewhere:
                result.append(line)
            continue

        # Pattern A: replace return topLevelCatch / return await topLevelCatch with throw
        m = re.match(r'(\s*)return\s+(?:await\s+)?topLevelCatch\s*\([^,]+,\s*(\w+)', line)
        if m:
            result.append(f'{m.group(1)}throw {m.group(2)};')
            continue

        # Pattern B: remove standalone await topLevelCatch (side-effect call)
        if re.match(r'\s*await\s+topLevelCatch\s*\(', line):
            continue

        # Pattern B: skip old `return { statusCode: ... }` that followed topLevelCatch
        if has_await_toplevel and re.match(r'\s*return\s*\{', line):
            # Start skipping this return block
            skip_return_block = True
            return_block_depth = stripped.count('{') - stripped.count('}')
            if return_block_depth <= 0:
                skip_return_block = False
            continue

        result.append(line)

    # Pattern B: insert `throw error_var` before the closing `}` of the catch
    if has_await_toplevel:
        # Find the closing `}` (last element should be `  }`)
        # Insert throw before it
        close_idx = len(result) - 1
        while close_idx >= 0 and result[close_idx].strip() == '':
            close_idx -= 1
        if close_idx >= 0 and result[close_idx].strip() == '}':
            # Determine indentation for throw (body_indent + 2)
            throw_indent = ' ' * (len(result[close_idx]) - len(result[close_idx].lstrip()) + 2)
            result.insert(close_idx, f'{throw_indent}throw {error_var};')

    return result

# ─────────────────────────────────────────
# Main
# ─────────────────────────────────────────

result = subprocess.run(
    ['git', 'diff', '--name-only', 'HEAD~1..HEAD'],
    capture_output=True, text=True, cwd=BASE
)
changed_files = [f for f in result.stdout.strip().split('\n')
                 if f.startswith('packages/zambdas/src/') and f.endswith('/index.ts')]

processed = []
skipped_no_extra = []
errors = []

for relpath in changed_files:
    filepath = os.path.join(BASE, relpath)
    if not os.path.exists(filepath):
        continue

    orig_lines = get_original_lines(relpath)
    if orig_lines is None:
        continue

    body_indent, try_idx, catch_lines, finally_lines = extract_toplevelcatch_try_catch(orig_lines)

    if catch_lines is None:
        continue  # file had no outer try/catch with topLevelCatch originally

    if not has_extra_logic(catch_lines):
        skipped_no_extra.append(relpath)
        continue

    # Transform the catch block
    new_catch = transform_catch_block(catch_lines)

    # ── Modify the current file ──────────────────────────────────────────────
    curr_lines = read_file(filepath)

    # Find handler opening in current file
    curr_open_idx, curr_body_indent = find_handler_info(curr_lines)
    if curr_open_idx is None:
        errors.append(f'{relpath}: cannot find handler opening in current file')
        continue

    # Find handler closing by brace counting
    handler_close_idx = find_block_close(curr_lines, curr_open_idx)
    if handler_close_idx is None:
        errors.append(f'{relpath}: cannot find handler closing in current file')
        continue

    # Build new content:
    #   lines before handler opening (unchanged)
    #   handler opening line
    #   <body_indent>try {
    #   body lines with 2 extra spaces each
    #   catch block (from orig, transformed)
    #   finally block (if any)
    #   handler close line and beyond

    try_indent = ' ' * curr_body_indent
    new_lines = []
    new_lines.extend(curr_lines[:curr_open_idx + 1])
    new_lines.append(f'{try_indent}try {{')

    for line in curr_lines[curr_open_idx + 1:handler_close_idx]:
        new_lines.append('  ' + line if line else '')

    new_lines.extend(new_catch)
    new_lines.extend(finally_lines)
    new_lines.extend(curr_lines[handler_close_idx:])

    write_file(filepath, new_lines)
    processed.append(relpath)

print(f'Fixed {len(processed)} files:')
for f in processed:
    print(f'  {f}')

if errors:
    print(f'\nErrors ({len(errors)}):')
    for e in errors:
        print(f'  {e}')

print(f'\nSkipped {len(skipped_no_extra)} files (only ENVIRONMENT + topLevelCatch, no extra logic)')
