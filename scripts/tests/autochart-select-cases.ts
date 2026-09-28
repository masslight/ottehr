/**
 * Ranks the eval corpus for the Autochart suites: which recordings are the best evidence.
 *
 *   npx tsx scripts/tests/autochart-select-cases.ts                    # the OK tier, ranked; committed cases marked ★
 *   npx tsx scripts/tests/autochart-select-cases.ts --top 20           # the twenty best
 *   npx tsx scripts/tests/autochart-select-cases.ts --ids --top 20     # ids only, one per line
 *   npx tsx scripts/tests/autochart-select-cases.ts --json out.json    # every metric, machine-readable
 *   npx tsx scripts/tests/autochart-select-cases.ts --tier OK,GOLD-GAP # other tiers of the corpus screening
 *   npx tsx scripts/tests/autochart-select-cases.ts case668            # one case, every metric and the words behind them
 *
 * A recording is good evidence when the chart and the recording agree — what the chart has was said, and what
 * was said the chart has — and the recording itself is whole: long enough, two speakers, turns in balance, the
 * labels on the right speaker, not cut. The corpus's own screening (tools/easy-chart-eval/case-quality.ts,
 * stamped into every case as `quality`) gives the tier, the length, the turn count and the voiced counts; this
 * tool adds the agreement per section, the "said but not charted" heuristics, the speaker-label checks and
 * whether the patient's age and sex can be read from the chart. Every metric is printed; `scoreOf` is one way
 * of ordering them, and the suites' `--corpus all|top:N` takes the order from here.
 *
 * Everything here is a heuristic over words. Read the columns, not just the score.
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { BRANDS, CorpusCase, listCorpusIds, parsePatient, readCorpusCase } from './autochart-corpus';

export interface CaseMetrics {
  id: string;
  verdict: string;
  flags: string[];
  status: string;
  /** "47M", "10moF", or "—" when the HPI does not say. */
  patient: string;
  patientParsed: boolean;
  chars: number;
  turns: number;
  /** Share of the turns held by the rarer of the two speakers: 0.5 is a dialogue, 0 a monologue. */
  balance: number;
  /** Share of speaker-typical phrases found under the other speaker's label: above 0.5 the labels are swapped. */
  labelSwap: number;
  truncated: boolean;
  goldItems: number;
  voicedItems: number;
  voicedShare: number;
  dx: { total: number; voiced: number };
  ros: { total: number; voiced: number };
  exam: { total: number; voiced: number };
  /** Prescriptions whose NAME was said. */
  rx: { total: number; voiced: number };
  disposition: { present: boolean; voiced: boolean };
  /** Voiced share over the orders alone: diagnoses, prescriptions, disposition. */
  ordersShare: number;
  unvoicedOrders: number;
  unvoicedNormals: number;
  /** Drug names the recording says that no chart medication accounts for. */
  drugsSaidNotCharted: string[];
  /** Topics the recording states whose chart section is empty. */
  gaps: string[];
  score: number;
}

// ── The recording ─────────────────────────────────────────────────────────────

const PROVIDER_SAYS = [
  /what brings you/i,
  /what'?s going on/i,
  /how long (?:has|have)/i,
  /any (?:fever|chills|cough|nausea|vomiting|numbness|tingling|allergies|pain)/i,
  /let me (?:take a )?(?:look|listen)/i,
  /open (?:up|your mouth)/i,
  /deep breaths?/i,
  /i'?m going to (?:give|prescribe|send|write|order|check|look|listen|have)/i,
  /we'?re going to (?:do|give|send|get|check|start)/i,
  /follow[- ]?up with/i,
  /i want you to/i,
  /does (?:it|this|that) hurt/i,
  /take (?:it|this|that|one|two) (?:twice|once|every|daily|as needed)/i,
];
const PATIENT_SAYS = [
  /i'?ve been (?:having|feeling|coughing|taking|getting)/i,
  /it (?:hurts|started|feels)/i,
  /my (?:throat|ears?|stomach|back|knees?|chest|head) (?:hurts?|is|has|feels?)/i,
  /i (?:feel|felt|noticed|woke up)/i,
  /i don'?t know/i,
];

