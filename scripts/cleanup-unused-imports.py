#!/usr/bin/env python3
"""
Clean up unused imports (getSecret, SecretsKeys) from zambda files
after the try/catch refactor.
"""

import re
from pathlib import Path


def symbol_used_outside_imports(content: str, symbol: str) -> bool:
    """Check if symbol appears in the file outside of import statements."""
    # Remove all import lines and check if symbol still appears
    non_import_lines = [
        line for line in content.split('\n')
        if not line.strip().startswith('import ')
        and not re.match(r'^\s+\w', line) or not any(
            'import' in prev for prev in []
        )
    ]
    # Simpler: strip import blocks and check
    # Remove multi-line and single-line imports
    stripped = re.sub(r'^import\s.*?;$', '', content, flags=re.MULTILINE | re.DOTALL)
    # Also handle multi-line imports
    stripped = re.sub(r'^import\s+\{[^}]*\}\s+from\s+[\'"][^\'"]+[\'"];', '', stripped, flags=re.MULTILINE | re.DOTALL)

    return bool(re.search(r'\b' + re.escape(symbol) + r'\b', stripped))


def remove_symbol_from_imports(content: str, symbol: str) -> str:
    """Remove a symbol from import statements."""
    # Handle entire import line with only this symbol: import { symbol } from '...';
    content = re.sub(r'^import\s*\{\s*' + re.escape(symbol) + r'\s*\}\s*from\s*[\'"][^\'"]+[\'"];\n', '', content, flags=re.MULTILINE)
    # Handle multiline import: "  symbol,\n"
    content = re.sub(r'\n(\s+)' + re.escape(symbol) + r',', '', content)
    # Handle multiline import last item: ",\n  symbol\n"
    content = re.sub(r',\n(\s+)' + re.escape(symbol) + r'\n', '\n', content)
    # Handle single-line: "symbol, "
    content = re.sub(r'\b' + re.escape(symbol) + r',\s*', '', content)
    # Handle single-line: ", symbol"
    content = re.sub(r',\s*\b' + re.escape(symbol) + r'\b', '', content)
    return content


def process_file(filepath: Path) -> bool:
    with open(filepath, 'r') as f:
        original = f.read()

    content = original
    changed = False

    for symbol in ['getSecret', 'SecretsKeys']:
        if symbol not in content:
            continue
        # Check if it's in an import statement
        if not re.search(r'^import[^;]*\b' + re.escape(symbol) + r'\b[^;]*;', content, re.MULTILINE | re.DOTALL):
            continue
        # Check if it's used outside of imports
        if symbol_used_outside_imports(content, symbol):
            continue
        # Remove from imports
        new_content = remove_symbol_from_imports(content, symbol)
        if new_content != content:
            content = new_content
            changed = True

    if changed:
        with open(filepath, 'w') as f:
            f.write(content)

    return changed


def main():
    base = Path('/home/user/ottehr/packages/zambdas/src')
    files = list(base.rglob('*.ts'))

    modified = 0
    for fp in sorted(files):
        if process_file(fp):
            print(f'  Cleaned: {fp.relative_to(base)}')
            modified += 1

    print(f'\nTotal cleaned: {modified}')


if __name__ == '__main__':
    main()
