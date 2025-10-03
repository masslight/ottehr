/**
 * Utility for finding duplicate and similar files
 *
 * Created due to the lack of ready-made npm utilities that could
 * compare file similarity without taking imports and exports into account.
 *
 * Usage:
 *   node find-dupes.js <directory> [--ignore pattern1,pattern2,...]
 *
 * Examples:
 *   node find-dupes.js apps/ehr/src
 *   node find-dupes.js apps/ehr/src --ignore "node_modules,.*,*.test.ts"
 *   node find-dupes.js ./ --ignore "node_modules"
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// === SETTINGS ===
const EXTENSIONS = ['.ts', '.tsx'];
const SIMILARITY_THRESHOLD = 0.5; // 50% similarity threshold (0 to 1)

// Parse command line arguments
const args = process.argv.slice(2);
const DIR = args[0];

// Default ignore patterns
let IGNORE_PATTERNS = ['node_modules', '.*']; // Ignore node_modules and hidden files/folders by default

// Check for --ignore flag
const ignoreIndex = args.indexOf('--ignore');
if (ignoreIndex !== -1 && args[ignoreIndex + 1]) {
  const customPatterns = args[ignoreIndex + 1].split(',').map((p) => p.trim());
  IGNORE_PATTERNS = customPatterns;
}

if (!DIR) {
  console.error('\n❌ Error: Please provide a directory path\n');
  console.log('Usage: node find-dupes.js <directory> [--ignore pattern1,pattern2,...]\n');
  console.log('Examples:');
  console.log('  node find-dupes.js apps/ehr/src');
  console.log('  node find-dupes.js apps/ehr/src --ignore "node_modules,.*,*.test.ts"\n');
  process.exit(1);
}

if (!fs.existsSync(DIR)) {
  console.error(`\n❌ Error: Directory "${DIR}" does not exist\n`);
  process.exit(1);
}

// Check if path matches any ignore pattern
function shouldIgnorePath(pathStr) {
  const fileName = path.basename(pathStr);
  const fullPath = pathStr;

  return IGNORE_PATTERNS.some((pattern) => {
    // Match exact directory name (e.g., "node_modules")
    if (fullPath.includes(path.sep + pattern + path.sep) || fullPath.endsWith(path.sep + pattern)) {
      return true;
    }

    // Match pattern with wildcards (e.g., "*.test.ts", ".*")
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$');
    if (regex.test(fileName)) {
      return true;
    }

    // Match hidden files/folders (starting with .)
    if (pattern === '.*' && fileName.startsWith('.')) {
      return true;
    }

    return false;
  });
}

// Function to get all files
function getAllFiles(dir, files = []) {
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);

      // Skip ignored paths
      if (shouldIgnorePath(fullPath)) {
        continue;
      }

      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        getAllFiles(fullPath, files);
      } else {
        const ext = path.extname(item);
        if (EXTENSIONS.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (err) {
    console.error(`Error reading ${dir}:`, err.message);
  }
  return files;
}

// Remove imports and exports
function cleanContent(content) {
  return content
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      // Ignore imports, exports and empty lines
      return (
        trimmed &&
        !trimmed.startsWith('import ') &&
        !trimmed.startsWith('export ') &&
        !trimmed.startsWith('//') &&
        !trimmed.match(/^import\s+/) &&
        !trimmed.match(/^export\s+/)
      );
    })
    .join('\n')
    .trim();
}

// Calculate similarity between two strings (simple algorithm)
function calculateSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) return 1.0;

  const minLen = Math.min(len1, len2);
  const commonChars = minLen / maxLen;

  // More accurate comparison through Levenshtein (simplified)
  let matches = 0;
  const shorter = len1 < len2 ? str1 : str2;
  const longer = len1 >= len2 ? str1 : str2;

  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) matches++;
  }

  return matches / maxLen;
}

// Main logic
console.log(`\n🔍 Scanning ${DIR}...`);
console.log(`🚫 Ignoring patterns: ${IGNORE_PATTERNS.join(', ')}\n`);

const files = getAllFiles(DIR);
console.log(`📄 Found files: ${files.length}\n`);

const fileContents = new Map();
const hashes = new Map();

// Read files and group by hash
files.forEach((file) => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const cleaned = cleanContent(content);

    // Skip empty files (after imports and exports are removed)
    if (!cleaned || cleaned.length === 0) {
      return;
    }

    const hash = crypto.createHash('md5').update(cleaned).digest('hex');

    fileContents.set(file, cleaned);

    if (!hashes.has(hash)) {
      hashes.set(hash, []);
    }
    hashes.get(hash).push(file);
  } catch (err) {
    console.error(`Error reading ${file}:`, err.message);
  }
});

// Find exact duplicates (100% match)
console.log('=== 🎯 EXACT DUPLICATES (100%) ===\n');
let exactDupes = 0;

hashes.forEach((fileList, hash) => {
  if (fileList.length > 1) {
    exactDupes++;
    console.log(`\n📦 Group ${exactDupes} (${fileList.length} files):`);
    fileList.forEach((f) => console.log(`   ${f}`));
  }
});

if (exactDupes === 0) {
  console.log('Not found\n');
} else {
  console.log(`\n✅ Found ${exactDupes} groups of exact duplicates\n`);
}

// Find similar files (by threshold)
if (SIMILARITY_THRESHOLD < 1.0) {
  console.log(`\n=== 🔎 SIMILAR FILES (>${SIMILARITY_THRESHOLD * 100}% similarity) ===\n`);

  const checked = new Set();
  let similarCount = 0;

  const allFiles = Array.from(fileContents.keys());

  for (let i = 0; i < allFiles.length; i++) {
    for (let j = i + 1; j < allFiles.length; j++) {
      const file1 = allFiles[i];
      const file2 = allFiles[j];
      const pair = [file1, file2].sort().join('|');

      if (checked.has(pair)) continue;
      checked.add(pair);

      const content1 = fileContents.get(file1);
      const content2 = fileContents.get(file2);

      // Quick check by length
      const lenDiff = Math.abs(content1.length - content2.length);
      const maxLen = Math.max(content1.length, content2.length);
      const lenSimilarity = 1 - lenDiff / maxLen;

      if (lenSimilarity >= SIMILARITY_THRESHOLD) {
        // More accurate check
        const similarity = calculateSimilarity(content1, content2);

        if (similarity >= SIMILARITY_THRESHOLD) {
          similarCount++;
          console.log(`\n🔗 Similarity: ${(similarity * 100).toFixed(1)}%`);
          console.log(`   ${file1}`);
          console.log(`   ${file2}`);
        }
      }
    }
  }

  if (similarCount === 0) {
    console.log('Not found\n');
  } else {
    console.log(`\n✅ Found ${similarCount} pairs of similar files\n`);
  }
}

console.log('\n✨ Done!\n');

// Exit with error code if duplicates found (for CI)
if (exactDupes > 0) {
  console.error('❌ CI Check Failed: Exact duplicates found!\n');
  process.exit(1);
}

console.log('✅ CI Check Passed: No exact duplicates found\n');
process.exit(0);
