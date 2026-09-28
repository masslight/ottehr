// Compare eval runs against a baseline, in the terminal and as a self-contained HTML page.
//
// PHI: reads only summary.json and *.score.json (counts and case ids), never *.result.json, which holds
// clinical content. The HTML goes into the last run's gitignored directory; only point --out at an ignored path.
//
// Usage:
//   npx tsx tools/easy-chart-eval/report.ts <baselineDir> <currentDir> [<moreDirs>...]
//   npx tsx tools/easy-chart-eval/report.ts run-a run-b --out /tmp/eval.html
//   npx tsx tools/easy-chart-eval/report.ts run-a run-b --no-html      # terminal only

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

/** A section as summary.json writes it; per-case score files use `goldInScope` instead of `gold`. */
interface SectionLike {
  gold?: number;
  goldInScope?: number;
  predicted: number;
  matched: number;
  precision: number | null;
  recall: number | null;
}

interface Section {
  gold: number;
  predicted: number;
  matched: number;
  precision: number;
  recall: number;
  f1: number;
  /**
   * False when the scorer reports null precision, as for the med and immunization sections that share one
   * combined `predicted` count (their precision is in `medsCombined`). Null means not measured, not zero.
   */
  precisionMeasured: boolean;
}

type Scope = 'plannerOnly' | 'final';
const SCOPES: Scope[] = ['plannerOnly', 'final'];

interface RunSummary {
  scoredCases: number;
  scopes: Record<Scope, { sections: Record<string, SectionLike> }>;
  freeText: Record<string, { goldPresent: number; predictedPresent: number; bothPresent: number }>;
  counters: Record<string, number>;
  dispositionVoiced?: Record<string, number>;
  dispositionTrigger?: Record<string, unknown>;
  usage: Record<string, Record<string, number>>;
}

interface CaseScore {
  caseId: string;
  scopes: Record<Scope, Record<string, SectionLike>> & Record<Scope, { em?: EmLike }>;
  /** Null when the corpus did not know the patient's status. */
  patientStatusSent?: 'new' | 'established' | null;
  /** Where that status came from — see emLine. */
  patientStatusSource?: 'harvested' | 'gold-family' | 'none';
}

/** The per-case E&M pair; `gold`/`predicted` are CPT code strings, not counts. */
interface EmLike {
  gold?: string | null;
  predicted?: string | null;
}

interface Run {
  /** Directory basename, validated because it is written into the report. */
  name: string;
  dir: string;
  summary: RunSummary;
  cases: Map<string, CaseScore>;
}

/** Sections from either run's summary, read from the runs so scorer changes need no edit here. */
function sectionNames(baseline: Run, current: Run, scope: Scope): string[] {
  return [
    ...new Set([
      ...Object.keys(baseline.summary.scopes[scope]?.sections ?? {}),
      ...Object.keys(current.summary.scopes[scope]?.sections ?? {}),
    ]),
  ].sort();
}

/** Filesystem names are written into the HTML, so anything but a plain name is refused rather than escaped. */
function assertSafeId(value: string, what: string): string {
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(value)) {
    throw new Error(`${what} "${value}" is not a plain name — rename it to [A-Za-z0-9._-] before reporting on it`);
  }
  return value;
}

/** Zero-safe reads: a section reports `null` for a rate whose denominator was zero. */
const rate = (value: number | null | undefined): number => (value == null ? 0 : value);
const f1 = (precision: number, recall: number): number =>
  precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

function normalize(section: SectionLike | undefined): Section {
  const gold = section?.gold ?? section?.goldInScope ?? 0;
  const predicted = section?.predicted ?? 0;
  const matched = section?.matched ?? 0;
  const precision = rate(section?.precision);
  const recall = rate(section?.recall);
  return {
    gold,
    predicted,
    matched,
    precision,
    recall,
    f1: f1(precision, recall),
    precisionMeasured: section?.precision != null,
  };
}

/**
 * Totals across `names` with rates recomputed from counts (averaging rates would overweight small sections).
 * Only `names` is summed: a per-case scope also holds `em` (code strings) and the `medsCombined` roll-up.
 */
