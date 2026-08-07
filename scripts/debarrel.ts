/**
 * Codemod: rewrite barrel imports to the module that actually declares each symbol.
 *
 *   import { safeJsonParse, ZambdaInput } from '../../shared';
 *   import { INVALID_INPUT_ERROR } from 'utils';
 * becomes
 *   import { safeJsonParse } from '../../shared/validation';
 *   import { ZambdaInput } from '../../shared/types/common';
 *   import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
 *
 * WHY: vitest does not bundle, so `export *` barrels make every test file load (and re-read
 * from disk, per isolated file) the entire package behind the barrel. Production bundles are
 * unaffected — esbuild already tree-shakes them.
 *
 * Usage:  npx tsx scripts/debarrel.ts <dir-relative-to-repo-root> [--apply|--check]
 * Without --apply it reports what it would do and changes nothing.
 * --check exits non-zero if any barrel import remains, for CI (see `npm run lint:barrels`).
 */
import { relative, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const REPO = resolve(__dirname, '..');

/** Workspace packages that are reachable by bare specifier, and the barrel each one exposes. */
const PACKAGES: { name: string; root: string; barrel: string }[] = [
  { name: 'utils', root: resolve(REPO, 'packages/utils/lib'), barrel: resolve(REPO, 'packages/utils/lib/main.ts') },
  {
    name: 'ui-components',
    root: resolve(REPO, 'packages/ui-components/lib'),
    barrel: resolve(REPO, 'packages/ui-components/lib/main.ts'),
  },
];

/** Directories whose files may themselves be barrels worth rewriting imports of. */
const SOURCE_ROOTS = [
  'packages/utils/lib',
  'packages/ui-components/lib',
  'packages/zambdas/src',
  'packages/zambdas/test',
  'apps/ehr/src',
  'apps/ehr/tests',
  'apps/intake/src',
  'apps/intake/tests',
  'apps/billing/src',
  'apps/billing/tests',
].map((p) => resolve(REPO, p));

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ROOT = resolve(REPO, args.find((a) => !a.startsWith('--')) ?? 'packages/zambdas/src');

const EXTS = ['.ts', '.tsx'];

const program = ts.createProgram({
  rootNames: [...PACKAGES.map((p) => p.barrel), ...ts.sys.readDirectory(ROOT, EXTS)].filter((f) =>
    ts.sys.fileExists(f)
  ),
  options: {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    allowJs: false,
    noEmit: true,
    skipLibCheck: true,
    baseUrl: REPO,
  },
});
const checker = program.getTypeChecker();

/** symbolName -> absolute path of the file that DECLARES it (following re-export aliases). */
function buildSymbolMap(barrelPath: string): Map<string, string> {
  const map = new Map<string, string>();
  const sf = program.getSourceFile(barrelPath);
  if (!sf) throw new Error(`cannot load barrel ${barrelPath}`);
  const moduleSymbol = checker.getSymbolAtLocation(sf);
  if (!moduleSymbol) throw new Error(`no module symbol for ${barrelPath}`);
  for (const exp of checker.getExportsOfModule(moduleSymbol)) {
    const target = exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
    const decl = target.declarations?.[0];
    const file = decl?.getSourceFile().fileName;
    // Skip symbols that resolve back into the barrel itself or into node_modules typings.
    if (!file || file === barrelPath || file.includes('/node_modules/')) continue;
    map.set(exp.getName(), resolve(file));
  }
  return map;
}

const stripExt = (p: string): string => p.replace(/\.tsx?$/, '').replace(/\/index$/, '');

/** How the rewritten import should refer to `targetFile` from `fromFile`. */
function specifierFor(targetFile: string, fromFile: string): string {
  const owner = PACKAGES.find((p) => targetFile.startsWith(p.root + '/'));
  // A module must not reach its own package through the bare specifier — that is exactly what
  // creates the self-referential cycles — so stay relative when both sides live in one package.
  if (owner && !fromFile.startsWith(owner.root + '/')) {
    return `${owner.name}/lib/${stripExt(relative(owner.root, targetFile))}`;
  }
  let rel = stripExt(relative(resolve(fromFile, '..'), targetFile));
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

/** A file is a barrel when every non-trivial statement in it is a re-export. */
function isBarrel(sf: ts.SourceFile): boolean {
  const stmts = sf.statements.filter((st) => !ts.isEmptyStatement(st));
  if (!stmts.length) return false;
  return stmts.every((st) => ts.isExportDeclaration(st) && !!st.moduleSpecifier);
}

/** Every barrel we will rewrite imports of, plus each package entry. */
const BARRELS = new Map<string, Map<string, string>>();
for (const sf of program.getSourceFiles()) {
  const file = resolve(sf.fileName);
  if (file.includes('/node_modules/')) continue;
  // Barrel-ness is a property of the contents, not the filename: `foo/helpers.ts` that
  // contains nothing but re-exports is every bit as much a barrel as `foo/index.ts`.
  if (!SOURCE_ROOTS.some((r) => file.startsWith(r + '/'))) continue;
  if (!isBarrel(sf)) continue;
  try {
    BARRELS.set(file, buildSymbolMap(file));
  } catch {
    /* unreadable barrel — leave its importers alone */
  }
}

/** Resolve an import specifier to an absolute file, or null. */
function resolveSpecifier(spec: string, fromFile: string): string | null {
  const pkg = PACKAGES.find((p) => p.name === spec);
  if (pkg) return pkg.barrel;
  if (!spec.startsWith('.')) return null;
  const base = resolve(resolve(fromFile, '..'), spec);
  for (const cand of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, base]) {
    if (BARRELS.has(cand)) return cand;
  }
  return null;
}

let filesChanged = 0;
let importsRewritten = 0;
const skipped: string[] = [];
const unresolved = new Map<string, number>();

for (const sf of program.getSourceFiles()) {
  const file = resolve(sf.fileName);
  if (!file.startsWith(ROOT) || file.includes('/node_modules/')) continue;
  if (BARRELS.has(file)) continue; // a barrel's own re-exports are left alone

  const edits: { start: number; end: number; text: string }[] = [];

  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const spec = (stmt.moduleSpecifier as ts.StringLiteral).text;
    const barrelPath = resolveSpecifier(spec, file);
    if (!barrelPath || barrelPath === file) continue;
    const clause = stmt.importClause;
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
      if (clause) skipped.push(`${relative(REPO, file)}: non-named import from '${spec}'`);
      continue;
    }
    const map = BARRELS.get(barrelPath)!;
    const isTypeOnlyClause = clause.isTypeOnly;

    // group: target specifier -> list of binding texts
    const groups = new Map<string, { names: string[]; typeOnly: boolean }>();
    let allResolved = true;
    for (const el of clause.namedBindings.elements) {
      const name = (el.propertyName ?? el.name).text;
      const target = map.get(name);
      if (!target) {
        allResolved = false;
        unresolved.set(
          `${relative(REPO, barrelPath)}:${name}`,
          (unresolved.get(`${relative(REPO, barrelPath)}:${name}`) ?? 0) + 1
        );
        break;
      }
      const targetSpec = specifierFor(target, file);
      const typeOnly = isTypeOnlyClause || el.isTypeOnly;
      const key = `${targetSpec} ${typeOnly}`;
      const bucket = groups.get(key) ?? { names: [], typeOnly };
      bucket.names.push(el.propertyName ? `${el.propertyName.text} as ${el.name.text}` : el.name.text);
      groups.set(key, bucket);
    }
    if (!allResolved) continue; // leave the whole statement alone; reported below

    const lines = [...groups.entries()]
      .map(([key, { names, typeOnly }]) => {
        const targetSpec = key.split(' ')[0];
        return `import ${typeOnly ? 'type ' : ''}{ ${names.join(', ')} } from '${targetSpec}';`;
      })
      .sort();
    edits.push({ start: stmt.getStart(sf), end: stmt.getEnd(), text: lines.join('\n') });
    importsRewritten++;
  }

  if (!edits.length) continue;
  filesChanged++;
  if (!APPLY) continue;
  let text = readFileSync(file, 'utf8');
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, e.start) + e.text + text.slice(e.end);
  }
  writeFileSync(file, text);
}

console.log(`${APPLY ? 'APPLIED' : 'DRY RUN'}  root=${relative(REPO, ROOT)}`);
console.log(`  files changed:      ${filesChanged}`);
console.log(`  imports rewritten:  ${importsRewritten}`);
console.log(`  barrels discovered: ${BARRELS.size}`);
if (unresolved.size) {
  console.log(`  UNRESOLVED symbols (left untouched): ${unresolved.size}`);
  [...unresolved.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([k, n]) => console.log(`    ${k} (${n})`));
}
if (skipped.length) {
  console.log(`  skipped (namespace/default imports): ${skipped.length}`);
  skipped.slice(0, 5).forEach((s) => console.log(`    ${s}`));
}

if (args.includes('--check') && (filesChanged > 0 || unresolved.size > 0)) {
  console.error(`\nBarrel imports found. Run: npx tsx scripts/debarrel.ts ${relative(REPO, ROOT)} --apply`);
  process.exit(1);
}
