/**
 * Utility for analyzing where files from a directory are being used
 *
 * Scans a target directory and checks if its files are imported
 * in pattern directories to categorize them for refactoring.
 *
 * ANALYSIS LOGIC:
 *
 * 1. DIRECT USAGE:
 *    Files that are directly imported in pattern directories.
 *    Example: pattern1/Component.tsx imports target/utils.ts
 *    → utils.ts has direct usage in pattern1
 *
 * 2. TRANSITIVE USAGE:
 *    Files used through import chains (any depth).
 *    Example:
 *      - pattern1/Component.tsx imports target/hooks.ts
 *      - target/hooks.ts imports target/utils.ts
 *    → utils.ts has transitive usage in pattern1 (through hooks.ts)
 *
 * 3. STRICT MODE (default, --strict true):
 *    Detects cross-pattern dependencies in import chains.
 *    Example:
 *      - File A used in pattern1
 *      - File A → imports B → imports C → imports D
 *      - File D used in pattern2
 *    → ALL files (A, B, C, D) marked as "BOTH" (common)
 *
 *    This ensures proper dependency placement and prevents broken imports
 *    when splitting code into separate packages.
 *
 * 4. NON-STRICT MODE (--strict false):
 *    Files categorized only by their direct and transitive usage,
 *    ignoring cross-pattern dependency chains.
 *
 * CATEGORIZATION:
 *   - "Only pattern1": Used exclusively in pattern1 (no pattern2 usage)
 *   - "Only pattern2": Used exclusively in pattern2 (no pattern1 usage)
 *   - "BOTH": Used in both patterns OR has cross-pattern dependencies (strict mode)
 *   - "Unused": Not used in either pattern directory
 *
 * Usage:
 *   node analyze-directory-usage.js --target <dir> --pattern1-dir <dir1> --pattern2-dir <dir2> [--strict true|false] [--verbose true] [--ignore patterns]
 *
 * Examples:
 *   # Default (strict mode enabled, non-verbose)
 *   node scripts/refactoring/analyze-directory-usage.js --target apps/ehr/src/features/visits/shared --pattern1-dir apps/ehr/src/features/visits/in-person --pattern2-dir apps/ehr/src/features/visits/telemed
 *
 *   # Verbose output (shows detailed import locations)
 *   node scripts/refactoring/analyze-directory-usage.js --target apps/ehr/src/features/visits/shared --pattern1-dir apps/ehr/src/features/visits/in-person --pattern2-dir apps/ehr/src/features/visits/telemed --verbose true
 *
 *   # Non-strict mode (ignore cross-pattern dependencies)
 *   node scripts/refactoring/analyze-directory-usage.js --target apps/ehr/src/features/visits/shared --pattern1-dir apps/ehr/src/features/visits/in-person --pattern2-dir apps/ehr/src/features/visits/telemed --strict false
 *
 *   # With custom ignore patterns
 *   node scripts/refactoring/analyze-directory-usage.js --target apps/ehr/src/features/visits/shared --pattern1-dir apps/ehr/src/features/visits/in-person --pattern2-dir apps/ehr/src/features/visits/telemed --ignore "*.test.ts,*.spec.ts"
 */

const fs = require('fs');
const path = require('path');

// === SETTINGS ===
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Parse command line arguments
const args = process.argv.slice(2);