function totalsOf(sections: Record<string, SectionLike>, names: string[]): Section {
  let gold = 0;
  let predicted = 0;
  let matched = 0;
  // Precision covers only sections with measured precision; recall covers all, since gold is counted once per section.
  let predictedMeasured = 0;
  let matchedMeasured = 0;
  for (const name of names) {
    const n = normalize(sections[name]);
    gold += n.gold;
    predicted += n.predicted;
    matched += n.matched;
    if (n.precisionMeasured) {
      predictedMeasured += n.predicted;
      matchedMeasured += n.matched;
    }
  }
  const precision = predictedMeasured ? matchedMeasured / predictedMeasured : 0;
  const recall = gold ? matched / gold : 0;
  return {
    gold,
    predicted,
    matched,
    precision,
    recall,
    f1: f1(precision, recall),
    precisionMeasured: predictedMeasured > 0,
  };
}

function unmeasuredPrecisionSections(sections: Record<string, SectionLike>, names: string[]): string[] {
  return names.filter((name) => sections[name] && !normalize(sections[name]).precisionMeasured);
}

function loadRun(dir: string): Run {
  const full = resolve(dir);
  const summaryPath = join(full, 'summary.json');
  if (!existsSync(summaryPath)) throw new Error(`${dir} has no summary.json — is it a run directory?`);
  const cases = new Map<string, CaseScore>();
  for (const file of readdirSync(full)) {
    // Only score files: result files carry clinical text (see header).
    if (!file.endsWith('.score.json')) continue;
    const score = JSON.parse(readFileSync(join(full, file), 'utf8')) as CaseScore;
    cases.set(assertSafeId(score.caseId, 'case id'), score);
  }
  return {
    name: assertSafeId(basename(full), 'run directory'),
    dir: full,
    summary: JSON.parse(readFileSync(summaryPath, 'utf8')) as RunSummary,
    cases,
  };
}

// Terminal report

const pad = (value: string | number, width: number): string => String(value).padStart(width);
const padEnd = (value: string, width: number): string => value.padEnd(width);

/** Signed delta, or "=" for no change, since an empty cell would read as missing data. */
function delta(current: number, base: number, digits = 3): string {
  const d = current - base;
  if (Math.abs(d) < 5e-4) return '=';
  return `${d > 0 ? '+' : ''}${d.toFixed(digits)}`;
}

function deltaInt(current: number, base: number): string {
  const d = current - base;
  return d === 0 ? '=' : `${d > 0 ? '+' : ''}${d}`;
}

function printScope(baseline: Run, current: Run, scope: Scope): void {
  const bs = baseline.summary.scopes[scope].sections;
  const cs = current.summary.scopes[scope].sections;
  const names = sectionNames(baseline, current, scope);
  console.log(`\n  scope: ${scope}`);
  console.log(
    `  ${padEnd('section', 16)}${pad('gold', 6)}${pad('pred', 7)}${pad('Δ', 7)}${pad('match', 7)}${pad('Δ', 7)}` +
      `${pad('prec', 8)}${pad('recall', 8)}${pad('F1', 8)}${pad('ΔF1', 8)}`
  );
  console.log(`  ${'-'.repeat(82)}`);
  for (const name of names) {
    const b = normalize(bs[name]);
    const c = normalize(cs[name]);
    console.log(
      `  ${padEnd(name, 16)}${pad(c.gold, 6)}${pad(c.predicted, 7)}${pad(deltaInt(c.predicted, b.predicted), 7)}` +
        `${pad(c.matched, 7)}${pad(deltaInt(c.matched, b.matched), 7)}` +
        `${pad(c.precisionMeasured ? c.precision.toFixed(3) : '—', 8)}${pad(c.recall.toFixed(3), 8)}${pad(
          c.f1.toFixed(3),
          8
        )}` +
        `${pad(delta(c.f1, b.f1), 8)}`
    );
  }
  const bt = totalsOf(bs, names);
  const ct = totalsOf(cs, names);
  console.log(`  ${'-'.repeat(82)}`);
  console.log(
    `  ${padEnd('TOTAL', 16)}${pad(ct.gold, 6)}${pad(ct.predicted, 7)}${pad(deltaInt(ct.predicted, bt.predicted), 7)}` +
      `${pad(ct.matched, 7)}${pad(deltaInt(ct.matched, bt.matched), 7)}` +
      `${pad(ct.precisionMeasured ? ct.precision.toFixed(3) : '—', 8)}${pad(ct.recall.toFixed(3), 8)}${pad(
        ct.f1.toFixed(3),
        8
      )}` +
      `${pad(delta(ct.f1, bt.f1), 8)}`
  );
  const unmeasured = unmeasuredPrecisionSections(cs, names);
  if (unmeasured.length > 0) {
    console.log(
      `  precision excludes ${unmeasured.join(
        ', '
      )} — the scorer reports none for them (shared denominator); recall still counts them`
    );
  }
}

