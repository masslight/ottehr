/**
 * Codemod and check: import every symbol from the module that declares it, never through a
 * re-export.
 *
 * A barrel is any module that re-exports bindings declared somewhere else, in any of the forms
 *
 *   export * from './claim';                        // star re-export
 *   export { getCandidApiClient } from './candid';  // named re-export
 *   import { x } from './x'; export { x };          // import-then-export alias
 *
 * WHY: vitest does not bundle, so importing through a barrel makes a test file load (and re-read
 * from disk, per isolated file) everything behind it; removing them made unit tests 2-2.6x faster.
 * Barrels are also how most of our import cycles formed, and why some modules only initialised in
 * the right order when a barrel happened to list them first. Production bundles are unaffected.
 *
 * Usage:  npx tsx scripts/debarrel.ts [<path>...] [--apply | --check]
 *   (no flag)  dry run: list every import that reaches a symbol through a re-export
 *   --apply    rewrite those imports to name the declaring module
 *   --check    exit 1 if any re-export, or any import through one, remains (`npm run lint:barrels`)
 * Paths (relative to the working directory) limit which files are rewritten or checked. Symbol
 * resolution always follows imports across the whole repo.
 *
 * `export … from` is also rejected by ESLint (`no-restricted-syntax` in .eslintrc.cjs), so editors
 * flag new barrels as they are typed. This script additionally catches the import-then-export form,
 * mocks and dynamic imports aimed at a barrel, and fixes importers mechanically.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

const REPO = resolve(__dirname, '..');

/**
 * Re-exports that are an interface rather than a convenience. The theme directory is swapped at
 * build time (THEME_PATH in the vite configs) and CustomThemeProvider/IntakeThemeProvider merge the
 * active theme's `index` over the default theme's, so a theme's index modules are its contract.
 */
const ALLOWED_DIRS = ['apps/ehr/src/themes', 'apps/intake/src/themes'].map((d) => resolve(REPO, d) + sep);
const isAllowed = (file: string): boolean => ALLOWED_DIRS.some((d) => file.startsWith(d));

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const CHECK = args.includes('--check');
const SCOPES = args.filter((a) => !a.startsWith('--')).map((a) => resolve(process.cwd(), a));
const inScope = (file: string): boolean => !SCOPES.length || SCOPES.some((s) => file === s || file.startsWith(s + sep));
const rel = (file: string): string => relative(REPO, file);

const git = (...a: string[]): string[] =>
  execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\n')
    .filter(Boolean);

// ---------------------------------------------------------------------------------------------
// Workspace packages: each resolves specifiers with its own tsconfig (baseUrl, paths).

type Pkg = { name: string; dir: string; options: ts.CompilerOptions; cache: ts.ModuleResolutionCache };

const PKGS: Pkg[] = git(
  'ls-files',
  '--cached',
  '--others',
  '--exclude-standard',
  '--',
  'package.json',
  '*/package.json'
)
  .filter((f) => !f.includes('node_modules/'))
  .map((f) => {
    const dir = resolve(REPO, dirname(f));
    const tsconfig = [join(dir, 'tsconfig.json'), join(REPO, 'tsconfig.base.json')].find((p) => existsSync(p))!;
    // Only compiler options matter here, so skip enumerating each project's files.
    const host = { ...ts.sys, readDirectory: (): string[] => [], onUnRecoverableConfigFileDiagnostic: (): void => {} };
    const options = ts.getParsedCommandLineOfConfigFile(tsconfig, {}, host)?.options ?? {};
    const name: string = JSON.parse(readFileSync(resolve(REPO, f), 'utf8')).name;
    return { name, dir, options, cache: ts.createModuleResolutionCache(dir, (s) => s, options) };
  })
  .sort((a, b) => b.dir.length - a.dir.length); // deepest first, so ownerOf finds the nearest

const ownerOf = (file: string): Pkg => PKGS.find((p) => file.startsWith(p.dir + sep))!;

const FILES = git('ls-files', '--cached', '--others', '--exclude-standard', '--', '*.ts', '*.tsx', '*.mts', '*.cts')
  .filter((f) => !f.endsWith('.d.ts') && !f.includes('node_modules/'))
  .map((f) => resolve(REPO, f))
  .filter((f) => existsSync(f));

