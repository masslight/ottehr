/**
 * Utility for finding and removing broken imports
 *
 * Finds all imports that point to non-existent files/modules
 * or import non-existent exports, and removes those import lines.
 * Logs all removed imports to a file.
 *
 * IMPORTANT LIMITATIONS:
 * - Only supports standard ES6 import syntax (import/export statements)
 * - Does NOT support: require(), dynamic imports (import()), or CommonJS
 * - Files with re-exports are SKIPPED for export validation (exports might
 *   come from external sources that can't be fully traced)
 * - Only validates exports that are directly visible in the target file
 * - Complex re-export chains may cause false negatives (missing broken imports)
 *
 * Use case: Refactoring or removing re-exports that result in many broken imports
 * across the project. After running this script, you can review uncommitted changes
 * in your IDE, auto-import missing dependencies, and verify everything is correct.
 *
 * Usage:
 * node fix-imports.js <directory> [--ignore pattern1,pattern2,...] [--dry-run] [--alias prefix1,prefix2,...] [--log filename]
 *
 * Options:
 * --dry-run          Show what would be removed without modifying files
 * --ignore patterns  Comma-separated patterns to ignore (default: node_modules,.*)
 * --alias prefixes   Comma-separated project alias prefixes (default: src/)
 * --log filename     Log file name (default: removed-imports.log)
 *
 * Examples:
 * node fix-imports.js apps/ehr/src --dry-run   // Preview changes without modifying
 * node fix-imports.js apps/ehr/src --alias src/,@/,~/
 * node fix-imports.js apps/ehr/src --ignore node_modules,dist,.*,*.test.ts
 * node fix-imports.js apps/ehr/src --log removed-imports.txt
 */

const fs = require('fs');
const path = require('path');

// === SETTINGS ===
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// File types that are imported as default exports (e.g., via webpack/vite loaders)
const DEFAULT_EXPORT_FILE_TYPES = [
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.json',
  '.css',
  '.scss',
  '.sass',
  '.less',
];

// Parse command line arguments
const args = process.argv.slice(2);
const DIR = args[0];

// Default ignore patterns
let IGNORE_PATTERNS = ['node_modules', '.*'];

// Project alias prefixes (e.g., 'src/', '@/', '~/')
let ALIAS_PREFIXES = ['src/'];

// Log file for removed imports
let LOG_FILE = 'removed-imports.log';

// Check for --ignore flag
const ignoreIndex = args.indexOf('--ignore');
if (ignoreIndex !== -1 && args[ignoreIndex + 1]) {
  const customPatterns = args[ignoreIndex + 1].split(',').map((p) => p.trim());
  IGNORE_PATTERNS = customPatterns;
}

// Check for --alias flag
const aliasIndex = args.indexOf('--alias');
if (aliasIndex !== -1 && args[aliasIndex + 1]) {
  const customAliases = args[aliasIndex + 1].split(',').map((p) => p.trim());
  ALIAS_PREFIXES = customAliases;
}

// Check for --log flag
const logIndex = args.indexOf('--log');
if (logIndex !== -1 && args[logIndex + 1]) {
  LOG_FILE = args[logIndex + 1];
}

// Check for --dry-run flag
const DRY_RUN = args.includes('--dry-run');

if (!DIR) {
  console.error('\n❌ Error: Please provide a directory path\n');
  console.log(
    'Usage: node fix-imports.js <directory> [--ignore pattern1,pattern2,...] [--dry-run] [--alias prefix1,prefix2,...] [--log filename]\n'
  );
  console.log('Examples:');
  console.log('  node fix-imports.js apps/ehr/src --dry-run');
  console.log('  node fix-imports.js apps/ehr/src --alias src/,@/');
  console.log('  node fix-imports.js apps/ehr/src --log removed-imports.txt\n');
  process.exit(1);
}

if (!fs.existsSync(DIR)) {
  console.error(`\n❌ Error: Directory "${DIR}" does not exist\n`);
  process.exit(1);
}