/**
 * E&M exact match, split by patient-status source: `harvested` is derived from prior encounters as in
 * production; `gold-family` is read off the gold code's family, which still leaves the level to the model.
 */
function emLine(run: Run): string {
  const counts: Record<string, { n: number; exact: number }> = {};
  let all = 0;
  let allExact = 0;
  // Most gold codes are level 4, so always guessing level 4 scores well on the headline. Only cases whose
  // gold is not level 4 (`discriminating`) separate coding judgement from collapsing onto the mode.
  let disc = 0;
  let discExact = 0;
  for (const score of run.cases.values()) {
    const em = score.scopes?.final?.em;
    if (!em?.gold || !em.predicted) continue;
    const exact = em.gold === em.predicted;
    all++;
    if (exact) allExact++;
    if (!MODAL_EM_CODES.has(em.gold)) {
      disc++;
      if (exact) discExact++;
    }
    const source = score.patientStatusSource ?? (score.patientStatusSent ? 'harvested' : 'none');
    counts[source] ??= { n: 0, exact: 0 };
    counts[source].n++;
    if (exact) counts[source].exact++;
  }
  const bySource = ['harvested', 'gold-family', 'none']
    .filter((source) => counts[source])
    .map((source) => `${source} ${counts[source].exact}/${counts[source].n}`)
    .join(', ');
  return `  ${padEnd(run.name, 26)}exact ${pad(`${allExact}/${all}`, 8)} | discriminating ${pad(
    `${discExact}/${disc}`,
    6
  )} | ${bySource || 'source not recorded'}`;
}

/** Level-4 codes, the modal gold value; a case with one of these as gold can't reveal coding judgement. */
const MODAL_EM_CODES = new Set(['99204', '99214']);

/** Per-case F1 change; shows whether an aggregate gain is broad or down to a few cases. */
interface CaseMove {
  caseId: string;
  base: number;
  current: number;
  change: number;
}

function caseMoves(baseline: Run, current: Run, scope: Scope): CaseMove[] {
  const names = sectionNames(baseline, current, scope);
  const moves: CaseMove[] = [];
  for (const [caseId, score] of current.cases) {
    const before = baseline.cases.get(caseId);
    if (!before) continue;
    const b = totalsOf(before.scopes[scope], names);
    const c = totalsOf(score.scopes[scope], names);
    moves.push({ caseId, base: b.f1, current: c.f1, change: c.f1 - b.f1 });
  }
  return moves.sort((a, b) => a.change - b.change);
}

/**
 * Checks that the per-case files sum to summary.json. The two are computed by different code, so a
 * mismatch means one is being read wrong and the comparison can't be trusted.
 */
function checkConsistency(run: Run, names: string[], scope: Scope): string | undefined {
  if (run.cases.size === 0) return undefined;
  const summary = totalsOf(run.summary.scopes[scope].sections, names);
  let gold = 0;
  let predicted = 0;
  let matched = 0;
  for (const score of run.cases.values()) {
    const totals = totalsOf(score.scopes[scope], names);
    gold += totals.gold;
    predicted += totals.predicted;
    matched += totals.matched;
  }
  if (gold === summary.gold && predicted === summary.predicted && matched === summary.matched) return undefined;
  return (
    `${run.name} (${scope}): per-case files sum to ${gold}/${predicted}/${matched} gold/pred/matched, ` +
    `but summary.json says ${summary.gold}/${summary.predicted}/${summary.matched}`
  );
}