function getArgValue(flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

const TARGET_DIR = getArgValue('--target');
const PATTERN1_DIR = getArgValue('--pattern1-dir');
const PATTERN2_DIR = getArgValue('--pattern2-dir');
const STRICT_MODE = getArgValue('--strict') !== 'false'; // Default is true
const VERBOSE = getArgValue('--verbose') === 'true'; // Default is false

// Default settings
let IGNORE_PATTERNS = ['node_modules', '.*', '*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'];

// Check for --ignore flag
const ignoreValue = getArgValue('--ignore');
if (ignoreValue) {
  const customPatterns = ignoreValue.split(',').map((p) => p.trim());
  IGNORE_PATTERNS = customPatterns;
}

// Validate input
if (!TARGET_DIR || !PATTERN1_DIR || !PATTERN2_DIR) {
  console.error('\n❌ Error: Please provide all required directories\n');
  console.log(
    'Usage: node analyze-directory-usage.js --target <dir> --pattern1-dir <dir1> --pattern2-dir <dir2> [--strict true|false] [--verbose true] [--ignore patterns]\n'
  );
  console.log('Examples:');
  console.log(
    '  node analyze-directory-usage.js --target apps/common --pattern1-dir apps/in-person --pattern2-dir apps/telemed'
  );
  console.log(
    '  node analyze-directory-usage.js --target apps/common --pattern1-dir apps/in-person --pattern2-dir apps/telemed --verbose true'
  );
  console.log(
    '  node analyze-directory-usage.js --target apps/common --pattern1-dir apps/in-person --pattern2-dir apps/telemed --strict false'
  );
  console.log(
    '  node analyze-directory-usage.js --target packages/ui --pattern1-dir apps/in-person --pattern2-dir apps/telemed --ignore "*.test.ts"\n'
  );
  process.exit(1);
}

if (!fs.existsSync(TARGET_DIR)) {
  console.error(`\n❌ Error: Target directory "${TARGET_DIR}" does not exist\n`);
  process.exit(1);
}

if (!fs.existsSync(PATTERN1_DIR)) {
  console.error(`\n❌ Error: Pattern 1 directory "${PATTERN1_DIR}" does not exist\n`);
  process.exit(1);
}

if (!fs.existsSync(PATTERN2_DIR)) {
  console.error(`\n❌ Error: Pattern 2 directory "${PATTERN2_DIR}" does not exist\n`);
  process.exit(1);
}

// Normalize paths for comparison
const normalizedTargetDir = path.resolve(TARGET_DIR).replace(/\\/g, '/');
const normalizedPattern1Dir = path.resolve(PATTERN1_DIR).replace(/\\/g, '/');
const normalizedPattern2Dir = path.resolve(PATTERN2_DIR).replace(/\\/g, '/');

// Check if path matches any ignore pattern
function shouldIgnorePath(pathStr) {
  const fileName = path.basename(pathStr);
  const fullPath = pathStr;

  return IGNORE_PATTERNS.some((pattern) => {
    // Match exact directory name
    if (fullPath.includes(path.sep + pattern + path.sep) || fullPath.endsWith(path.sep + pattern)) {
      return true;
    }

    // Match pattern with wildcards
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$');
    if (regex.test(fileName)) {
      return true;
    }

    // Match hidden files/folders
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

// Extract all imports from file content (handles multiline imports)
function extractImports(content) {
  const imports = [];

  // Remove comments
  const withoutComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
    .replace(/\/\/.*/g, ''); // Remove // comments

  // Match import statements (including multiline)
  const importRegex =
    /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(withoutComments)) !== null) {
    imports.push(match[1]);
  }

  // Also handle dynamic imports
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(withoutComments)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

// Find project root by looking for common markers
function findProjectRoot(startPath) {
  let currentPath = startPath;
  const root = path.parse(currentPath).root;

  while (currentPath !== root) {
    // Check for common project root indicators
    if (
      fs.existsSync(path.join(currentPath, 'package.json')) ||
      fs.existsSync(path.join(currentPath, 'tsconfig.json')) ||
      fs.existsSync(path.join(currentPath, 'node_modules'))
    ) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }

  return startPath;
}

// Detect src directory from file path
function findSrcDirectory(filePath) {
  const parts = filePath.split(path.sep);
  const srcIndex = parts.indexOf('src');

  if (srcIndex !== -1) {
    return parts.slice(0, srcIndex + 1).join(path.sep);
  }

  // If no src directory, use project root
  return findProjectRoot(filePath);
}

// Resolve import path relative to file location
function resolveImportPath(importPath, fromFile) {
  let resolved;

  // Handle relative imports (./  ../)
  if (importPath.startsWith('.')) {
    const fileDir = path.dirname(fromFile);
    resolved = path.resolve(fileDir, importPath);
  }
  // Handle src/ alias
  else if (importPath.startsWith('src/')) {
    const srcDir = findSrcDirectory(fromFile);
    const relativePath = importPath.substring(4); // Remove 'src/'
    resolved = path.join(srcDir, relativePath);
  }
  // Handle @/ alias (commonly maps to src/)
  else if (importPath.startsWith('@/')) {
    const srcDir = findSrcDirectory(fromFile);
    const relativePath = importPath.substring(2); // Remove '@/'
    resolved = path.join(srcDir, relativePath);
  }
  // Skip other absolute imports (node_modules, etc.)
  else {
    return null;
  }

  // Try adding common extensions if file doesn't exist
  const possiblePaths = [
    resolved,
    resolved + '.ts',
    resolved + '.tsx',
    resolved + '.js',
    resolved + '.jsx',
    path.join(resolved, 'index.ts'),
    path.join(resolved, 'index.tsx'),
    path.join(resolved, 'index.js'),
    path.join(resolved, 'index.jsx'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return path.resolve(p).replace(/\\/g, '/');
    }
  }

  // Return resolved path even if file doesn't exist
  return path.resolve(resolved).replace(/\\/g, '/');
}

// Check if resolved path is within target directory
function isTargetFile(resolvedPath, targetDir) {
  if (!resolvedPath) return false;
  const normalized = resolvedPath.replace(/\\/g, '/');
  const normalizedTarget = targetDir.replace(/\\/g, '/');
  return normalized.startsWith(normalizedTarget);
}

// Find where target file is used
function findFileUsage(targetFile, patternFiles) {
  const usedIn = [];

  for (const patternFile of patternFiles) {
    try {
      const content = fs.readFileSync(patternFile, 'utf8');
      const imports = extractImports(content);

      for (const imp of imports) {
        const resolved = resolveImportPath(imp, patternFile);
        if (resolved === targetFile) {
          usedIn.push(patternFile);
          break;
        }
      }
    } catch (err) {
      console.error(`Error reading ${patternFile}:`, err.message);
    }
  }

  return usedIn;
}

// Build dependency graph for target files
function buildDependencyGraph(targetFiles) {
  const graph = new Map();

  for (const targetFile of targetFiles) {
    const normalizedTarget = path.resolve(targetFile).replace(/\\/g, '/');

    try {
      const content = fs.readFileSync(targetFile, 'utf8');
      const imports = extractImports(content);
      const dependencies = [];

      for (const imp of imports) {
        const resolved = resolveImportPath(imp, targetFile);
        // Only track dependencies within target directory
        if (resolved && isTargetFile(resolved, normalizedTargetDir)) {
          dependencies.push(resolved);
        }
      }

      graph.set(normalizedTarget, dependencies);
    } catch (err) {
      console.error(`Error reading ${targetFile}:`, err.message);
      graph.set(normalizedTarget, []);
    }
  }

  return graph;
}

// Recursively find all dependencies of a file
function findAllDependencies(file, graph, visited = new Set()) {
  if (visited.has(file)) return visited;
  visited.add(file);

  const dependencies = graph.get(file) || [];
  for (const dep of dependencies) {
    findAllDependencies(dep, graph, visited);
  }

  return visited;
}

// Analyze target directory
function analyzeTargetDirectory() {
  console.log('📦 Getting files from target directory...');
  const targetFiles = getAllFiles(normalizedTargetDir);

  console.log('📦 Getting files from pattern 1 directory...');
  const pattern1Files = getAllFiles(normalizedPattern1Dir);

  console.log('📦 Getting files from pattern 2 directory...');
  const pattern2Files = getAllFiles(normalizedPattern2Dir);

  console.log(`\n✅ Target files: ${targetFiles.length}`);
  console.log(`✅ Pattern 1 files: ${pattern1Files.length}`);
  console.log(`✅ Pattern 2 files: ${pattern2Files.length}\n`);

  console.log('🔍 Building dependency graph...\n');
  const dependencyGraph = buildDependencyGraph(targetFiles);

  console.log('🔍 Analyzing direct usage...\n');

  // First pass: find direct usage
  const directUsage = new Map();
  let processed = 0;

  for (const targetFile of targetFiles) {
    processed++;
    if (processed % 10 === 0 || processed === targetFiles.length) {
      process.stdout.write(`\r   Processed: ${processed}/${targetFiles.length} files`);
    }

    const normalizedTarget = path.resolve(targetFile).replace(/\\/g, '/');

    const usedInPattern1 = findFileUsage(normalizedTarget, pattern1Files);
    const usedInPattern2 = findFileUsage(normalizedTarget, pattern2Files);

    directUsage.set(normalizedTarget, {
      pattern1: usedInPattern1,
      pattern2: usedInPattern2,
    });
  }

  console.log('\n');
  console.log('🔍 Analyzing transitive dependencies...\n');

  // Second pass: propagate usage through dependencies
  const finalUsage = new Map();

  for (const targetFile of targetFiles) {
    const normalizedTarget = path.resolve(targetFile).replace(/\\/g, '/');
    const direct = directUsage.get(normalizedTarget);

    let usedInPattern1 = [...direct.pattern1];
    let usedInPattern2 = [...direct.pattern2];
    let reasons = { pattern1: [], pattern2: [] };

    // Check if any file that imports this file (directly or transitively) is used in patterns
    for (const [otherFile, otherDirect] of directUsage.entries()) {
      if (otherFile === normalizedTarget) continue;

      const dependencies = findAllDependencies(otherFile, dependencyGraph);
      if (dependencies.has(normalizedTarget)) {
        // This file is a dependency of otherFile
        if (otherDirect.pattern1.length > 0) {
          usedInPattern1.push(`${otherFile} (transitive)`);
          reasons.pattern1.push(otherFile);
        }
        if (otherDirect.pattern2.length > 0) {
          usedInPattern2.push(`${otherFile} (transitive)`);
          reasons.pattern2.push(otherFile);
        }
      }
    }

    // STRICT MODE: Check cross-pattern dependencies recursively
    if (STRICT_MODE) {
      // Get ALL dependencies of this file (recursive)
      const myDependencies = findAllDependencies(normalizedTarget, dependencyGraph);
      myDependencies.delete(normalizedTarget); // Remove self

      let hasDepsInPattern1 = false;
      let hasDepsInPattern2 = false;

      // Check if ANY dependency (at any depth) is used in the other pattern
      for (const dep of myDependencies) {
        // For each dependency, check if IT or any of ITS dependencies are used in patterns
        const depDependencies = findAllDependencies(dep, dependencyGraph);

        for (const transitiveDep of depDependencies) {
          const depUsage = directUsage.get(transitiveDep);
          if (depUsage) {
            if (depUsage.pattern1.length > 0) hasDepsInPattern1 = true;
            if (depUsage.pattern2.length > 0) hasDepsInPattern2 = true;
          }
        }

        // Also check the dependency itself
        const depUsage = directUsage.get(dep);
        if (depUsage) {
          if (depUsage.pattern1.length > 0) hasDepsInPattern1 = true;
          if (depUsage.pattern2.length > 0) hasDepsInPattern2 = true;
        }
      }

      // If file is used in pattern1 but depends on files used in pattern2 (at any depth), mark as both
      if (usedInPattern1.length > 0 && hasDepsInPattern2) {
        usedInPattern2.push('(cross-pattern dependency: file depends on pattern2 files)');
      }

      // If file is used in pattern2 but depends on files used in pattern1 (at any depth), mark as both
      if (usedInPattern2.length > 0 && hasDepsInPattern1) {
        usedInPattern1.push('(cross-pattern dependency: file depends on pattern1 files)');
      }
    }

    // Remove duplicates
    usedInPattern1 = [...new Set(usedInPattern1)];
    usedInPattern2 = [...new Set(usedInPattern2)];

    finalUsage.set(normalizedTarget, {
      usedInPattern1,
      usedInPattern2,
    });
  }

  // Categorize files with more granular classification
  const onlyPattern1Direct = [];
  const onlyPattern2Direct = [];
  const bothDirect = [];
  const transitive = [];
  const unused = [];

  for (const targetFile of targetFiles) {
    const normalizedTarget = path.resolve(targetFile).replace(/\\/g, '/');
    const usage = finalUsage.get(normalizedTarget);

    const directUses1 = usage.usedInPattern1.filter((u) => !u.includes('transitive') && !u.includes('cross-pattern'));
    const transitiveUses1 = usage.usedInPattern1.filter((u) => u.includes('transitive'));
    const crossPattern1 = usage.usedInPattern1.filter((u) => u.includes('cross-pattern'));

    const directUses2 = usage.usedInPattern2.filter((u) => !u.includes('transitive') && !u.includes('cross-pattern'));
    const transitiveUses2 = usage.usedInPattern2.filter((u) => u.includes('transitive'));
    const crossPattern2 = usage.usedInPattern2.filter((u) => u.includes('cross-pattern'));

    const hasDirect1 = directUses1.length > 0;
    const hasDirect2 = directUses2.length > 0;
    const hasAny1 = hasDirect1 || transitiveUses1.length > 0 || crossPattern1.length > 0;
    const hasAny2 = hasDirect2 || transitiveUses2.length > 0 || crossPattern2.length > 0;

    const fileInfo = {
      file: targetFile,
      directUses1,
      directUses2,
      transitiveUses1,
      transitiveUses2,
      crossPattern1,
      crossPattern2,
    };

    // Classification logic
    if (!hasAny1 && !hasAny2) {
      // Not used anywhere
      unused.push(fileInfo);
    } else if (hasAny1 && hasAny2) {
      // Used in both patterns (direct or transitive)
      if (hasDirect1 && hasDirect2) {
        // Direct in both
        bothDirect.push(fileInfo);
      } else {
        // At least one is transitive
        transitive.push(fileInfo);
      }
    } else if (hasAny1) {
      // Only in pattern1
      if (hasDirect1 && !transitiveUses1.length && !crossPattern1.length) {
        // Pure direct usage only
        onlyPattern1Direct.push(fileInfo);
      } else {
        // Has transitive or cross-pattern
        transitive.push(fileInfo);
      }
    } else if (hasAny2) {
      // Only in pattern2
      if (hasDirect2 && !transitiveUses2.length && !crossPattern2.length) {
        // Pure direct usage only
        onlyPattern2Direct.push(fileInfo);
      } else {
        // Has transitive or cross-pattern
        transitive.push(fileInfo);
      }
    }
  }

  console.log('\n');

  return { onlyPattern1Direct, onlyPattern2Direct, bothDirect, transitive, unused };
}

// Print results
function printResults(results) {
  const { onlyPattern1Direct, onlyPattern2Direct, bothDirect, transitive, unused } = results;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 USAGE ANALYSIS RESULTS`);
  console.log('='.repeat(80));

  // Section 1: Only Pattern 1 (Direct)
  console.log(`\n${'─'.repeat(80)}`);
  console.log(
    `🟦 ONLY ${path.basename(PATTERN1_DIR).toUpperCase()} (Direct usage only) - ${onlyPattern1Direct.length} files`
  );
  console.log(`${'─'.repeat(80)}`);
  console.log('These files are used directly only in pattern1 and can stay pattern1-specific.\n');

  if (onlyPattern1Direct.length > 0) {
    onlyPattern1Direct.forEach(({ file, directUses1 }) => {
      console.log(`📄 ${file}`);
      if (VERBOSE) {
        console.log(`   Direct imports (${directUses1.length}):`);
        if (directUses1.length <= 5) {
          directUses1.forEach((f) => console.log(`     • ${f}`));
        } else {
          directUses1.slice(0, 3).forEach((f) => console.log(`     • ${f}`));
          console.log(`     ... and ${directUses1.length - 3} more`);
        }
      } else {
        console.log(`   → ${directUses1.length} direct import(s)`);
      }
      console.log('');
    });
  } else {
    console.log('(none)\n');
  }

  // Section 2: Only Pattern 2 (Direct)
  console.log(`${'─'.repeat(80)}`);
  console.log(
    `🟩 ONLY ${path.basename(PATTERN2_DIR).toUpperCase()} (Direct usage only) - ${onlyPattern2Direct.length} files`
  );
  console.log(`${'─'.repeat(80)}`);
  console.log('These files are used directly only in pattern2 and can stay pattern2-specific.\n');

  if (onlyPattern2Direct.length > 0) {
    onlyPattern2Direct.forEach(({ file, directUses2 }) => {
      console.log(`📄 ${file}`);
      if (VERBOSE) {
        console.log(`   Direct imports (${directUses2.length}):`);
        if (directUses2.length <= 5) {
          directUses2.forEach((f) => console.log(`     • ${f}`));
        } else {
          directUses2.slice(0, 3).forEach((f) => console.log(`     • ${f}`));
          console.log(`     ... and ${directUses2.length - 3} more`);
        }
      } else {
        console.log(`   → ${directUses2.length} direct import(s)`);
      }
      console.log('');
    });
  } else {
    console.log('(none)\n');
  }

  // Section 3: Both (Direct)
  console.log(`${'─'.repeat(80)}`);
  console.log(`🟨 USED IN BOTH (Direct usage) - ${bothDirect.length} files`);
  console.log(`${'─'.repeat(80)}`);
  console.log('⚠️  These files are DIRECTLY imported in BOTH patterns.');
  console.log('    They MUST be extracted to a common package!\n');

  if (bothDirect.length > 0) {
    bothDirect.forEach(({ file, directUses1, directUses2 }) => {
      console.log(`📦 ${file}`);
      if (VERBOSE) {
        console.log(`   ${path.basename(PATTERN1_DIR)} - Direct imports (${directUses1.length}):`);
        if (directUses1.length <= 3) {
          directUses1.forEach((f) => console.log(`     • ${f}`));
        } else {
          directUses1.slice(0, 2).forEach((f) => console.log(`     • ${f}`));
          console.log(`     ... and ${directUses1.length - 2} more`);
        }
        console.log(`   ${path.basename(PATTERN2_DIR)} - Direct imports (${directUses2.length}):`);
        if (directUses2.length <= 3) {
          directUses2.forEach((f) => console.log(`     • ${f}`));
        } else {
          directUses2.slice(0, 2).forEach((f) => console.log(`     • ${f}`));
          console.log(`     ... and ${directUses2.length - 2} more`);
        }
      } else {
        console.log(
          `   ${path.basename(PATTERN1_DIR)}: ${directUses1.length} import(s) | ${path.basename(PATTERN2_DIR)}: ${
            directUses2.length
          } import(s)`
        );
      }
      console.log('');
    });
  } else {
    console.log('(none)\n');
  }

  // Section 4: Transitive (Complex cases)
  console.log(`${'─'.repeat(80)}`);
  console.log(`🟧 TRANSITIVE / CROSS-PATTERN USAGE - ${transitive.length} files`);
  console.log(`${'─'.repeat(80)}`);
  console.log('These files have transitive usage or cross-pattern dependencies.');
  console.log('Review carefully - they may need to be extracted to common package.\n');

  if (transitive.length > 0) {
    transitive.forEach(
      ({ file, directUses1, directUses2, transitiveUses1, transitiveUses2, crossPattern1, crossPattern2 }) => {
        console.log(`📦 ${file}`);

        // Pattern 1 usage
        if (directUses1.length > 0 || transitiveUses1.length > 0 || crossPattern1.length > 0) {
          console.log(`   ${path.basename(PATTERN1_DIR)}:`);
          if (directUses1.length > 0) {
            if (VERBOSE) {
              console.log(`     ✓ Direct imports (${directUses1.length}):`);
              if (directUses1.length <= 3) {
                directUses1.forEach((f) => console.log(`       • ${f}`));
              } else {
                directUses1.slice(0, 2).forEach((f) => console.log(`       • ${f}`));
                console.log(`       ... and ${directUses1.length - 2} more`);
              }
            } else {
              console.log(`     ✓ Direct: ${directUses1.length} import(s)`);
            }
          }
          if (transitiveUses1.length > 0) {
            console.log(`     ↪ Transitive: ${transitiveUses1.length} file(s)`);
          }
          if (crossPattern1.length > 0) {
            console.log(`     ⚠️  Cross-pattern dependency detected`);
          }
        }

        // Pattern 2 usage
        if (directUses2.length > 0 || transitiveUses2.length > 0 || crossPattern2.length > 0) {
          console.log(`   ${path.basename(PATTERN2_DIR)}:`);
          if (directUses2.length > 0) {
            if (VERBOSE) {
              console.log(`     ✓ Direct imports (${directUses2.length}):`);
              if (directUses2.length <= 3) {
                directUses2.forEach((f) => console.log(`       • ${f}`));
              } else {
                directUses2.slice(0, 2).forEach((f) => console.log(`       • ${f}`));
                console.log(`       ... and ${directUses2.length - 2} more`);
              }
            } else {
              console.log(`     ✓ Direct: ${directUses2.length} import(s)`);
            }
          }
          if (transitiveUses2.length > 0) {
            console.log(`     ↪ Transitive: ${transitiveUses2.length} file(s)`);
          }
          if (crossPattern2.length > 0) {
            console.log(`     ⚠️  Cross-pattern dependency detected`);
          }
        }

        console.log('');
      }
    );
  } else {
    console.log('(none)\n');
  }

  // Section 5: Unused
  console.log(`${'─'.repeat(80)}`);
  console.log(`⚪ NOT USED - ${unused.length} files`);
  console.log(`${'─'.repeat(80)}`);
  console.log('These files are not used in either pattern directory.');
  console.log('They might be dead code or used in other parts of the codebase.\n');

  if (unused.length > 0) {
    unused.forEach(({ file }) => console.log(`📄 ${file}`));
    console.log('');
  } else {
    console.log('(none)\n');
  }

  // Summary
  console.log(`${'='.repeat(80)}`);
  console.log('📈 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Only ${path.basename(PATTERN1_DIR)} (direct): ${onlyPattern1Direct.length}`);
  console.log(`Only ${path.basename(PATTERN2_DIR)} (direct): ${onlyPattern2Direct.length}`);
  console.log(`Both patterns (direct): ${bothDirect.length}`);
  console.log(`Transitive/Cross-pattern: ${transitive.length}`);
  console.log(`Not used: ${unused.length}`);
  console.log(
    `Total analyzed: ${
      onlyPattern1Direct.length + onlyPattern2Direct.length + bothDirect.length + transitive.length + unused.length
    }`
  );

  const needsCommon = bothDirect.length + transitive.length;
  if (needsCommon > 0) {
    console.log(`\n⚠️  ACTION REQUIRED: ${needsCommon} file(s) should be reviewed for common package extraction!`);
  }

  console.log('');
}

// Main execution
console.log(`\n${'='.repeat(80)}`);
console.log('🔍 DIRECTORY USAGE ANALYZER');
console.log('='.repeat(80));
console.log(`\n🎯 Target directory: "${TARGET_DIR}"`);
console.log(`   (resolved: ${normalizedTargetDir})`);
console.log(`\n🔍 Pattern 1 directory: "${PATTERN1_DIR}"`);
console.log(`   (resolved: ${normalizedPattern1Dir})`);
console.log(`\n🔍 Pattern 2 directory: "${PATTERN2_DIR}"`);
console.log(`   (resolved: ${normalizedPattern2Dir})`);
console.log(`\n⚙️  Strict mode: ${STRICT_MODE ? 'ENABLED' : 'DISABLED'}`);
if (STRICT_MODE) {
  console.log('   Files with cross-pattern dependencies will be marked as common');
}
console.log(`\n📢 Verbose mode: ${VERBOSE ? 'ENABLED' : 'DISABLED'}`);
if (!VERBOSE) {
  console.log('   Use --verbose true to see detailed import locations');
}
console.log(`\n🚫 Ignoring patterns: ${IGNORE_PATTERNS.join(', ')}\n`);

const results = analyzeTargetDirectory();
printResults(results);

console.log('✨ Done!\n');
