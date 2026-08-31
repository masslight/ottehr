#!/usr/bin/env python3
"""
Remove top-level try/catch from zambda handlers.
The try/catch is being moved into wrapHandler in sentry.ts.

For each file:
1. Find the single outer try/catch that ends with `return topLevelCatch(...)`
2. Remove the `try {` line
3. Dedent the content of the try block by 2 spaces
4. Remove the entire catch block
5. Remove `topLevelCatch` from imports
"""

import re
import os
import sys
from pathlib import Path


def get_indent(line: str) -> int:
    """Return the number of leading spaces in a line."""
    return len(line) - len(line.lstrip(' '))


def process_file(filepath: Path) -> bool:
    """
    Process a single file. Returns True if modified.
    """
    with open(filepath, 'r') as f:
        original = f.read()

    if 'topLevelCatch' not in original:
        return False

    # Skip the definition file and complex helper file
    norm = str(filepath).replace('\\', '/')
    skip_patterns = ['shared/lambda.ts', 'subscriptions/task/helpers.ts']
    for pattern in skip_patterns:
        if pattern in norm:
            return False

    lines = original.split('\n')

    # Find all lines with `return topLevelCatch(`
    tl_indices = [i for i, l in enumerate(lines) if 'return topLevelCatch(' in l]

    if not tl_indices:
        return False

    # Skip files with multiple topLevelCatch returns (complex logic, not standard pattern)
    if len(tl_indices) > 1:
        print(f'  SKIP (multiple topLevelCatch returns): {filepath.name}')
        return False

    tl_idx = tl_indices[0]

    # Find the `} catch (` block that contains this return (search backwards)
    catch_start = None
    for i in range(tl_idx, -1, -1):
        stripped = lines[i].strip()
        if re.match(r'^}\s*catch\s*\(', stripped):
            catch_start = i
            break

    if catch_start is None:
        print(f'  SKIP (no catch found): {filepath.name}')
        return False

    catch_indent = get_indent(lines[catch_start])

    # Find the closing `}` of the catch block using brace counting
    # The `} catch (...) {` line opens the catch body with 1 brace
    brace_depth = 1
    catch_end = None
    for i in range(catch_start + 1, len(lines)):
        stripped = lines[i].strip()
        # Count braces (ignoring string content - acceptable approximation)
        for ch in stripped:
            if ch == '{':
                brace_depth += 1
            elif ch == '}':
                brace_depth -= 1
        if brace_depth <= 0:
            catch_end = i
            break

    if catch_end is None:
        print(f'  SKIP (no catch end found): {filepath.name}')
        return False

    # Find the matching `try {` at same indent as the catch block (search backwards)
    try_start = None
    for i in range(catch_start - 1, -1, -1):
        stripped = lines[i].strip()
        if not stripped:
            continue
        indent = get_indent(lines[i])
        if indent == catch_indent and stripped == 'try {':
            try_start = i
            break

    if try_start is None:
        print(f'  SKIP (no matching try found): {filepath.name}')
        return False

    # Build new file content
    new_lines = []
    for i, line in enumerate(lines):
        if i == try_start:
            # Remove the `try {` line entirely
            continue
        elif try_start < i < catch_start:
            # Dedent the content of the try block by 2 spaces
            if line.startswith('  '):
                new_lines.append(line[2:])
            else:
                new_lines.append(line)
        elif catch_start <= i <= catch_end:
            # Remove the entire catch block
            continue
        else:
            new_lines.append(line)

    new_content = '\n'.join(new_lines)

    # Remove `topLevelCatch` from import statements
    # Handle multiline import: "  topLevelCatch,\n"
    new_content = re.sub(r'\n(\s+)topLevelCatch,', '', new_content)
    # Handle multiline import (last item): ",\n  topLevelCatch\n"
    new_content = re.sub(r',\n(\s+)topLevelCatch(\n)', r'\2', new_content)
    # Handle single-line import: ", topLevelCatch" before } or ,
    new_content = re.sub(r',\s*topLevelCatch(?=\s*[,}])', '', new_content)
    # Handle single-line import: "topLevelCatch, " at start of braces content
    new_content = re.sub(r'(?<=\{)\s*topLevelCatch,\s*', ' ', new_content)

    if new_content == original:
        print(f'  NO CHANGE: {filepath.name}')
        return False

    with open(filepath, 'w') as f:
        f.write(new_content)

    return True


def main():
    base = Path('/home/user/ottehr/packages/zambdas/src')

    # Collect all index.ts zambda files and the quick-pick helper
    index_files = [
        p for p in base.rglob('index.ts')
        if 'local-server' not in str(p) and 'shared/index.ts' not in str(p)
           and 'shared/types/index.ts' not in str(p)
           and 'shared/pdf/' not in str(p)
           and 'shared/appointment/index.ts' not in str(p)
           and 'shared/chart-data/index.ts' not in str(p)
           and 'shared/encounter/index.ts' not in str(p)
           and 'shared/presigned-file-urls/index.ts' not in str(p)
           and 'shared/statements/index.ts' not in str(p)
           and 'shared/harvest/index.ts' not in str(p)
    ]

    other_files = [base / 'ehr/shared/quick-pick-zambda.ts']

    all_files = sorted(index_files) + [f for f in other_files if f.exists()]

    modified = 0
    skipped = 0
    for fp in all_files:
        result = process_file(fp)
        if result:
            print(f'  Modified: {fp.relative_to(base)}')
            modified += 1
        else:
            skipped += 1

    print(f'\nDone. Modified: {modified}, Unchanged/skipped: {skipped}')


if __name__ == '__main__':
    main()
