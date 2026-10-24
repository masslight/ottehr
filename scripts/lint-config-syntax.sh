#!/bin/bash

set -eo pipefail

# This script will look for malformed var and ref syntax in the provided files and exit 1 if one is found.
# lint-staged passes every staged file matching its glob, so each argument is checked in turn.

if [ $# -lt 1 ]; then
    echo "Usage: $0 <file> [<file> ...]"
    exit 1
fi

check_file() {
    local file=$1

    # Check if the file exists
    if [ ! -f "$file" ]; then
        echo "Error: File $file does not exist."
        exit 1
    fi

    # Search for the text in the file
    while read -r line ; do
        # Explicit lower case and upper case comparisons for portability
        echo "Error: Invalid #{var/*} reference found in $file."
        echo ""
        echo "  $line"
        echo ""
        exit 1
    done < <(grep -i \
        -e "[^#][^{]var\/" \
        -e "#{var\/[^}]*\"" \
        -e "\${*var\/.*" \
        "$file")
    # in order, these are:
    #   - var with incomplete leading #{
    #   - var with no trailing }
    #   - var with leading tf-style ${ (tf doesn't use /)

    # Search for the text in the file
    while read -r line ; do
        # Explicit lower case and upper case comparisons for portability
        echo "Error: Invalid #{ref/*/*/*} reference found in $file."
        echo ""
        echo "  $line"
        echo ""
        exit 1
    done < <(grep -i \
        -e "[^#][^{]ref\/" \
        -e "#{ref\/[^}]*\"" \
        -e "\${*ref\/.*" \
        -e "\#{ref\/[^}\/]*}" \
        -e "\#{ref\/[^}\/]*\/[^}\/]*}" \
        "$file")
    # in order, these are:
    #   - ref with incomplete leading #{
    #   - ref with no trailing }
    #   - ref with leading tf-style ${ (tf doesn't use /)
    #   - ref with only 1 segment
    #   - ref with only 2 segments
}

for file in "$@"; do
    check_file "$file"
done

exit 0
