/**
 * case-quality.ts — screen the CORPUS rather than the model: which cases are bad evidence?
 *
 * Every metric in this harness compares a prediction against a gold note, and silently assumes the
 * transcript and the note describe the same visit. Where they do not, the score measures the corpus.
 * Two failure shapes motivated this:
 *
 *   - the note is missing something the transcript plainly states. case001's provider says "Allergic
 *     to fentanyl" and `gold.allergies` is empty, so a model that charts the allergy is marked wrong.
 *   - the transcript is damaged. A recording cut mid-visit, or one whose diarisation collapsed so the
 *     whole dialogue is attributed to one speaker, cannot support the note no matter what reads it.
 *
 * Everything here is a HEURISTIC and is reported as a flag to look at, never as a verdict. The
 * keyword families are deliberately narrow — "allergic to" counts, a drug called "sinus allergy"
 * does not — because a loose pattern would bury the real cases in noise. Expect false positives and
 * read the ones you act on.
 *
 * The one non-heuristic signal is `voiced`: tag-voiced.ts already judged, per item, whether the
 * dictation supports it. A case where almost none of the note is voiced is one where the transcript
 * and the note have come apart, whatever the reason.
 *
 * Usage:
 *   npx tsx tools/easy-chart-eval/case-quality.ts                 # corpus summary + worst cases
 *   npx tsx tools/easy-chart-eval/case-quality.ts case001         # one case, in detail
 *   npx tsx tools/easy-chart-eval/case-quality.ts --flag gold-missing:allergies
 *   npx tsx tools/easy-chart-eval/case-quality.ts --csv > /tmp/quality.csv
 *   npx tsx tools/easy-chart-eval/case-quality.ts --verdict [out.md]   # classify every case, write lists
 *   npx tsx tools/easy-chart-eval/case-quality.ts --stamp              # write the verdict INTO each case file
 *
 * `--stamp` adds a top-level `quality` block to every caseNNN.json — additive, exactly like the voicing
 * tags: `gold` and every existing field are untouched, so a stamped corpus scores identically to an
 * unstamped one. The runner reads it via `--quality OK` to evaluate only the cases that can actually
 * measure a model. Re-running restamps in place, so the corpus never carries a stale verdict.
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CASES_DIR = join(__dirname, 'harvested-cases');

interface Gold {
  allergies?: unknown[];
  medicalHistory?: unknown[];
  surgicalHistory?: unknown[];
  hospitalizations?: unknown[];
  procedures?: unknown[];
  radiology?: unknown[];
  vitals?: unknown[];
  labs?: { external?: unknown; inHouse?: unknown };
  medications?: { prescribed?: unknown[]; inHouseAdministered?: unknown[] };
  assessment?: { diagnoses?: { voiced?: boolean; fromLabOrder?: boolean }[] };
  billing?: { emCode?: unknown; cptCodes?: { voiced?: boolean }[] };
  exam?: { present?: boolean; voiced?: boolean }[];
  reviewOfSystems?: { observations?: { present?: boolean; voiced?: boolean }[] };
  disposition?: { type?: string };
}

/**
 * A topic the transcript states outright, paired with the gold section that should then be non-empty.
 * Patterns are affirmative on purpose: "no known drug allergies" must NOT flag an empty allergy list,
 * because there an empty list is the correct answer.
 */