interface Turn {
  speaker: string;
  text: string;
}

const turnsOf = (transcript: string): Turn[] =>
  transcript
    .split(/(?=\b(?:Provider|Patient):)/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^(Provider|Patient):\s*([\s\S]*)$/.exec(s);
      return m ? { speaker: m[1], text: m[2] } : { speaker: '?', text: s };
    });

function recording(transcript: string): Pick<CaseMetrics, 'turns' | 'balance' | 'labelSwap' | 'truncated'> {
  const turns = turnsOf(transcript).filter((t) => t.speaker !== '?');
  const provider = turns.filter((t) => t.speaker === 'Provider').length;
  const patient = turns.length - provider;
  const balance = turns.length ? Math.min(provider, patient) / turns.length : 0;
  let right = 0;
  let wrong = 0;
  for (const t of turns) {
    const p = PROVIDER_SAYS.filter((re) => re.test(t.text)).length;
    const q = PATIENT_SAYS.filter((re) => re.test(t.text)).length;
    if (t.speaker === 'Provider') {
      right += p;
      wrong += q;
    } else {
      right += q;
      wrong += p;
    }
  }
  const labelSwap = right + wrong >= 4 ? wrong / (right + wrong) : 0;
  const truncated = transcript.length > 0 && !/[.!?"'’]\s*$/.test(transcript);
  return { turns: turns.length, balance, labelSwap, truncated };
}

// ── Said but not charted ──────────────────────────────────────────────────────

/** First words of charted products that are words, not names ("Allergy Relief", "Clear Eyes", "Mucus Relief"). */
const NOT_A_DRUG = new Set([
  'allergy',
  'allergies',
  'antihistamine',
  'clear',
  'mucus',
  'sinus',
  'cough',
  'cold',
  'relief',
  'pain',
  'fever',
  'sleep',
  'daily',
  'night',
  'nighttime',
  'daytime',
  'extra',
  'adult',
  'children',
  'childrens',
  'infant',
  'infants',
  'junior',
  'maximum',
  'severe',
  'strength',
  'throat',
  'chest',
  'stomach',
  'headache',
  'migraine',
  'ankle',
  'wrist',
  'brace',
  'multivitamin',
  'multivitamins',
  'prenatal',
  'oral',
  'tablet',
  'capsule',
  'solution',
  'suspension',
  'sodium',
  'potassium',
  'vitamin',
  'misc',
  'saline',
  'water',
  'normal',
  'sterile',
  'other',
  'unknown',
  'generic',
  'brand',
  'topical',
  'nasal',
  'ophthalmic',
]);

const firstWord = (name: string): string =>
  name
    .trim()
    .split(/[\s-]+/)[0]
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const medNames = (gold: CorpusCase['gold']): string[] => {
  const m = gold.medications ?? ({} as NonNullable<CorpusCase['gold']['medications']>);
  return [
    ...(m.prescribed ?? []),
    ...(m.currentReconciled ?? []),
    ...(m.inHouseAdministered ?? []),
    ...(m.immunizations ?? []),
  ]
    .map((x) => (x.name ? firstWord(x.name) : ''))
    .filter((w) => w.length >= 5 && !NOT_A_DRUG.has(w));
};

let lexicon: Set<string> | undefined;
/**
 * Every drug the corpus ever charted, by its first word, plus the brand names a provider says aloud — minus
 * the words that are plain English rather than a name ("Clear Eyes", "Sinus Relief", "Allergy"): a word that
 * occurs in more than a seventh of all transcripts is a word, not a drug.
 */
function drugLexicon(ids: string[]): Set<string> {
  if (lexicon) return lexicon;
  const candidates = new Set<string>();
  const transcripts: string[] = [];
  for (const id of ids) {
    const raw = readCorpusCase(id);
    for (const w of medNames(raw.gold)) candidates.add(w);
    transcripts.push((raw.transcript ?? '').toLowerCase());
  }
  for (const brands of Object.values(BRANDS)) {
    for (const b of brands) if (/^[a-z]+$/.test(b)) candidates.add(b);
  }
  lexicon = new Set<string>();
  for (const w of candidates) {
    const re = new RegExp(`\\b${w}`);
    const inHowMany = transcripts.filter((t) => re.test(t)).length;
    if (inHowMany <= transcripts.length / 10) lexicon.add(w);
  }
  return lexicon;
}

function drugsSaidNotCharted(transcript: string, gold: CorpusCase['gold'], ids: string[]): string[] {
  const lex = drugLexicon(ids);
  const covered = new Set<string>();
  for (const w of medNames(gold)) {
    covered.add(w);
    for (const b of BRANDS[w] ?? []) covered.add(b);
  }
  const brandToGeneric = new Map<string, string>();
  for (const [generic, brands] of Object.entries(BRANDS)) for (const b of brands) brandToGeneric.set(b, generic);
  const said = new Set<string>();
  for (const m of transcript.toLowerCase().matchAll(/[a-z]{5,}/g)) {
    const w = m[0];
    if (!lex.has(w)) continue;
    const generic = brandToGeneric.get(w) ?? w;
    if (covered.has(w) || covered.has(generic)) continue;
    said.add(w);
  }
  return [...said].sort();
}

/** A topic the recording states, paired with the chart section that should then be non-empty (after case-quality.ts). */
const GAPS: { name: string; pattern: RegExp; empty: (g: CorpusCase['gold']) => boolean }[] = [
  {
    name: 'referral',
    pattern:
      /\brefer(?:ral|ring)? (?:you )?to\b|\bspecialist\b|gastroenterolog|orthoped|cardiolog|urolog|dermatolog|neurolog/i,
    empty: (g) => !/^specialty/.test(g.disposition?.type ?? ''),
  },
  {
    name: 'surgery',
    pattern:
      /\b(?:tonsillectomy|appendectomy|c-?section|cholecystectomy|hernia repair|had (?:my|his|her) \w+ (?:taken )?out|they removed|resection)\b/i,
    empty: (g) => (g.surgicalHistory ?? []).length === 0,
  },
  {
    name: 'allergy',
    pattern: /\ballergic to\b/i,
    empty: (g) => (g.allergies ?? []).length === 0,
  },
  {
    name: 'imaging',
    pattern: /\b(?:x-?ray|ultrasound|ct scan|mri)\b/i,
    empty: (g) => (g.radiology ?? []).length === 0,
  },
  {
    name: 'labs',
    pattern:
      /\b(?:rapid strep|strep test|urinalysis|urine (?:sample|test)|flu (?:test|swab)|covid (?:test|swab)|throat swab)\b/i,
    empty: (g) => {
      const n = (v: unknown): number =>
        Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0;
      return n(g.labs?.external) + n(g.labs?.inHouse) === 0;
    },
  },
];

// ── The chart's agreement with the recording ──────────────────────────────────

const count = <T extends { voiced?: boolean }>(items: T[]): { total: number; voiced: number } => ({
  total: items.length,
  voiced: items.filter((i) => i.voiced === true).length,
});

/**
 * One order over the metrics, after what the suites need:
 *   - agreement: the chart items the recording carries, as a share of the chart and of its orders alone (the
 *     template normals dilute the former), scaled down when there are too few voiced items to measure with;
 *   - the recording: long enough, enough turns, two speakers in balance, labels on the right speaker, not cut;
 *   - less unvoiced: chart orders never said weigh five times a template normal never said;
 *   - less said-but-not-charted: drug names and topics the recording has and the chart does not.
 * Between 0 and 1 for an ordinary case; the columns say why.
 */
export function scoreOf(m: CaseMetrics): number {
  const length = Math.min(1, m.chars / 2500);
  const turns = Math.min(1, m.turns / 20);
  const dialogue = 0.5 + 0.5 * Math.min(1, m.balance / 0.3);
  const labels = m.labelSwap > 0.5 ? 0.5 : m.labelSwap > 0.35 ? 0.8 : 1;
  const recordingQ = length * turns * dialogue * labels * (m.truncated ? 0.7 : 1);
  const enough = Math.min(1, m.voicedItems / 12);
  const agreement = (0.6 * m.voicedShare + 0.4 * m.ordersShare) * (0.5 + 0.5 * enough);
  const unvoiced = 0.5 * Math.min(1, m.unvoicedOrders / 5) + 0.5 * Math.min(1, m.unvoicedNormals / 60);
  const gap = Math.min(1, (m.drugsSaidNotCharted.length + m.gaps.length) / 4);
  return Math.round((0.45 * agreement + 0.3 * recordingQ - 0.15 * unvoiced - 0.1 * gap) * 1000) / 1000;
}

export function analyseCase(id: string, ids: string[]): CaseMetrics {
  const raw = readCorpusCase(id);
  const t = raw.transcript ?? '';
  const g = raw.gold;
  const q = raw.quality ?? {};
  const patient = parsePatient(g.historyOfPresentIllness);
  const dx = count((g.assessment?.diagnoses ?? []).filter((d) => !d.fromLabOrder));
  const ros = count((g.reviewOfSystems?.observations ?? []).filter((o) => o.present));
  const exam = count((g.exam ?? []).filter((e) => e.present));
  const rxItems = g.medications?.prescribed ?? [];
  const rx = { total: rxItems.length, voiced: rxItems.filter((m) => m.voiced && m.nameVoiced !== false).length };
  const disposition = { present: !!g.disposition?.type, voiced: !!g.disposition?.dispositionVoiced };
  const ordersTotal = dx.total + rx.total + (disposition.present ? 1 : 0);
  const ordersVoiced = dx.voiced + rx.voiced + (disposition.present && disposition.voiced ? 1 : 0);
  const goldItems = q.goldItems ?? dx.total + ros.total + exam.total + rx.total;
  const voicedItems = q.voicedItems ?? dx.voiced + ros.voiced + exam.voiced + rx.voiced;
  const metrics: CaseMetrics = {
    id,
    verdict: q.verdict ?? '?',
    flags: q.flags ?? [],
    status: raw.meta?.patientStatus ?? '?',
    patient: patient
      ? `${patient.ageYears !== undefined ? patient.ageYears : `${patient.ageMonths}mo`}${patient.sex[0].toUpperCase()}`
      : '—',
    patientParsed: !!patient,
    chars: t.length,
    ...recording(t),
    goldItems,
    voicedItems,
    voicedShare: goldItems ? voicedItems / goldItems : 0,
    dx,
    ros,
    exam,
    rx,
    disposition,
    ordersShare: ordersTotal ? ordersVoiced / ordersTotal : 0,
    unvoicedOrders: ordersTotal - ordersVoiced,
    unvoicedNormals: ros.total - ros.voiced + (exam.total - exam.voiced),
    drugsSaidNotCharted: drugsSaidNotCharted(t, g, ids),
    gaps: GAPS.filter((gap) => gap.pattern.test(t) && gap.empty(g)).map((gap) => gap.name),
    score: 0,
  };
  metrics.score = scoreOf(metrics);
  return metrics;
}

/** The corpus, best first. */
export function rankCorpus(tiers: string[] = ['OK']): CaseMetrics[] {
  const ids = listCorpusIds();
  return ids
    .map((id) => analyseCase(id, ids))
    .filter((m) => tiers.includes(m.verdict))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** What `--corpus <selection>` runs: `all` and `top:N` are the ranking's order, otherwise ids. */
export function selectCorpusIds(selection: string): string[] {
  if (/^case\d+(?:,case\d+)*$/.test(selection)) return selection.split(',');
  const runnable = rankCorpus().filter((m) => m.patientParsed);
  const top = /^top:(\d+)$/.exec(selection);
  if (top) return runnable.slice(0, Number(top[1])).map((m) => m.id);
  if (selection === 'all') return runnable.map((m) => m.id);
  throw new Error(`--corpus takes all, top:N or a comma-separated list of case ids, not "${selection}"`);
}

// ── The command line ──────────────────────────────────────────────────────────

/** The corpus cases already copied into autochart-cases/, by their `sourceCase`. */
function committedSources(): Set<string> {
  const dir = path.resolve(__dirname, 'autochart-cases');
  const out = new Set<string>();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const json = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as { sourceCase?: string };
    if (json.sourceCase) out.add(json.sourceCase);
  }
  return out;
}

const pct = (x: number): string => `${Math.round(100 * x)}%`;

function printTable(rows: CaseMetrics[], committed: Set<string>): void {
  console.log(
    'rank  case      status       pt   chars turns  bal swap  voiced      orders     unv.ord unv.nrm  said-not-charted / gaps                    score'
  );
  rows.forEach((m, i) => {
    const mark = committed.has(m.id) ? '★' : ' ';
    const saidGap = [...m.drugsSaidNotCharted, ...m.gaps.map((g) => `[${g}]`)].join(' ').slice(0, 40);
    console.log(
      `${String(i + 1).padStart(4)} ${mark}${m.id.padEnd(9)} ${m.status.padEnd(12)} ${m.patient.padEnd(5)}` +
        `${String(m.chars).padStart(5)} ${String(m.turns).padStart(5)} ${m.balance.toFixed(2)} ${m.labelSwap.toFixed(
          2
        )}` +
        `  ${`${m.voicedItems}/${m.goldItems} ${pct(m.voicedShare)}`.padEnd(11)} ` +
        `${`${m.dx.voiced + m.rx.voiced + (m.disposition.present && m.disposition.voiced ? 1 : 0)}/${
          m.dx.total + m.rx.total + (m.disposition.present ? 1 : 0)
        } ${pct(m.ordersShare)}`.padEnd(10)} ` +
        `${String(m.unvoicedOrders).padStart(7)} ${String(m.unvoicedNormals).padStart(7)}  ${saidGap.padEnd(
          40
        )} ${m.score.toFixed(3)}` +
        `${m.truncated ? ' cut' : ''}${m.patientParsed ? '' : ' no-age/sex'}`
    );
  });
}

function printOne(id: string): void {
  const m = analyseCase(id, listCorpusIds());
  console.log(JSON.stringify(m, null, 2));
}

function main(): void {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const at = argv.indexOf(name);
    return at !== -1 ? argv[at + 1] : undefined;
  };
  const one = argv.find((a) => /^case\d+$/.test(a));
  if (one) return printOne(one);

  const tiers = (flag('--tier') ?? 'OK').split(',');
  let rows = rankCorpus(tiers);
  const minScore = flag('--min-score');
  if (minScore) rows = rows.filter((m) => m.score >= Number(minScore));
  const top = flag('--top');
  if (top) rows = rows.slice(0, Number(top));

  const jsonOut = flag('--json');
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(rows, null, 2));
  if (argv.includes('--ids')) {
    for (const m of rows) console.log(m.id);
    return;
  }
  const committed = committedSources();
  printTable(rows, committed);
  const runnable = rows.filter((m) => m.patientParsed).length;
  console.log(
    `\n${rows.length} case(s) in tier(s) ${tiers.join(
      ', '
    )}; ${runnable} with an age and sex in the HPI (runnable with --corpus); ` +
      `${rows.filter((m) => committed.has(m.id)).length} of them committed (★).`
  );
}

if (require.main === module) main();