// Log storage
const removedImportsLog = [];

// Cache for resolved exports to avoid circular dependencies
const exportsCache = new Map();

// Find project root (looks for package.json)
function findProjectRoot(startDir) {
  let currentDir = path.resolve(startDir);

  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // If no package.json found, use the provided directory
  return path.resolve(startDir);
}

const PROJECT_ROOT = findProjectRoot(DIR);

// Check if import path is an external package or project alias
function isExternalPackage(importPath) {
  // Relative imports (., ..)
  if (importPath.startsWith('.')) {
    return false;
  }

  // Absolute paths
  if (importPath.startsWith('/')) {
    return false;
  }

  // Check if it's a project alias
  for (const prefix of ALIAS_PREFIXES) {
    if (importPath.startsWith(prefix)) {
      return false; // It's a project alias, not external
    }
  }

  // Everything else is external package
  return true;
}

// Check if path matches any ignore pattern
function shouldIgnorePath(pathStr) {
  const fileName = path.basename(pathStr);
  const fullPath = pathStr;

  return IGNORE_PATTERNS.some((pattern) => {
    if (fullPath.includes(path.sep + pattern + path.sep) || fullPath.endsWith(path.sep + pattern)) {
      return true;
    }

    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$');
    if (regex.test(fileName)) {
      return true;
    }

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

// Parse all imports from content (handles multiline imports)
function parseImports(content) {
  const imports = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if line starts an import
    if (trimmed.startsWith('import ') || trimmed.startsWith('import{')) {
      let importStatement = line;
      let startLine = i;
      let endLine = i;

      // Check if import is complete on this line
      const hasFrom = importStatement.includes(' from ');
      const hasSemicolon = importStatement.trim().endsWith(';');
      const hasClosingQuote = /['"]$/.test(importStatement.trim().replace(/;$/, ''));

      // If import is not complete, collect multiple lines
      if (!hasSemicolon || !hasFrom || !hasClosingQuote) {
        let j = i + 1;
        while (j < lines.length) {
          importStatement += '\n' + lines[j];
          endLine = j;

          // Check if import is now complete
          if (
            lines[j].trim().endsWith(';') ||
            (importStatement.includes(' from ') && /['"][;]?$/.test(lines[j].trim()))
          ) {
            break;
          }
          j++;
        }
      }

      // Parse import details
      const parsed = parseImportStatement(importStatement);
      if (parsed) {
        imports.push({
          ...parsed,
          startLine: startLine,
          endLine: endLine,
          fullStatement: importStatement,
        });
      }

      i = endLine + 1;
    } else {
      i++;
    }
  }

  return imports;
}

// Parse import statement to extract default, named imports, and path
function parseImportStatement(statement) {
  // Extract path
  const pathMatch = statement.match(/from\s+['"]([^'"]+)['"]/);
  if (!pathMatch) {
    // Handle: import 'path'
    const directMatch = statement.match(/import\s+['"]([^'"]+)['"]/);
    if (directMatch) {
      return {
        path: directMatch[1],
        defaultImport: null,
        namedImports: [],
        namespaceImport: null,
        sideEffectOnly: true,
      };
    }
    return null;
  }

  const importPath = pathMatch[1];
  const beforeFrom = statement
    .substring(0, statement.indexOf(' from '))
    .replace(/^import\s+/, '')
    .trim();

  let defaultImport = null;
  let namedImports = [];
  let namespaceImport = null;

  // Check for namespace import: import * as Name from 'path'
  const namespaceMatch = beforeFrom.match(/\*\s+as\s+(\w+)/);
  if (namespaceMatch) {
    namespaceImport = namespaceMatch[1];
  }

  // Check for default import with named imports: import Default, { named1, named2 } from 'path'
  const defaultWithNamedMatch = beforeFrom.match(/^(\w+)\s*,\s*\{([^}]+)\}/);
  if (defaultWithNamedMatch) {
    defaultImport = defaultWithNamedMatch[1];
    const namedPart = defaultWithNamedMatch[2];
    namedImports = namedPart
      .split(',')
      .map((n) => {
        const parts = n.trim().split(/\s+as\s+/);
        return parts[0].trim();
      })
      .filter((n) => n);
  } else {
    // Check for only default import: import Default from 'path'
    const defaultOnlyMatch = beforeFrom.match(/^(\w+)$/);
    if (defaultOnlyMatch) {
      defaultImport = defaultOnlyMatch[1];
    }

    // Check for only named imports: import { named1, named2 } from 'path'
    const namedOnlyMatch = beforeFrom.match(/\{([^}]+)\}/);
    if (namedOnlyMatch) {
      const namedPart = namedOnlyMatch[1];
      namedImports = namedPart
        .split(',')
        .map((n) => {
          const parts = n.trim().split(/\s+as\s+/);
          return parts[0].trim();
        })
        .filter((n) => n);
    }
  }

  return {
    path: importPath,
    defaultImport,
    namedImports,
    namespaceImport,
    sideEffectOnly: false,
  };
}

// Resolve import path to actual file path
function resolveImportPath(importPath, sourceFile) {
  // Skip external packages
  if (isExternalPackage(importPath)) {
    return null;
  }

  const sourceDir = path.dirname(sourceFile);
  const possibleExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '.json', ...DEFAULT_EXPORT_FILE_TYPES];

  let resolvedPath;

  // Handle project aliases (e.g., 'src/', '@/')
  let isAlias = false;
  for (const prefix of ALIAS_PREFIXES) {
    if (importPath.startsWith(prefix)) {
      // Remove prefix and resolve from project root
      const pathWithoutPrefix = importPath.substring(prefix.length);
      resolvedPath = path.resolve(PROJECT_ROOT, prefix, pathWithoutPrefix);
      isAlias = true;
      break;
    }
  }

  // Handle relative imports
  if (!isAlias) {
    resolvedPath = path.resolve(sourceDir, importPath);
  }

  // Check if file exists with or without extension
  for (const ext of possibleExtensions) {
    const fullPath = resolvedPath + ext;
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }
  }

  // Check if it's a directory with index file
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
    for (const indexFile of ['index.ts', 'index.tsx', 'index.js', 'index.jsx']) {
      const indexPath = path.join(resolvedPath, indexFile);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }
  }

  return null;
}