const TOPICS: { section: string; pattern: RegExp; empty: (g: Gold) => boolean }[] = [
  {
    section: 'allergies',
    pattern: /\ballergic to\b|\ballergies?\s*(?:are|include|:)\s*(?!none|no\b|nkda)/i,
    empty: (g) => (g.allergies ?? []).length === 0,
  },
  {
    section: 'medications.prescribed',
    pattern: /\b(?:i'?ll (?:send|call in|prescribe)|prescription for|send (?:it|that) to (?:the|your) pharmacy)\b/i,
    empty: (g) => (g.medications?.prescribed ?? []).length === 0,
  },
  {
    section: 'radiology',
    pattern: /\b(?:x-?ray|ultrasound|ct scan|mri)\b/i,
    empty: (g) => (g.radiology ?? []).length === 0,
  },
  {
    section: 'labs',
    pattern:
      /\b(?:rapid strep|strep test|urinalysis|urine (?:sample|test)|flu (?:test|swab)|covid (?:test|swab)|throat swab)\b/i,
    empty: (g) => {
      const e = g.labs?.external;
      const i = g.labs?.inHouse;
      const n = (v: unknown): number =>
        Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0;
      return n(e) + n(i) === 0;
    },
  },
  {
    section: 'procedures',
    pattern:
      /\b(?:splint(?:ed|ing)?|sutur(?:e|ed|ing)|stitch(?:es|ed)?|laceration repair|incision and drainage|cerumen removal|ear lavage|foreign body removal)\b/i,
    empty: (g) => (g.procedures ?? []).length === 0,
  },
  {
    section: 'surgicalHistory',
    pattern:
      /\b(?:tonsillectomy|appendectomy|c-?section|cholecystectomy|hernia repair|had (?:my|his|her) \w+ (?:taken )?out)\b/i,
    empty: (g) => (g.surgicalHistory ?? []).length === 0,
  },
  {
    section: 'vitals',
    pattern: /\b(?:blood pressure|\d{2,3} over \d{2,3}|temperature (?:is|was|of)|pulse ox|oxygen sat)\b/i,
    empty: (g) => (g.vitals ?? []).length === 0,
  },
  {
    section: 'disposition',
    pattern:
      /\b(?:follow(?:ing)? up (?:in|with)|come back (?:in|if)|go to the (?:er|emergency)|refer(?:ral|ring) (?:you )?to)\b/i,
    empty: (g) => !g.disposition?.type,
  },
];

/**
 * The tiers, ordered by what they cost a measurement.
 *
 * UNUSABLE is the only one that is really a verdict: a transcript of 39 characters, or one whose note
 * the judge could not source a single item from, cannot measure a model at all — whatever a run scores
 * on it is noise. The rest are degrees of "read before you trust it": DAMAGED still carries a visit,
 * GOLD-GAP means the transcript is fine and the NOTE is the incomplete side, so the model is marked
 * wrong for charting something that was actually said.
 */
type Verdict = 'UNUSABLE' | 'DAMAGED' | 'GOLD-GAP' | 'OK';

function verdictOf(r: Report): { verdict: Verdict; why: string } {
  const has = (f: string): boolean => r.flags.includes(f);
  const voicedPct = r.goldItems ? (100 * r.voicedItems) / r.goldItems : 0;
  if (r.goldItems > 0 && r.voicedItems === 0)
    return { verdict: 'UNUSABLE', why: 'not one gold item is supported by the transcript' };
  if (has('very-short')) return { verdict: 'UNUSABLE', why: `transcript is ${r.chars} characters` };
  if (has('no-speaker-labels') && has('few-turns')) return { verdict: 'UNUSABLE', why: 'no speaker structure at all' };
  // A transcript with no speaker structure at all is damaged whether or not one turn also dominates.
  // Without the `collapsed-turn` companion this fell through every branch below and was reported OK —
  // six cases, found only because the tier counts (330) disagreed with the no-flag count (324).
  if (has('no-speaker-labels'))
    return { verdict: 'DAMAGED', why: 'no speaker labels: the dialogue is one undifferentiated block' };
  if (has('single-speaker') && has('truncated-end'))
    return { verdict: 'DAMAGED', why: 'diarisation collapsed into one speaker AND the recording is cut' };
  if (has('single-speaker')) return { verdict: 'DAMAGED', why: 'the whole dialogue is attributed to one speaker' };
  if (has('truncated-end')) return { verdict: 'DAMAGED', why: 'the recording stops mid-sentence' };
  if (has('few-turns')) return { verdict: 'DAMAGED', why: `only ${r.turns} speaker turns for a whole visit` };
  const gaps = r.flags.filter((f) => f.startsWith('gold-missing:') || f.startsWith('gold-has-no'));
  if (gaps.length)
    return { verdict: 'GOLD-GAP', why: `the note is missing what the transcript states: ${gaps.join(', ')}` };
  if (voicedPct < 5)
    return { verdict: 'DAMAGED', why: `only ${voicedPct.toFixed(1)}% of the note is supported by the transcript` };
  return { verdict: 'OK', why: '' };
}

interface Report {
  caseId: string;
  chars: number;
  turns: number;
  speakers: Record<string, number>;
  biggestTurnShare: number;
  goldItems: number;
  voicedItems: number;
  flags: string[];
}

/** Voiced share over the items tag-voiced.ts judges: the note's own support in the dictation. */
function voicing(g: Gold): { total: number; voiced: number } {
  const items: { voiced?: boolean }[] = [
    ...(g.assessment?.diagnoses ?? []).filter((d) => !d.fromLabOrder),
    ...(g.billing?.cptCodes ?? []),
    ...(g.reviewOfSystems?.observations ?? []).filter((o) => o.present === true),
    ...(g.exam ?? []).filter((o) => o.present === true),
    ...(g.medications?.prescribed ?? []),
  ];
  return { total: items.length, voiced: items.filter((i) => i.voiced === true).length };
}

function analyse(caseId: string): Report {
  const raw = JSON.parse(readFileSync(join(CASES_DIR, `${caseId}.json`), 'utf8')) as {
    transcript?: string;
    gold: Gold;
  };
  const t = (raw.transcript ?? '').trim();
  const g = raw.gold ?? {};
  const flags: string[] = [];

  // Speaker turns: "Label: text" at a line start is the harvest format.
  const turnRe = /^([A-Z][A-Za-z ]{1,20}):\s*(.*)$/gm;
  const speakers: Record<string, number> = {};
  const turnLengths: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = turnRe.exec(t)) !== null) {
    speakers[m[1]] = (speakers[m[1]] ?? 0) + 1;
    turnLengths.push(m[2].length);
  }
  const turns = turnLengths.length;
  const biggestTurnShare = t.length > 0 && turns > 0 ? Math.max(...turnLengths) / t.length : 0;

  if (t.length < 400) flags.push('very-short');
  if (turns === 0) flags.push('no-speaker-labels');
  else if (Object.keys(speakers).length === 1) flags.push('single-speaker');
  // A collapsed diarisation shows up as a visit with almost no turns, NOT as a dominant turn.
  // Measured over the corpus: at 1-2 turns, 274 of 277 cases have one turn dominating and 79% have a
  // single speaker — those are broken. From 17 turns up only 14% have a dominant turn, and sampling
  // those found ordinary visits where the provider explains a plan at length. Flagging on the share
  // alone therefore condemned normal monologue-heavy encounters; the turn count is the real signal.
  if (turns <= 4) flags.push('few-turns');
  // Mid-sentence stop. A visit that simply ends on a period is not flagged; this catches the cut.
  if (t.length > 0 && !/[.!?"'’]$/.test(t)) flags.push('truncated-end');

  const v = voicing(g);
  if (v.total > 0 && v.voiced / v.total < 0.05) flags.push('almost-nothing-voiced');
  if ((g.assessment?.diagnoses ?? []).length === 0) flags.push('gold-has-no-diagnosis');
  if (!g.billing?.emCode) flags.push('gold-has-no-em-code');

  for (const topic of TOPICS) {
    if (topic.pattern.test(t) && topic.empty(g)) flags.push(`gold-missing:${topic.section}`);
  }

  return {
    caseId,
    chars: t.length,
    turns,
    speakers,
    biggestTurnShare,
    goldItems: v.total,
    voicedItems: v.voiced,
    flags,
  };
}

function detail(caseId: string): void {
  const r = analyse(caseId);
  const raw = JSON.parse(readFileSync(join(CASES_DIR, `${caseId}.json`), 'utf8')) as {
    transcript?: string;
    gold: Gold;
  };
  const t = raw.transcript ?? '';
  console.log(`${r.caseId}`);
  console.log(`  transcript ${r.chars} chars, ${r.turns} turns, speakers: ${JSON.stringify(r.speakers)}`);
  console.log(`  biggest single turn: ${(r.biggestTurnShare * 100).toFixed(1)}% of the transcript`);
  console.log(
    `  gold items judged: ${r.goldItems}, of which voiced: ${r.voicedItems} (${
      r.goldItems ? ((100 * r.voicedItems) / r.goldItems).toFixed(1) : '0'
    }%)`
  );
  console.log(`  ends: ${JSON.stringify(t.slice(-70))}`);
  console.log(`  flags: ${r.flags.length ? r.flags.join(', ') : 'none'}`);
  for (const topic of TOPICS) {
    if (!topic.pattern.test(t) || !topic.empty(raw.gold)) continue;
    console.log(`\n  gold.${topic.section} is EMPTY, but the transcript says:`);
    for (const line of t.split('\n')) if (topic.pattern.test(line)) console.log(`    ${line.trim().slice(0, 160)}`);
  }
}

/** Write the verdict into the case files, additively. */
function stamp(ids: string[]): void {
  const counts: Record<string, number> = {};
  for (const id of ids) {
    const path = join(CASES_DIR, `${id}.json`);
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    const r = analyse(id);
    const { verdict, why } = verdictOf(r);
    counts[verdict] = (counts[verdict] ?? 0) + 1;
    raw.quality = {
      verdict,
      why: why || undefined,
      flags: r.flags,
      chars: r.chars,
      turns: r.turns,
      goldItems: r.goldItems,
      voicedItems: r.voicedItems,
      screenedAt: new Date().toISOString().slice(0, 10),
    };
    writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`);
  }
  for (const [k, v] of Object.entries(counts)) console.log(`${k.padEnd(10)}${String(v).padStart(5)}`);
  console.log(`\nstamped ${ids.length} case files with a top-level \`quality\` block.`);
}

function main(): void {
  const args = process.argv.slice(2);
  const one = args.find((a) => /^case\d+$/.test(a));
  if (one) return detail(one);

  const flagFilter = args.includes('--flag') ? args[args.indexOf('--flag') + 1] : undefined;
  const ids = readdirSync(CASES_DIR)
    .filter((f) => /^case\d+\.json$/.test(f))
    .map((f) => f.replace('.json', ''))
    .sort();
  const reports = ids.map(analyse);

  if (args.includes('--csv')) {
    console.log('caseId,chars,turns,goldItems,voicedItems,voicedPct,flags');
    for (const r of reports) {
      console.log(
        `${r.caseId},${r.chars},${r.turns},${r.goldItems},${r.voicedItems},${
          r.goldItems ? ((100 * r.voicedItems) / r.goldItems).toFixed(1) : ''
        },"${r.flags.join(' ')}"`
      );
    }
    return;
  }

  if (flagFilter) {
    const hit = reports.filter((r) => r.flags.includes(flagFilter));
    console.log(`${hit.length} of ${reports.length} cases carry "${flagFilter}":\n`);
    for (const r of hit) console.log(`  ${r.caseId}  ${r.chars} chars, voiced ${r.voicedItems}/${r.goldItems}`);
    return;
  }

  if (args.includes('--stamp')) return stamp(ids);

  if (args.includes('--verdict')) {
    const outPath = args[args.indexOf('--verdict') + 1] ?? join(CASES_DIR, '..', 'CASE-QUALITY.md');
    const rows = reports.map((r) => ({ r, ...verdictOf(r) }));
    const byTier: Record<string, typeof rows> = { UNUSABLE: [], DAMAGED: [], 'GOLD-GAP': [], OK: [] };
    for (const row of rows) byTier[row.verdict].push(row);
    const md: string[] = [];
    md.push(
      '# Corpus quality',
      '',
      `${rows.length} cases screened. Heuristics, not verdicts — except UNUSABLE, where the transcript cannot support the note at all.`,
      ''
    );
    md.push('| tier | cases | share | meaning |', '|---|---:|---:|---|');
    const meaning: Record<string, string> = {
      UNUSABLE: 'cannot measure a model — exclude',
      DAMAGED: 'a real visit, but the recording is cut or its speakers are collapsed',
      'GOLD-GAP': 'transcript is fine; the NOTE omits something it states',
      OK: 'no flags',
    };
    for (const t of ['UNUSABLE', 'DAMAGED', 'GOLD-GAP', 'OK']) {
      md.push(
        `| ${t} | ${byTier[t].length} | ${((100 * byTier[t].length) / rows.length).toFixed(1)}% | ${meaning[t]} |`
      );
    }
    for (const t of ['UNUSABLE', 'DAMAGED', 'GOLD-GAP', 'OK']) {
      md.push('', `## ${t} — ${byTier[t].length} cases`, '');
      if (t === 'OK') {
        md.push('```', byTier[t].map((x) => x.r.caseId).join(' '), '```');
        continue;
      }
      md.push('| case | chars | turns | voiced / gold | why |', '|---|---:|---:|---:|---|');
      for (const x of byTier[t])
        md.push(`| ${x.r.caseId} | ${x.r.chars} | ${x.r.turns} | ${x.r.voicedItems}/${x.r.goldItems} | ${x.why} |`);
    }
    md.push('', '## Case ids only, for copy-paste', '');
    for (const t of ['UNUSABLE', 'DAMAGED', 'GOLD-GAP'])
      md.push(`**${t}**`, '', '```', byTier[t].map((x) => x.r.caseId).join(','), '```', '');
    writeFileSync(outPath, md.join('\n'));
    for (const t of ['UNUSABLE', 'DAMAGED', 'GOLD-GAP', 'OK']) {
      console.log(
        `${t.padEnd(10)}${String(byTier[t].length).padStart(5)}  (${((100 * byTier[t].length) / rows.length).toFixed(
          1
        )}%)  ${meaning[t]}`
      );
    }
    console.log(`\nwritten to ${outPath}`);
    return;
  }

  const counts: Record<string, number> = {};
  for (const r of reports) for (const f of r.flags) counts[f] = (counts[f] ?? 0) + 1;
  console.log(`${reports.length} cases in ${CASES_DIR}\n`);
  console.log('FLAG FREQUENCY  (a flag is something to look at, not a verdict)');
  for (const [f, c] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${f.padEnd(34)}${String(c).padStart(5)}  (${((100 * c) / reports.length).toFixed(1)}%)`);
  }
  const clean = reports.filter((r) => r.flags.length === 0).length;
  console.log(
    `  ${'(no flags)'.padEnd(34)}${String(clean).padStart(5)}  (${((100 * clean) / reports.length).toFixed(1)}%)`
  );

  console.log('\nWORST CASES by number of flags');
  for (const r of [...reports].sort((a, b) => b.flags.length - a.flags.length).slice(0, 15)) {
    console.log(
      `  ${r.caseId}  ${String(r.chars).padStart(5)} chars  voiced ${String(r.voicedItems).padStart(3)}/${String(
        r.goldItems
      ).padEnd(4)}  ${r.flags.join(', ')}`
    );
  }
  console.log('\nInspect one with:  npx tsx tools/easy-chart-eval/case-quality.ts caseNNN');
}

main();