function printReport(baseline: Run, current: Run): void {
  console.log(`\nBASELINE  ${baseline.name}   cases=${baseline.summary.scoredCases}`);
  console.log(`CURRENT   ${current.name}   cases=${current.summary.scoredCases}`);

  const problems = SCOPES.flatMap((scope) => {
    const names = sectionNames(baseline, current, scope);
    return [checkConsistency(baseline, names, scope), checkConsistency(current, names, scope)];
  }).filter((problem): problem is string => Boolean(problem));
  if (problems.length > 0) {
    console.error('\n  ⚠ THE NUMBERS BELOW DO NOT RECONCILE — do not act on this comparison:');
    for (const problem of problems) console.error(`    ${problem}`);
    process.exitCode = 1;
  }
  for (const scope of SCOPES) printScope(baseline, current, scope);

  const moves = caseMoves(baseline, current, 'final');
  const moved = moves.filter((m) => Math.abs(m.change) >= 5e-4);
  console.log(`\n  per-case F1 (scope: final) — ${moved.length} of ${moves.length} cases moved`);
  if (moved.length === 0) {
    console.log('    every scored case is identical to the baseline');
  } else {
    for (const move of moved) {
      console.log(
        `    ${padEnd(move.caseId, 12)}${pad(move.base.toFixed(3), 8)} → ${pad(move.current.toFixed(3), 8)}` +
          `${pad(delta(move.current, move.base), 9)}`
      );
    }
  }

  console.log('\n  E&M exact match (scope: final)');
  for (const run of [baseline, current]) console.log(emLine(run));

  console.log('\n  counters');
  const counterKeys = [
    ...new Set([...Object.keys(baseline.summary.counters), ...Object.keys(current.summary.counters)]),
  ];
  for (const key of counterKeys.sort()) {
    const b = baseline.summary.counters[key] ?? 0;
    const c = current.summary.counters[key] ?? 0;
    if (b || c) console.log(`    ${padEnd(key, 26)}${pad(c, 6)}   (${deltaInt(c, b)})`);
  }

  console.log('\n  model usage');
  for (const call of ['planner', 'review']) {
    const b = baseline.summary.usage?.[call] ?? {};
    const c = current.summary.usage?.[call] ?? {};
    if (b.calls || c.calls) {
      console.log(
        `    ${padEnd(call, 10)}calls=${pad(c.calls ?? 0, 4)} (${deltaInt(c.calls ?? 0, b.calls ?? 0)})` +
          `  in=${pad(c.inputTokens ?? 0, 8)} (${deltaInt(c.inputTokens ?? 0, b.inputTokens ?? 0)})` +
          `  out=${pad(c.outputTokens ?? 0, 7)} (${deltaInt(c.outputTokens ?? 0, b.outputTokens ?? 0)})`
      );
    }
  }

  const onlyBase = [...baseline.cases.keys()].filter((id) => !current.cases.has(id));
  const onlyCurrent = [...current.cases.keys()].filter((id) => !baseline.cases.has(id));
  console.log(
    `\n  coverage: ${moves.length} scored in both` +
      (onlyBase.length ? `, ${onlyBase.length} only in baseline` : '') +
      (onlyCurrent.length ? `, ${onlyCurrent.length} only in current` : '')
  );
  if (onlyBase.length || onlyCurrent.length) {
    console.log('  ⚠ the runs do not cover the same cases — aggregate deltas mix a code change with a corpus change');
  }
}

// HTML report

const cell = (value: number, digits = 3): string => value.toFixed(digits);

function deltaCell(current: number, base: number, digits = 3): string {
  const d = current - base;
  const cls = Math.abs(d) < 5e-4 ? 'flat' : d > 0 ? 'up' : 'down';
  const text = Math.abs(d) < 5e-4 ? '=' : `${d > 0 ? '+' : ''}${d.toFixed(digits)}`;
  return `<td class="num ${cls}">${text}</td>`;
}

function deltaIntCell(current: number, base: number): string {
  const d = current - base;
  const cls = d === 0 ? 'flat' : d > 0 ? 'up' : 'down';
  return `<td class="num ${cls}">${d === 0 ? '=' : `${d > 0 ? '+' : ''}${d}`}</td>`;
}