// ---------------------------------------------------------------------------------------------
// What each module exports, read syntactically.

/** A binding one module takes from another: an export name, 'default', or '*' for the namespace. */
type Source = { spec: string; name: string };

type Info = {
  file: string;
  sf: ts.SourceFile;
  pkg: Pkg;
  /** Export names this module declares itself. */
  local: Set<string>;
  /** Export names this module re-exports, and where from. */
  named: Map<string, Source>;
  /** `export * from '<spec>'`. */
  stars: string[];
  /** Every statement that re-exports something. */
  reexports: ts.Statement[];
  /** Nothing but re-exports (and the imports feeding them). */
  barrel: boolean;
  exportEquals: boolean;
};

function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((el) => (ts.isOmittedExpression(el) ? [] : bindingNames(el.name)));
}

function declaredNames(st: ts.Statement): string[] {
  if (ts.isVariableStatement(st)) return st.declarationList.declarations.flatMap((d) => bindingNames(d.name));
  if (
    (ts.isFunctionDeclaration(st) ||
      ts.isClassDeclaration(st) ||
      ts.isInterfaceDeclaration(st) ||
      ts.isTypeAliasDeclaration(st) ||
      ts.isEnumDeclaration(st) ||
      ts.isModuleDeclaration(st) ||
      ts.isImportEqualsDeclaration(st)) &&
    st.name &&
    ts.isIdentifier(st.name)
  ) {
    return [st.name.text];
  }
  return [];
}

function analyze(file: string): Info {
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, kind);
  const info: Info = {
    file,
    sf,
    pkg: ownerOf(file),
    local: new Set(),
    named: new Map(),
    stars: [],
    reexports: [],
    barrel: false,
    exportEquals: false,
  };

  const imported = new Map<string, Source>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const spec = st.moduleSpecifier.text;
    const { name, namedBindings } = st.importClause;
    if (name) imported.set(name.text, { spec, name: 'default' });
    if (namedBindings && ts.isNamespaceImport(namedBindings))
      imported.set(namedBindings.name.text, { spec, name: '*' });
    else if (namedBindings) {
      for (const el of namedBindings.elements)
        imported.set(el.name.text, { spec, name: (el.propertyName ?? el.name).text });
    }
  }

  let other = 0;
  for (const st of sf.statements) {
    if (ts.isExportDeclaration(st)) {
      const clause = st.exportClause;
      if (st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
        const spec = st.moduleSpecifier.text;
        info.reexports.push(st);
        if (!clause) info.stars.push(spec);
        else if (ts.isNamespaceExport(clause)) info.named.set(clause.name.text, { spec, name: '*' });
        else
          for (const el of clause.elements)
            info.named.set(el.name.text, { spec, name: (el.propertyName ?? el.name).text });
        continue;
      }
      if (clause && ts.isNamedExports(clause)) {
        // `export { a, b as c }` exports this module's own bindings, unless they are imports.
        let aliased = 0;
        for (const el of clause.elements) {
          const source = imported.get((el.propertyName ?? el.name).text);
          if (source) {
            info.named.set(el.name.text, source);
            aliased++;
          } else info.local.add(el.name.text);
        }
        if (aliased) info.reexports.push(st);
        if (aliased < clause.elements.length) other++;
      }
      continue;
    }
    if (ts.isExportAssignment(st)) {
      const source = ts.isIdentifier(st.expression) ? imported.get(st.expression.text) : undefined;
      if (st.isExportEquals) info.exportEquals = true;
      else if (source) {
        info.named.set('default', source);
        info.reexports.push(st);
        continue;
      } else info.local.add('default');
      other++;
      continue;
    }
    if (ts.isImportDeclaration(st) || ts.isEmptyStatement(st)) continue;
    const modifiers = ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined;
    if (modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) info.local.add('default');
      else for (const n of declaredNames(st)) info.local.add(n);
    }
    other++;
  }
  info.barrel = info.reexports.length > 0 && other === 0;
  return info;
}

