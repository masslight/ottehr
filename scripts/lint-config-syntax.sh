#!/bin/bash

set -eo pipefail

# This script will look for malformed var and ref syntax in provided file and exit 1 if one is found.

# Check if the number of arguments is less than 2
if [ $# -lt 1 ]; then
    echo "Usage: $0 <file>"
    exit 1
fi

# Check if the file exists
if [ ! -f $1 ]; then
    echo "Error: File $1 does not exist."
    exit 1
fi

# Search for the text in the file
while read -r line ; do
    # Explicit lower case and upper case comparisons for portability
    echo "Error: Invalid #{var/*} reference found in $1."
    echo ""
    echo "  $line"
    echo ""
    exit 1
done < <(grep -i \
    -e "[^#][^{]var\/" \
    -e "#{var\/[^}]*\"" \
    -e "\${*var\/.*" \
    $1)
# in order, these are:
#   - var with incomplete leading #{
#   - var with no trailing }
#   - var with leading tf-style ${ (tf doesn't use /)

# Search for the text in the file
while read -r line ; do
    # Explicit lower case and upper case comparisons for portability
    echo "Error: Invalid #{ref/*/*/*} reference found in $1."
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
    $1)
# in order, these are:
#   - ref with incomplete leading #{
#   - ref with no trailing }
#   - ref with leading tf-style ${ (tf doesn't use /)
#   - ref with only 1 segment
#   - ref with only 2 segments

exit 0