function scopeTable(baseline: Run, current: Run, scope: Scope): string {
  const bs = baseline.summary.scopes[scope].sections;
  const cs = current.summary.scopes[scope].sections;
  const names = sectionNames(baseline, current, scope);
  const rows = names
    .map((name) => {
      const b = normalize(bs[name]);
      const c = normalize(cs[name]);
      // F1 bar, with the baseline drawn as a ghost behind it.
      const bar =
        `<div class="bar"><span class="ghost" style="width:${(b.f1 * 100).toFixed(1)}%"></span>` +
        `<span class="fill" style="width:${(c.f1 * 100).toFixed(1)}%"></span></div>`;
      return (
        `<tr><td>${name}</td><td class="num">${c.gold}</td><td class="num">${c.predicted}</td>` +
        deltaIntCell(c.predicted, b.predicted) +
        `<td class="num">${c.matched}</td>` +
        deltaIntCell(c.matched, b.matched) +
        `<td class="num">${c.precisionMeasured ? cell(c.precision) : '—'}</td><td class="num">${cell(c.recall)}</td>` +
        `<td class="num">${cell(c.f1)}</td>` +
        deltaCell(c.f1, b.f1) +
        `<td class="barcell">${bar}</td></tr>`
      );
    })
    .join('');
  const bt = totalsOf(bs, names);
  const ct = totalsOf(cs, names);
  const total =
    `<tr class="total"><td>TOTAL</td><td class="num">${ct.gold}</td><td class="num">${ct.predicted}</td>` +
    deltaIntCell(ct.predicted, bt.predicted) +
    `<td class="num">${ct.matched}</td>` +
    deltaIntCell(ct.matched, bt.matched) +
    `<td class="num">${ct.precisionMeasured ? cell(ct.precision) : '—'}</td><td class="num">${cell(ct.recall)}</td>` +
    `<td class="num">${cell(ct.f1)}</td>` +
    deltaCell(ct.f1, bt.f1) +
    `<td></td></tr>`;
  return `<h3>${scope}</h3><table><thead><tr><th>section</th><th>gold</th><th>pred</th><th>Δ</th>
    <th>match</th><th>Δ</th><th>prec</th><th>recall</th><th>F1</th><th>ΔF1</th><th>F1 vs baseline</th>
    </tr></thead><tbody>${rows}${total}</tbody></table>`;
}

