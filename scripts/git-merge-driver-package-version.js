#!/usr/bin/env node

/**
 * Git merge driver for automatically resolving version conflicts in package.json and package-lock.json
 * Always selects the greater version when there's a conflict
 *
 * This driver:
 * 1. Uses git merge-file to properly merge all changes from base, ours, and theirs
 * 2. Then resolves ONLY the version conflict by choosing the greater version
 * 3. Leaves all other conflicts (if any) for manual resolution
 *
 * Usage:
 * 1. git config merge.package-version.driver 'node scripts/git-merge-driver-package-version.js %O %A %B'
 * 2. Add to .gitattributes: package.json merge=package-version and package-lock.json merge=package-version
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Arguments from git: %O (base), %A (ours - this is what we update), %B (theirs)
const [, , baseFile, oursFile, theirsFile] = process.argv;

if (!baseFile || !oursFile || !theirsFile) {
  console.error('Usage: git-merge-driver-package-version.js <base> <ours> <theirs>');
  console.error(`Received ${process.argv.length - 2} arguments: ${process.argv.slice(2).join(', ')}`);
  process.exit(1);
}

console.error(`[git-merge-driver] Base file: ${baseFile}`);
console.error(`[git-merge-driver] Ours file: ${oursFile}`);
console.error(`[git-merge-driver] Theirs file: ${theirsFile}`);

// Function to compare versions (semver)
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

// Function to extract version from JSON content
function extractVersion(content) {
  const match = content.match(/"version":\s*"([^"]+)"/);
  return match ? match[1] : null;
}

// Function to resolve version conflicts in merged content
function resolveVersionConflict(content, maxVersion) {
  // Pattern to find version conflicts
  const versionConflictPattern =
    /<<<<<<< [^\n]*\s*"version":\s*"([^"]+)"[,\s]*=======\s*"version":\s*"([^"]+)"[,\s]*>>>>>>> [^\n]*/g;

  let resolved = content.replace(versionConflictPattern, (match, v1, v2) => {
    console.error(`[git-merge-driver] Found version conflict: ${v1} vs ${v2}`);
    console.error(`[git-merge-driver] Resolving to: ${maxVersion}`);
    // Determine if there should be a comma (check original match)
    const hasComma = match.includes(',');
    return `"version": "${maxVersion}"${hasComma ? ',' : ''}`;
  });

  return resolved;
}

try {
  // Read all three files to extract versions first
  const baseContent = fs.existsSync(baseFile) ? fs.readFileSync(baseFile, 'utf8') : '';
  const oursContent = fs.existsSync(oursFile) ? fs.readFileSync(oursFile, 'utf8') : '';
  const theirsContent = fs.existsSync(theirsFile) ? fs.readFileSync(theirsFile, 'utf8') : '';

  // Extract versions
  const baseVersion = extractVersion(baseContent);
  const oursVersion = extractVersion(oursContent);
  const theirsVersion = extractVersion(theirsContent);

  console.error(`[git-merge-driver] Base version: ${baseVersion || 'N/A'}`);
  console.error(`[git-merge-driver] Ours version: ${oursVersion || 'N/A'}`);
  console.error(`[git-merge-driver] Theirs version: ${theirsVersion || 'N/A'}`);

  // Determine the maximum version
  let maxVersion = oursVersion;
  if (oursVersion && theirsVersion) {
    const comparison = compareVersions(oursVersion, theirsVersion);
    maxVersion = comparison > 0 ? oursVersion : theirsVersion;
    console.error(`[git-merge-driver] Maximum version: ${maxVersion}`);
  }

  // Use git merge-file to do a proper 3-way merge
  // This will merge all changes, not just the version
  // -p flag outputs to stdout, --diff3 shows base in conflicts
  let mergedContent;
  let mergeExitCode = 0;

  try {
    // git merge-file modifies the second file in place and returns:
    // 0 = clean merge
    // >0 = number of conflicts
    // <0 = error

    // Create a copy of ours file to merge into
    const tempOursFile = oursFile + '.merge-temp';
    fs.copyFileSync(oursFile, tempOursFile);

    try {
      execSync(`git merge-file -L "ours" -L "base" -L "theirs" "${tempOursFile}" "${baseFile}" "${theirsFile}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      mergeExitCode = 0;
    } catch (e) {
      // git merge-file returns non-zero if there are conflicts
      mergeExitCode = e.status || 1;
    }

    mergedContent = fs.readFileSync(tempOursFile, 'utf8');
    fs.unlinkSync(tempOursFile); // Clean up temp file

    console.error(`[git-merge-driver] git merge-file exit code: ${mergeExitCode}`);
  } catch (e) {
    console.error(`[git-merge-driver] git merge-file failed: ${e.message}`);
    // Fallback: just use ours content
    mergedContent = oursContent;
  }

  // Check if there are any conflicts in the merged content
  const hasConflicts = /<<<<<<< /.test(mergedContent);
  console.error(`[git-merge-driver] Merged content has conflicts: ${hasConflicts}`);

  // Resolve version conflicts specifically (choose max version)
  if (hasConflicts && maxVersion) {
    mergedContent = resolveVersionConflict(mergedContent, maxVersion);
  }

  // If there are no conflicts but versions differ, update to max version
  if (!hasConflicts && oursVersion && theirsVersion && oursVersion !== theirsVersion) {
    if (extractVersion(mergedContent) !== maxVersion) {
      console.error(`[git-merge-driver] Updating version to ${maxVersion}`);
      mergedContent = mergedContent.replace(/"version":\s*"[^"]+"/, `"version": "${maxVersion}"`);
    }
  }

  // Check if there are still conflicts (non-version conflicts)
  const stillHasConflicts = /<<<<<<< /.test(mergedContent);

  // Write the result
  fs.writeFileSync(oursFile, mergedContent, 'utf8');

  if (stillHasConflicts) {
    console.error(`[git-merge-driver] WARNING: Non-version conflicts remain in the file`);
    // Return non-zero to indicate conflicts remain
    process.exit(1);
  }

  console.error(`[git-merge-driver] Merge completed successfully`);
  process.exit(0);
} catch (error) {
  console.error(`[git-merge-driver] Error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}