// Check if file contains re-exports
function hasReexports(targetFile) {
  let content;
  try {
    content = fs.readFileSync(targetFile, 'utf8');
  } catch (err) {
    return false;
  }

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for any type of re-export
    if (
      /export\s+\{[^}]+\}\s+from\s+['"]/.test(trimmed) || // export { ... } from '...'
      /export\s+\*\s+from\s+['"]/.test(trimmed) || // export * from '...'
      /export\s+\*\s+as\s+\w+\s+from\s+['"]/.test(trimmed) // export * as name from '...'
    ) {
      return true;
    }
  }

  return false;
}

// Parse exports from file content (with re-export support)
function parseExports(targetFile, visitedFiles = new Set()) {
  // Check cache first
  if (exportsCache.has(targetFile)) {
    return exportsCache.get(targetFile);
  }

  // Prevent circular dependencies
  if (visitedFiles.has(targetFile)) {
    return {
      hasDefault: false,
      named: new Set(),
      hasReexports: false,
    };
  }

  visitedFiles.add(targetFile);

  const exports = {
    hasDefault: false,
    named: new Set(),
    hasReexports: false,
  };

  // Check if file is a special type that exports default (SVG, JSON, images, CSS, etc.)
  const fileExt = path.extname(targetFile);
  if (DEFAULT_EXPORT_FILE_TYPES.includes(fileExt)) {
    exports.hasDefault = true;
    // For JSON files, also check if they have actual default export structure
    if (fileExt === '.json') {
      try {
        const jsonContent = fs.readFileSync(targetFile, 'utf8');
        JSON.parse(jsonContent); // Validate it's proper JSON
      } catch (err) {
        // If JSON is invalid, don't treat it as having default export
        exports.hasDefault = false;
      }
    }
    exportsCache.set(targetFile, exports);
    return exports;
  }

  let content;
  try {
    content = fs.readFileSync(targetFile, 'utf8');
  } catch (err) {
    exportsCache.set(targetFile, exports);
    return exports;
  }

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // export default ...
    if (trimmed.startsWith('export default ')) {
      exports.hasDefault = true;
    }

    // Re-exports: export { ... } from './path'
    const reexportMatch = trimmed.match(/export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
    if (reexportMatch) {
      exports.hasReexports = true;
      const names = reexportMatch[1].split(',').map((n) => {
        const parts = n.trim().split(/\s+as\s+/);
        return parts[parts.length - 1].trim(); // Get the exported name (after 'as' if present)
      });
      names.forEach((n) => exports.named.add(n));

      // Try to resolve the re-exported file and get its exports
      const reexportPath = reexportMatch[2];
      const resolvedReexport = resolveImportPath(reexportPath, targetFile);
      if (resolvedReexport) {
        const reexportedExports = parseExports(resolvedReexport, new Set(visitedFiles));
        // Add all re-exported names
        reexportedExports.named.forEach((name) => exports.named.add(name));
      }
      // If file not found, we can't trace exports - they might exist in unresolvable files
      continue;
    }

    // Re-export all: export * from './path'
    const reexportAllMatch = trimmed.match(/export\s+\*\s+from\s+['"]([^'"]+)['"]/);
    if (reexportAllMatch) {
      exports.hasReexports = true;
      const reexportPath = reexportAllMatch[1];
      const resolvedReexport = resolveImportPath(reexportPath, targetFile);
      if (resolvedReexport) {
        const reexportedExports = parseExports(resolvedReexport, new Set(visitedFiles));
        // Add all re-exported names
        reexportedExports.named.forEach((name) => exports.named.add(name));
        // Note: export * does not re-export default
      }
      // If file not found, we can't trace exports - they might exist in unresolvable files
      continue;
    }

    // Re-export namespace: export * as name from './path'
    const reexportNamespaceMatch = trimmed.match(/export\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
    if (reexportNamespaceMatch) {
      exports.hasReexports = true;
      exports.named.add(reexportNamespaceMatch[1]);
      continue;
    }

    // Re-export default as named: export { default as Name } from './path'
    const reexportDefaultMatch = trimmed.match(/export\s+\{\s*default\s+as\s+(\w+)\s*\}\s+from\s+['"]([^'"]+)['"]/);
    if (reexportDefaultMatch) {
      exports.hasReexports = true;
      exports.named.add(reexportDefaultMatch[1]);
      continue;
    }

    // export { ... }
    const namedExportMatch = trimmed.match(/export\s+\{([^}]+)\}/);
    if (namedExportMatch && !trimmed.includes(' from ')) {
      const names = namedExportMatch[1].split(',').map((n) => {
        const parts = n.trim().split(/\s+as\s+/);
        return parts[parts.length - 1].trim(); // Get the exported name (after 'as' if present)
      });
      names.forEach((n) => exports.named.add(n));
    }

    // export const/let/var/function/class Name
    const directExportMatch = trimmed.match(/export\s+(const|let|var|function|class|interface|type|enum)\s+(\w+)/);
    if (directExportMatch) {
      exports.named.add(directExportMatch[2]);
    }

    // export type { ... } or export interface ...
    const typeExportMatch = trimmed.match(/export\s+(?:type|interface)\s+\{?([^}\s]+)/);
    if (typeExportMatch) {
      const name = typeExportMatch[1].replace(/[{,]/g, '').trim();
      if (name) exports.named.add(name);
    }
  }

  // Cache the result
  exportsCache.set(targetFile, exports);
  return exports;
}

// Validate import against exports
function validateImport(imp, sourceFile) {
  const errors = [];

  // Skip external packages
  if (isExternalPackage(imp.path)) {
    return errors;
  }

  // Resolve the file path
  const targetFile = resolveImportPath(imp.path, sourceFile);

  if (!targetFile) {
    errors.push(`File not found: ${imp.path}`);
    return errors;
  }

  // For side-effect only imports, just check file exists
  if (imp.sideEffectOnly) {
    return errors;
  }

  // For namespace imports, just check file exists
  if (imp.namespaceImport) {
    return errors;
  }

  // Parse exports from target file (with re-export support)
  const exports = parseExports(targetFile);

  // If file has re-exports, we can't reliably determine all available exports
  // because some might come from external files we can't resolve
  if (exports.hasReexports) {
    // Only report errors if we're 100% sure (file not found)
    // Don't report missing exports because they might come from re-exports
    return errors;
  }

  // Check default import
  if (imp.defaultImport && !exports.hasDefault) {
    errors.push(`No default export in ${imp.path} (importing: ${imp.defaultImport})`);
  }

  // Check named imports
  if (imp.namedImports.length > 0) {
    const missingExports = imp.namedImports.filter((name) => !exports.named.has(name));
    if (missingExports.length > 0) {
      errors.push(`Missing exports in ${imp.path}: ${missingExports.join(', ')}`);
    }
  }

  return errors;
}

// Add to log
function logRemovedImport(file, imp, errors) {
  const timestamp = new Date().toISOString();
  const lineRange =
    imp.startLine === imp.endLine ? `Line ${imp.startLine + 1}` : `Lines ${imp.startLine + 1}-${imp.endLine + 1}`;

  let logEntry = `\n${'='.repeat(80)}\n`;
  logEntry += `[${timestamp}]\n`;
  logEntry += `File: ${file}\n`;
  logEntry += `${lineRange}\n`;
  logEntry += `From: ${imp.path}\n`;

  // Show what was being imported
  const importParts = [];
  if (imp.defaultImport) importParts.push(`default: ${imp.defaultImport}`);
  if (imp.namedImports.length > 0) importParts.push(`named: {${imp.namedImports.join(', ')}}`);
  if (imp.namespaceImport) importParts.push(`namespace: * as ${imp.namespaceImport}`);
  if (importParts.length > 0) {
    logEntry += `Importing: ${importParts.join(', ')}\n`;
  }

  // Show errors
  logEntry += `\nErrors:\n`;
  errors.forEach((err) => {
    logEntry += `  - ${err}\n`;
  });

  // Show removed code
  logEntry += `\nRemoved code:\n`;
  logEntry += `${'-'.repeat(80)}\n`;
  logEntry += imp.fullStatement;
  if (!imp.fullStatement.endsWith('\n')) {
    logEntry += '\n';
  }
  logEntry += `${'-'.repeat(80)}\n`;

  removedImportsLog.push(logEntry);
}

// Write log file
function writeLogFile() {
  if (removedImportsLog.length === 0) {
    return;
  }

  const header = `REMOVED IMPORTS LOG
Generated: ${new Date().toISOString()}
Directory: ${DIR}
Project Root: ${PROJECT_ROOT}
Dry Run: ${DRY_RUN}
Total Removed: ${removedImportsLog.length}
${'='.repeat(80)}
`;

  const content = header + removedImportsLog.join('\n');

  try {
    fs.writeFileSync(LOG_FILE, content, 'utf8');
    console.log(`\n📝 Log saved to: ${LOG_FILE}`);
  } catch (err) {
    console.error(`\n❌ Error writing log file: ${err.message}`);
  }
}

// Main logic
console.log(`\n🔍 Scanning ${DIR}...`);
console.log(`📁 Project root: ${PROJECT_ROOT}`);
console.log(`🏷️  Project aliases: ${ALIAS_PREFIXES.join(', ')}`);
console.log(`🚫 Ignoring patterns: ${IGNORE_PATTERNS.join(', ')}`);
console.log(`📝 Log file: ${LOG_FILE}`);
if (DRY_RUN) {
  console.log(`🔵 DRY RUN MODE: No files will be modified\n`);
} else {
  console.log(`⚠️  LIVE MODE: Files will be modified!\n`);
}

const files = getAllFiles(DIR);
console.log(`📄 Found ${files.length} files\n`);

let totalBrokenImports = 0;
let totalFilesModified = 0;
let totalSkippedDueToReexports = 0;

// Process each file
files.forEach((file) => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const imports = parseImports(content);
    const brokenImports = [];

    // Check each import
    imports.forEach((imp) => {
      const errors = validateImport(imp, file);
      if (errors.length > 0) {
        brokenImports.push({
          ...imp,
          errors,
          isExternal: isExternalPackage(imp.path),
        });
      }
    });

    // Report and fix if broken imports found
    if (brokenImports.length > 0) {
      totalBrokenImports += brokenImports.length;
      totalFilesModified++;

      console.log(`\n🔴 ${file}`);
      console.log(`   Found ${brokenImports.length} broken import(s):`);

      brokenImports.forEach((imp) => {
        const lineRange =
          imp.startLine === imp.endLine ? `Line ${imp.startLine + 1}` : `Lines ${imp.startLine + 1}-${imp.endLine + 1}`;

        const importType = imp.isExternal ? '📦 External package' : '📂 Project import';
        console.log(`\n   ${lineRange} (${importType}):`);

        // Show what's being imported
        const importParts = [];
        if (imp.defaultImport) importParts.push(`default: ${imp.defaultImport}`);
        if (imp.namedImports.length > 0) importParts.push(`named: {${imp.namedImports.join(', ')}}`);
        if (imp.namespaceImport) importParts.push(`namespace: * as ${imp.namespaceImport}`);
        if (importParts.length > 0) {
          console.log(`      Importing: ${importParts.join(', ')}`);
        }
        console.log(`      From: ${imp.path}`);

        // Show errors
        imp.errors.forEach((err) => {
          console.log(`      ❌ ${err}`);
        });

        // Show preview
        const previewLines = imp.fullStatement.split('\n').slice(0, 3);
        console.log(`      Preview:`);
        previewLines.forEach((l) => {
          const preview = l.trim().substring(0, 80);
          console.log(`         ${preview}${l.trim().length > 80 ? '...' : ''}`);
        });
        if (imp.fullStatement.split('\n').length > 3) {
          console.log(`         ...`);
        }

        // Log the removal
        logRemovedImport(file, imp, imp.errors);
      });

      if (!DRY_RUN) {
        // Remove broken imports
        const lines = content.split('\n');
        const linesToRemove = new Set();

        brokenImports.forEach((imp) => {
          for (let i = imp.startLine; i <= imp.endLine; i++) {
            linesToRemove.add(i);
          }
        });

        const newLines = lines.filter((_, index) => !linesToRemove.has(index));
        const newContent = newLines.join('\n');

        fs.writeFileSync(file, newContent, 'utf8');
        console.log(`\n   ✅ Fixed!`);
      } else {
        console.log(`\n   ⏭️  Skipped (dry-run)`);
      }
    }
  } catch (err) {
    console.error(`❌ Error processing ${file}:`, err.message);
  }
});

// Write log file
writeLogFile();

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 SUMMARY:\n');
console.log(`   Files scanned: ${files.length}`);
console.log(`   Files with broken imports: ${totalFilesModified}`);
console.log(`   Total broken imports: ${totalBrokenImports}`);

if (totalBrokenImports > 0) {
  if (DRY_RUN) {
    console.log(`\n💡 Run without --dry-run to fix these imports`);
    console.log(`📝 Check ${LOG_FILE} for details\n`);
  } else {
    console.log(`\n✨ All broken imports have been removed!`);
    console.log(`📝 Details saved to ${LOG_FILE}\n`);
  }
} else {
  console.log(`\n✨ No broken imports found!\n`);
}

console.log(`ℹ️  Note: Files with re-exports are skipped for export validation`);
console.log(`   (exports might come from external sources we can't trace)\n`);