function caseTable(baseline: Run, current: Run): string {
  const moves = caseMoves(baseline, current, 'final');
  if (moves.length === 0) return '<p class="muted">No cases are scored in both runs.</p>';
  const span = Math.max(0.05, ...moves.map((m) => Math.abs(m.change)));
  const rows = moves
    .map((m) => {
      // Centred bar: left of the midline is a regression, right is a gain.
      const width = (Math.abs(m.change) / span) * 50;
      const bar =
        `<div class="dbar"><span class="mid"></span>` +
        `<span class="seg ${m.change < 0 ? 'down' : 'up'}" style="${
          m.change < 0 ? `right:50%;` : `left:50%;`
        }width:${width.toFixed(1)}%"></span></div>`;
      return (
        `<tr><td>${m.caseId}</td><td class="num">${cell(m.base)}</td><td class="num">${cell(m.current)}</td>` +
        deltaCell(m.current, m.base) +
        `<td class="barcell">${bar}</td></tr>`
      );
    })
    .join('');
  return `<table><thead><tr><th>case</th><th>baseline F1</th><th>current F1</th><th>Δ</th>
    <th>movement</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function countersTable(baseline: Run, current: Run): string {
  const keys = [...new Set([...Object.keys(baseline.summary.counters), ...Object.keys(current.summary.counters)])]
    .filter((k) => (baseline.summary.counters[k] ?? 0) || (current.summary.counters[k] ?? 0))
    .sort();
  const rows = keys
    .map((k) => {
      const b = baseline.summary.counters[k] ?? 0;
      const c = current.summary.counters[k] ?? 0;
      return `<tr><td>${k}</td><td class="num">${b}</td><td class="num">${c}</td>${deltaIntCell(c, b)}</tr>`;
    })
    .join('');
  return `<table><thead><tr><th>counter</th><th>baseline</th><th>current</th><th>Δ</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function usageTable(baseline: Run, current: Run): string {
  const rows = ['planner', 'review']
    .filter((call) => (baseline.summary.usage?.[call]?.calls ?? 0) || (current.summary.usage?.[call]?.calls ?? 0))
    .map((call) => {
      const b = baseline.summary.usage?.[call] ?? {};
      const c = current.summary.usage?.[call] ?? {};
      return (
        `<tr><td>${call}</td><td class="num">${c.calls ?? 0}</td>${deltaIntCell(c.calls ?? 0, b.calls ?? 0)}` +
        `<td class="num">${(c.inputTokens ?? 0).toLocaleString()}</td>${deltaIntCell(
          c.inputTokens ?? 0,
          b.inputTokens ?? 0
        )}<td class="num">${(c.outputTokens ?? 0).toLocaleString()}</td>${deltaIntCell(
          c.outputTokens ?? 0,
          b.outputTokens ?? 0
        )}</tr>`
      );
    })
    .join('');
  return `<table><thead><tr><th>call</th><th>calls</th><th>Δ</th><th>in</th><th>Δ</th><th>out</th><th>Δ</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

function buildHtml(baseline: Run, current: Run): string {
  const mismatched =
    [...current.cases.keys()].some((id) => !baseline.cases.has(id)) ||
    [...baseline.cases.keys()].some((id) => !current.cases.has(id));
  const warning = mismatched
    ? `<p class="warn">The runs do not cover the same cases. Aggregate deltas below mix a code change
       with a corpus change — read the per-case table, not the totals.</p>`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Easy Chart eval — ${current.name} vs ${baseline.name}</title>
<style>
  :root { --bg:#fff; --fg:#16181d; --muted:#6b7280; --line:#e5e7eb; --up:#15803d; --down:#b91c1c;
          --bar:#3b82f6; --ghost:#cbd5e1; --warnbg:#fef3c7; --warnfg:#92400e; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0f1115; --fg:#e6e8ec; --muted:#9aa1ac; --line:#242832; --up:#4ade80; --down:#f87171;
            --bar:#60a5fa; --ghost:#39414f; --warnbg:#3b2f0b; --warnfg:#fcd34d; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:32px; background:var(--bg); color:var(--fg);
         font:14px/1.5 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; } h2 { font-size:16px; margin:32px 0 8px; }
  h3 { font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:20px 0 6px; }
  .sub { color:var(--muted); margin:0 0 8px; }
  .warn { background:var(--warnbg); color:var(--warnfg); padding:10px 12px; border-radius:6px; }
  .muted { color:var(--muted); }
  .wrap { overflow-x:auto; }
  table { border-collapse:collapse; width:100%; font-variant-numeric:tabular-nums; }
  th,td { text-align:left; padding:5px 10px; border-bottom:1px solid var(--line); white-space:nowrap; }
  th { color:var(--muted); font-weight:600; font-size:12px; }
  td.num { text-align:right; }
  tr.total td { font-weight:700; border-top:2px solid var(--line); }
  .up { color:var(--up); } .down { color:var(--down); } .flat { color:var(--muted); }
  .barcell { width:200px; }
  .bar { position:relative; height:10px; background:transparent; width:180px; }
  .bar .ghost,.bar .fill { position:absolute; top:0; height:10px; border-radius:2px; }
  .bar .ghost { background:var(--ghost); } .bar .fill { background:var(--bar); height:6px; top:2px; }
  .dbar { position:relative; height:12px; width:180px; }
  .dbar .mid { position:absolute; left:50%; top:0; width:1px; height:12px; background:var(--line); }
  .dbar .seg { position:absolute; top:2px; height:8px; border-radius:2px; }
  .dbar .seg.up { background:var(--up); } .dbar .seg.down { background:var(--down); }
  footer { margin-top:40px; color:var(--muted); font-size:12px; }
</style></head><body>
<h1>Easy Chart eval — ${current.name} <span class="muted">vs</span> ${baseline.name}</h1>
<p class="sub">${current.summary.scoredCases} cases scored · baseline ${baseline.summary.scoredCases} ·
  generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</p>
${warning}
<h2>Sections</h2><div class="wrap">${scopeTable(baseline, current, 'plannerOnly')}
${scopeTable(baseline, current, 'final')}</div>
<h2>Per case <span class="muted" style="font-weight:400">— scope: final</span></h2>
<div class="wrap">${caseTable(baseline, current)}</div>
<h2>Counters</h2><div class="wrap">${countersTable(baseline, current)}</div>
<h2>Model usage</h2><div class="wrap">${usageTable(baseline, current)}</div>
<footer>Built from summary.json and *.score.json only — never from *.result.json, which carries the
clinical text. This page contains counts and case ids and no patient data; it is still written into a
gitignored directory, and should stay in one.</footer>
</body></html>`;
}

function main(argv: string[]): void {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const outIndex = argv.indexOf('--out');
  const out = outIndex >= 0 ? argv[outIndex + 1] : undefined;
  const dirs = argv.filter((a, i) => !a.startsWith('--') && !(outIndex >= 0 && i === outIndex + 1));

  if (dirs.length < 2) {
    console.error(
      'Usage: npx tsx tools/easy-chart-eval/report.ts <baselineDir> <currentDir> [--out file.html] [--no-html]\n' +
        '  Compares each run after the first against the first.'
    );
    process.exit(2);
  }

  const baseline = loadRun(dirs[0]);
  for (const dir of dirs.slice(1)) {
    const current = loadRun(dir);
    printReport(baseline, current);
    if (!flags.has('--no-html')) {
      const target = out ?? join(current.dir, `report-vs-${baseline.name}.html`);
      writeFileSync(target, buildHtml(baseline, current), 'utf8');
      console.log(`\n  html → ${target}`);
    }
  }
}

main(process.argv.slice(2));