const infos = new Map<string, Info | null>();
/** Parsed module, or null for anything that is not TypeScript source (assets, JSON, .d.ts). */
function infoOf(file: string): Info | null {
  if (!infos.has(file)) {
    infos.set(file, /\.(tsx?|mts|cts)$/.test(file) && !file.endsWith('.d.ts') ? analyze(file) : null);
  }
  return infos.get(file)!;
}

// ---------------------------------------------------------------------------------------------
// Module resolution, exactly as each package's compiler sees it.

type Target = { kind: 'repo'; file: string } | { kind: 'outside' } | { kind: 'missing' };

const resolved = new Map<string, Target>();
function resolveSpec(spec: string, from: string): Target {
  const pkg = ownerOf(from);
  const key = JSON.stringify([pkg.dir, dirname(from), spec]);
  let target = resolved.get(key);
  if (target) return target;
  const bare = spec.replace(/[?#].*$/, ''); // `./icon.svg?react`
  let file = ts.resolveModuleName(bare, from, pkg.options, ts.sys, pkg.cache).resolvedModule?.resolvedFileName;
  // Assets (svg, png, ogg, …) resolve to no module, but the specifier still names a real file.
  if (!file) {
    const [head, ...rest] = bare.split('/');
    const scoped = head.startsWith('@') ? `${head}/${rest.shift()}` : head;
    const pkgDir = PKGS.find((p) => p.name === scoped && p.dir !== REPO)?.dir;
    const candidate = bare.startsWith('.') ? resolve(dirname(from), bare) : pkgDir && join(pkgDir, ...rest);
    if (candidate && existsSync(candidate) && statSync(candidate).isFile()) file = candidate;
  }
  if (!file) target = { kind: 'missing' };
  else {
    const real = realpathSync.native(file);
    const inRepo = real.startsWith(REPO + sep) && !real.includes(`${sep}node_modules${sep}`);
    target = inRepo ? { kind: 'repo', file: real } : { kind: 'outside' };
  }
  resolved.set(key, target);
  return target;
}

// ---------------------------------------------------------------------------------------------
// Where an exported name is really declared.

type Origin =
  /** Declared in `file`, which exports it as `name` ('default' included). */
  | { kind: 'decl'; file: string; name: string }
  /** `export * as ns from './file'`. */
  | { kind: 'namespace'; file: string }
  /** Re-exported from outside the repo: `export { x } from 'some-package'`. */
  | { kind: 'package'; spec: string; name: string }
  | { kind: 'unknown'; why: string };

const NOT_EXPORTED = 'not exported';
const origins = new Map<string, Origin>();

function originOf(file: string, name: string, stack: string[] = []): Origin {
  const key = `${file}#${name}`;
  const cached = origins.get(key);
  if (cached) return cached;
  if (stack.includes(key)) return { kind: 'unknown', why: `circular re-export of '${name}' in ${rel(file)}` };
  const info = infoOf(file);
  let origin: Origin;
  // A theme module is the contract itself; what it re-exports is its own business.
  if (!info || info.local.has(name) || isAllowed(file)) origin = { kind: 'decl', file, name };
  else if (info.exportEquals) origin = { kind: 'unknown', why: `${rel(file)} uses \`export =\`` };
  else {
    const source = info.named.get(name);
    origin = source ? follow(info, source, [...stack, key]) : fromStars(info, name, [...stack, key]);
  }
  origins.set(key, origin);
  return origin;
}

function follow(info: Info, source: Source, stack: string[]): Origin {
  const target = resolveSpec(source.spec, info.file);
  if (target.kind === 'missing')
    return { kind: 'unknown', why: `cannot resolve '${source.spec}' from ${rel(info.file)}` };
  if (target.kind === 'outside') {
    if (source.name === '*') return { kind: 'unknown', why: `namespace re-export of package '${source.spec}'` };
    return { kind: 'package', spec: source.spec, name: source.name };
  }
  if (source.name === '*') return { kind: 'namespace', file: target.file };
  return originOf(target.file, source.name, stack);
}

function fromStars(info: Info, name: string, stack: string[]): Origin {
  if (name !== 'default') {
    const packages: string[] = [];
    for (const spec of info.stars) {
      const target = resolveSpec(spec, info.file);
      if (target.kind === 'outside') packages.push(spec);
      if (target.kind !== 'repo') continue;
      const origin = originOf(target.file, name, stack);
      if (origin.kind !== 'unknown' || origin.why !== NOT_EXPORTED) return origin;
    }
    // A package's exports are not parsed here; with a single candidate it can only be that one.
    if (packages.length === 1) return { kind: 'package', spec: packages[0], name };
  }
  return { kind: 'unknown', why: NOT_EXPORTED };
}

// ---------------------------------------------------------------------------------------------
// How a rewritten import should spell the path to the declaring module.

const stripExt = (p: string): string => p.replace(/(\.d)?\.(tsx?|mts|cts)$/, '').replace(/\/index$/, '');

function relativeSpec(from: string, to: string): string {
  const spec = stripExt(relative(dirname(from), to));
  return spec.startsWith('.') ? spec : `./${spec}`;
}

/**
 * Another package is always reached by its package subpath (`utils/lib/…`), even when the barrel
 * being bypassed was a relative import. Within a package, follow the style of the specifier being
 * replaced: relative stays relative and an app's `src/…` stays baseUrl-absolute. A module never
 * reaches its own package through its package name — that is what creates the self-referential
 * cycles — so those become relative.
 */
function specifierFor(target: string, from: string, original: string): string {
  const [fromPkg, targetPkg] = [ownerOf(from), ownerOf(target)];
  const candidates: string[] = [];
  const baseUrl = fromPkg.options.baseUrl;
  if (targetPkg !== fromPkg && targetPkg.dir !== REPO) {
    candidates.push(`${targetPkg.name}/${stripExt(relative(targetPkg.dir, target))}`);
  } else if (
    !original.startsWith('.') &&
    baseUrl &&
    target.startsWith(baseUrl + sep) &&
    existsSync(join(baseUrl, original.split('/')[0]))
  ) {
    candidates.push(stripExt(relative(baseUrl, target)));
  }
  candidates.push(relativeSpec(from, target));
  // Keep the extension of non-TypeScript targets (assets, JSON), which stripExt leaves alone.
  const withQuery = (spec: string): string => spec + (original.match(/[?#].*$/)?.[0] ?? '');
  for (const spec of candidates) {
    const t = resolveSpec(spec, from);
    if (t.kind === 'repo' && t.file === target) return withQuery(spec);
  }
  throw new Error(`no specifier from ${rel(from)} resolves to ${rel(target)}`);
}

// ---------------------------------------------------------------------------------------------
// Rewrite imports.

type Binding = { imported: string; local: string; typeOnly: boolean };
type Planned = Binding & { spec: string; kind: 'named' | 'default' | 'namespace' };

const printNamed = (b: Binding): string => (b.imported === b.local ? b.local : `${b.imported} as ${b.local}`);

let importsRewritten = 0;
const filesChanged: string[] = [];
const unresolved = new Map<string, number>();
const manual: string[] = [];
const where = (sf: ts.SourceFile, node: ts.Node): string =>
  `${rel(sf.fileName)}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;

/** Does importing `file` risk going through a re-export? */
const reexportsSomething = (file: string): boolean => !isAllowed(file) && (infoOf(file)?.reexports.length ?? 0) > 0;

for (const file of FILES) {
  if (!inScope(file) || isAllowed(file)) continue;
  const info = infoOf(file)!;
  if (info.barrel) continue; // nothing imports through it once its importers are rewritten
  const { sf } = info;

  const edits: { start: number; end: number; text: string }[] = [];
  const adds: Planned[] = [];
  const replaced: { stmt: ts.ImportDeclaration; kept: string | null; firstAdd: number }[] = [];

  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const spec = stmt.moduleSpecifier.text;
    const target = resolveSpec(spec, file);
    if (target.kind !== 'repo' || !reexportsSomething(target.file)) continue;
    const clause = stmt.importClause;
    // `import './x'` and `import {} from './x'` bind nothing: only the module's side effects are
    // wanted, and tsc does not even check they resolve. Deleting the barrel would break them silently.
    const named = clause?.namedBindings;
    if (!clause || (!clause.name && named && ts.isNamedImports(named) && !named.elements.length)) {
      if (infoOf(target.file)?.barrel) manual.push(`${where(sf, stmt)}  side-effect import of barrel '${spec}'`);
      continue;
    }
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      manual.push(`${where(sf, stmt)}  namespace import of '${spec}', which re-exports`);
      continue;
    }
    const bindings: (Binding & { text: string })[] = [];
    if (clause.name) {
      bindings.push({ imported: 'default', local: clause.name.text, typeOnly: clause.isTypeOnly, text: '' });
    }
    if (clause.namedBindings) {
      for (const el of clause.namedBindings.elements) {
        const imported = (el.propertyName ?? el.name).text;
        const typeOnly = clause.isTypeOnly || el.isTypeOnly;
        bindings.push({ imported, local: el.name.text, typeOnly, text: el.getText(sf) });
      }
    }

    const kept: typeof bindings = [];
    const moved: Planned[] = [];
    let failed = false;
    for (const b of bindings) {
      const origin = originOf(target.file, b.imported);
      if (origin.kind === 'decl' && origin.file === target.file) kept.push(b);
      else if (origin.kind === 'decl' && isAllowed(origin.file)) {
        // Reaching a theme by file path would bypass the THEME_PATH alias (`@ehrTheme/…`).
        manual.push(`${where(sf, stmt)}  '${b.imported}' is re-exported from theme module ${rel(origin.file)}`);
        failed = true;
      } else if (origin.kind === 'unknown') {
        const k = `${rel(target.file)}: ${b.imported} (${origin.why})`;
        unresolved.set(k, (unresolved.get(k) ?? 0) + 1);
        failed = true;
      } else if (origin.kind === 'package') {
        moved.push({
          ...b,
          imported: origin.name,
          spec: origin.spec,
          kind: origin.name === 'default' ? 'default' : 'named',
        });
      } else if (origin.kind === 'namespace') {
        moved.push({ ...b, spec: specifierFor(origin.file, file, spec), kind: 'namespace' });
      } else {
        const kind = origin.name === 'default' ? 'default' : 'named';
        moved.push({ ...b, imported: origin.name, spec: specifierFor(origin.file, file, spec), kind });
      }
    }
    if (failed || !moved.length) continue;

    let keptText: string | null = null;
    if (kept.length) {
      const def = kept.find((b) => b.imported === 'default' && !b.text);
      const named = kept.filter((b) => b !== def).map((b) => b.text);
      const parts = [def?.local, named.length ? `{ ${named.join(', ')} }` : undefined].filter(Boolean);
      keptText = `import ${clause.isTypeOnly ? 'type ' : ''}${parts.join(', ')} from ${stmt.moduleSpecifier.getText(
        sf
      )};`;
    }
    replaced.push({ stmt, kept: keptText, firstAdd: adds.length });
    adds.push(...moved);
    importsRewritten++;
  }
  if (!replaced.length) continue;

  // Fold new named bindings into an existing import of the same module where there is one.
  const replacedStmts = new Set(replaced.map((r) => r.stmt));
  const existing = new Map<string, { stmt: ts.ImportDeclaration; extra: string[] }>();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || replacedStmts.has(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const nb = stmt.importClause?.namedBindings;
    if (!nb || !ts.isNamedImports(nb)) continue;
    existing.set(`${stmt.moduleSpecifier.text} ${stmt.importClause!.isTypeOnly}`, { stmt, extra: [] });
  }
  const leftover = adds.map((a) => {
    if (a.kind !== 'named') return true;
    const into = existing.get(`${a.spec} ${a.typeOnly}`);
    if (!into) return true;
    const already = (into.stmt.importClause!.namedBindings as ts.NamedImports).elements.some(
      (el) => el.name.text === a.local
    );
    if (!already && !into.extra.includes(printNamed(a))) into.extra.push(printNamed(a));
    return false;
  });
  for (const { stmt, extra } of existing.values()) {
    if (!extra.length) continue;
    const clause = stmt.importClause!;
    const els = (clause.namedBindings as ts.NamedImports).elements.map((el) => el.getText(sf));
    const def = clause.name ? `${clause.name.text}, ` : '';
    const text = `import ${clause.isTypeOnly ? 'type ' : ''}${def}{ ${[...els, ...extra].join(
      ', '
    )} } from ${stmt.moduleSpecifier.getText(sf)};`;
    edits.push({ start: stmt.getStart(sf), end: stmt.getEnd(), text });
  }

  // Everything else lands where the barrel import was, one statement per module.
  replaced.forEach(({ stmt, kept, firstAdd }, n) => {
    const end = n + 1 < replaced.length ? replaced[n + 1].firstAdd : adds.length;
    const groups = new Map<string, Planned[]>();
    for (let k = firstAdd; k < end; k++) {
      if (!leftover[k]) continue;
      const a = adds[k];
      const key = a.kind === 'named' ? `${a.spec} ${a.typeOnly}` : `${a.spec} ${a.kind} ${a.local}`;
      groups.set(key, [...(groups.get(key) ?? []), a]);
    }
    // `import Default, { named } from '…'` when one module supplies both.
    const defaults = new Map<string, string>();
    for (const [key, [a]] of groups) {
      if (a.kind === 'default' && !a.typeOnly && groups.has(`${a.spec} false`) && !defaults.has(a.spec)) {
        defaults.set(a.spec, a.local);
        groups.delete(key);
      }
    }
    const lines = [...groups.values()].map((group) => {
      const [{ spec, kind, typeOnly, local }] = group;
      const type = typeOnly ? 'type ' : '';
      if (kind === 'namespace') return `import ${type}* as ${local} from '${spec}';`;
      if (kind === 'default') return `import ${type}${local} from '${spec}';`;
      const names = [...new Set(group.map(printNamed))];
      const def = !typeOnly && defaults.has(spec) ? `${defaults.get(spec)}, ` : '';
      return `import ${type}${def}{ ${names.join(', ')} } from '${spec}';`;
    });
    edits.push({ start: stmt.getStart(sf), end: stmt.getEnd(), text: [kept, ...lines].filter(Boolean).join('\n') });
  });

  filesChanged.push(file);
  if (!APPLY) continue;
  let text = sf.text;
  for (const e of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, e.start) + e.text + text.slice(e.end);
  writeFileSync(file, text);
}

// ---------------------------------------------------------------------------------------------
// Specifiers the rewrite cannot fix mechanically: mocks, dynamic imports, `import('…')` types.
// Once importers name the declaring module, a mock of a barrel no longer intercepts anything.

/** Names `file` exposes only by re-exporting them. */
function reexportedNames(file: string, seen = new Set<string>()): Set<string> {
  const info = infoOf(file);
  const names = new Set<string>();
  if (!info || seen.has(file)) return names;
  seen.add(file);
  for (const name of info.named.keys()) names.add(name);
  for (const spec of info.stars) {
    const target = resolveSpec(spec, file);
    if (target.kind !== 'repo') continue;
    const starred = infoOf(target.file);
    if (!starred) continue;
    for (const name of [...starred.local, ...reexportedNames(target.file, seen)])
      if (name !== 'default') names.add(name);
  }
  for (const name of info.local) names.delete(name);
  return names;
}

/** Keys of the object a mock factory returns, or null when that is not statically visible. */
function mockedNames(call: ts.CallExpression): string[] | null {
  const factory = call.arguments[1];
  if (!factory || !(ts.isArrowFunction(factory) || ts.isFunctionExpression(factory))) return null;
  const objects: ts.ObjectLiteralExpression[] = [];
  const unwrap = (e: ts.Expression): ts.Expression =>
    ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isAwaitExpression(e) ? unwrap(e.expression) : e;
  const collect = (node: ts.Node): void => {
    if (ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(unwrap(node.expression))) {
      objects.push(unwrap(node.expression) as ts.ObjectLiteralExpression);
    }
    if (!ts.isFunctionLike(node)) ts.forEachChild(node, collect);
  };
  if (ts.isBlock(factory.body)) ts.forEachChild(factory.body, collect);
  else if (ts.isObjectLiteralExpression(unwrap(factory.body)))
    objects.push(unwrap(factory.body) as ts.ObjectLiteralExpression);
  if (!objects.length) return null;
  return objects.flatMap((o) =>
    o.properties.flatMap((p) =>
      p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? [p.name.text] : []
    )
  );
}

const describeOrigin = (file: string, name: string): string => {
  const o = originOf(file, name);
  if (o.kind === 'decl') return `${name} -> ${rel(o.file)}${o.name === name ? '' : ` (as ${o.name})`}`;
  if (o.kind === 'package') return `${name} -> '${o.spec}'`;
  if (o.kind === 'namespace') return `${name} -> * of ${rel(o.file)}`;
  return `${name} -> ? (${o.why})`;
};

const MOCKS = /^(vi|jest)\.(mock|doMock|unmock|doUnmock|importActual|importMock|requireActual|requireMock)$/;
for (const file of FILES) {
  if (!inScope(file) || isAllowed(file)) continue;
  const { sf } = infoOf(file)!;
  const visit = (node: ts.Node): void => {
    let spec: ts.Expression | undefined;
    let what = '';
    let names: string[] | null = null; // the names this site depends on, when known
    if (ts.isCallExpression(node) && node.arguments.length) {
      const callee = node.expression.getText(sf);
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) what = 'dynamic import()';
      else if (MOCKS.test(callee)) what = callee;
      else if (callee === 'require') what = 'require()';
      if (/\.(mock|doMock)$/.test(callee)) names = mockedNames(node);
      if (what) spec = node.arguments[0];
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      what = "import('…') type";
      spec = node.argument.literal;
      const q = node.qualifier;
      names = q ? [ts.isIdentifier(q) ? q.text : q.getText(sf).split('.')[0]] : null;
    }
    if (spec && ts.isStringLiteralLike(spec)) {
      const target = resolveSpec(spec.text, file);
      if (target.kind === 'repo' && reexportsSomething(target.file)) {
        const through = reexportedNames(target.file);
        const hits = names?.filter((n) => through.has(n));
        // A module mocked or typed only by names it declares itself is fine; anything else needs a look.
        if (hits?.length) {
          manual.push(
            `${where(sf, node)}  ${what} '${spec.text}': ${hits.map((n) => describeOrigin(target.file, n)).join('; ')}`
          );
        } else if (!names) {
          manual.push(`${where(sf, node)}  ${what} of '${spec.text}', which re-exports`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

// ---------------------------------------------------------------------------------------------
// Report.

const remaining = FILES.filter((f) => inScope(f) && !isAllowed(f)).flatMap((f) => {
  const info = infoOf(f)!;
  if (info.barrel) return [`${rel(f)}  (barrel: every statement re-exports)`];
  return info.reexports.map((st) => `${where(info.sf, st)}  ${st.getText(info.sf).replace(/\s+/g, ' ').slice(0, 100)}`);
});

const list = (title: string, items: string[]): void => {
  if (!items.length) return;
  console.log(`\n${title}: ${items.length}`);
  for (const item of items) console.log(`  ${item}`);
};

console.log(
  `${APPLY ? 'APPLIED' : CHECK ? 'CHECK' : 'DRY RUN'}  ${SCOPES.length ? SCOPES.map(rel).join(' ') : 'whole repo'}`
);
console.log(`  imports ${APPLY ? 'rewritten' : 'to rewrite'}: ${importsRewritten} in ${filesChanged.length} files`);
list(
  'Imports left alone because a symbol could not be traced',
  [...unresolved].map(([k, n]) => `${k} x${n}`)
);
list('Specifiers to fix by hand', manual);
list('Re-exports', remaining);

if (CHECK && (importsRewritten || unresolved.size || manual.length || remaining.length)) {
  console.error(
    '\nImport each symbol from the module that declares it. `npx tsx scripts/debarrel.ts --apply` rewrites ' +
      'importers; then delete the re-exports.'
  );
  process.exit(1);
}
