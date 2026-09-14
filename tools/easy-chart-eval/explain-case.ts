/**
 * explain-case.ts — one case, fully unpacked, for reading by a human.
 *
 * The score files say a section scored .334; they cannot say WHY, and the three files that could —
 * the case, the run result and the grounding judgments — have to be read side by side with three
 * different match keys in mind. This writes the join: the dialogue with numbered turns, then every
 * item the run charted, each carrying
 *
 *   - which gold item it matched, and under which key, or that the gold has no such item;
 *   - when the gold lacks it, what the grounding judge said and the quote it relied on;
 *   - the turn that quote came from, so a claim can be checked against the dialogue above it.
 *
 * The matching is the SCORER'S, not a re-implementation: normCode for codes, rosBaseAndPolarity for
 * ROS, nameMatch for the fuzzy drug pool. A private key here would produce a readable file that
 * disagreed with the numbers it is meant to explain.
 *
 * It also lists the gold items the run never charted, because "what did we miss" is the other half of
 * the same question and it is free once the maps are built.
 *
 * OUTPUT IS PHI — transcript and clinical content — and lands beside the result files, which are
 * already gitignored for the same reason.
 *
 * Usage:
 *   npx tsx tools/easy-chart-eval/explain-case.ts <runDir> case001 [case002 ...]
 *   npx tsx tools/easy-chart-eval/explain-case.ts <runDir> --all
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { nameMatch, normCode, rosBaseAndPolarity } from './score-harvested';

interface Turn {
  n: number;
  speaker: string;
  text: string;
}

function turnsOf(transcript: string): Turn[] {
  const out: Turn[] = [];
  let n = 0;
  for (const line of transcript.split('\n')) {
    const m = /^([A-Z][A-Za-z ]{1,20}):\s*(.*)$/.exec(line);
    if (m) out.push({ n: ++n, speaker: m[1], text: m[2] });
    else if (line.trim() && out.length) out[out.length - 1].text += ` ${line.trim()}`;
    else if (line.trim()) out.push({ n: ++n, speaker: '(unlabelled)', text: line.trim() });
  }
  return out;
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Which turn an evidence quote came from.
 *
 * Substring first; the judge is allowed to paraphrase, so fall back to the turn sharing the most
 * substantial words. Reported as "~turn N" when it is the fallback, because a paraphrase match is a
 * guess and labelling it as certain would be the same overclaiming the quote itself invites.
 */
function locate(quote: string, turns: Turn[]): string {
  if (!quote?.trim()) return '';
  const q = norm(quote);
  for (const t of turns) if (norm(t.text).includes(q)) return `turn ${t.n}`;
  const words = q.split(' ').filter((w) => w.length >= 4);
  if (words.length === 0) return 'not located';
  let best: { n: number; hits: number } = { n: 0, hits: 0 };
  for (const t of turns) {
    const text = norm(t.text);
    const hits = words.filter((w) => text.includes(w)).length;
    if (hits > best.hits) best = { n: t.n, hits };
  }
  return best.hits >= Math.ceil(words.length / 2) ? `~turn ${best.n}` : 'not located';
}

type GoldEntry = {
  key: string;
  label: string;
  voiced?: boolean;
  evidence?: string;
  kind: 'scored' | 'unvoiced' | 'context';
};

function goldMaps(gold: Record<string, any>): Record<string, Map<string, GoldEntry>> {
  const maps: Record<string, Map<string, GoldEntry>> = {};
  const put = (sec: string, key: string, e: GoldEntry): void => {
    maps[sec] ??= new Map();
    if (key && !maps[sec].has(key)) maps[sec].set(key, e);
  };
  for (const d of gold.assessment?.diagnoses ?? []) {
    put('diagnoses', d.codeNormalized, {
      key: d.codeNormalized,
      label: `${d.codeNormalized} — ${d.display}${d.primary ? ' (primary)' : ''}`,
      voiced: d.voiced,
      evidence: d.voicedEvidence,
      kind: d.fromLabOrder ? 'context' : d.voiced === false ? 'unvoiced' : 'scored',
    });
  }
  for (const c of gold.billing?.cptCodes ?? []) {
    put('cpt', c.codeNormalized, {
      key: c.codeNormalized,
      label: `${c.codeNormalized} — ${c.display}`,
      voiced: c.voiced,
      evidence: c.voicedEvidence,
      kind: c.voiced === false ? 'unvoiced' : 'scored',
    });
  }
  for (const o of gold.reviewOfSystems?.observations ?? []) {
    if (o.present !== true) continue;
    const { base } = rosBaseAndPolarity(o.field);
    put('ros', base, {
      key: base,
      label: o.label ?? o.field,
      voiced: o.voiced,
      evidence: o.voicedEvidence,
      kind: o.voiced === false ? 'unvoiced' : 'scored',
    });
  }
  for (const e of gold.exam ?? []) {
    if (e.present !== true) continue;
    put('exam', e.field, {
      key: e.field,
      label: e.label ?? e.field,
      voiced: e.voiced,
      evidence: e.voicedEvidence,
      kind: e.voiced === false ? 'unvoiced' : 'scored',
    });
  }
  const medSrc: [string, any[]][] = [
    ['prescribed', gold.medications?.prescribed ?? []],
    ['in-house', gold.medications?.inHouseAdministered ?? []],
    ['immunization', gold.medications?.immunizations ?? []],
    ['reconciled (context)', gold.medications?.currentReconciled ?? []],
  ];
  for (const [origin, list] of medSrc) {
    for (const m of list) {
      put('medications', norm(m.name ?? ''), {
        key: norm(m.name ?? ''),
        label: `${m.name} [${origin}]`,
        voiced: m.voiced,
        evidence: m.voicedEvidence,
        kind: origin.includes('context') ? 'context' : m.voiced === false ? 'unvoiced' : 'scored',
      });
    }
  }
  return maps;
}

function explain(runDir: string, caseId: string): void {
  const casesDir = join(dirname(dirname(runDir)), 'harvested-cases');
  const c = JSON.parse(readFileSync(join(casesDir, `${caseId}.json`), 'utf8')) as {
    transcript?: string;
    gold: Record<string, any>;
    quality?: Record<string, unknown>;
  };
  const r = JSON.parse(readFileSync(join(runDir, `${caseId}.result.json`), 'utf8')) as Record<string, any>;
  const state = r.state ?? r.finalState ?? {};
  const gPath = join(runDir, `${caseId}.grounding.json`);
  const grounding = existsSync(gPath)
    ? (JSON.parse(readFileSync(gPath, 'utf8')) as {
        items: { section: string; text: string; grounded: boolean; evidence?: string }[];
      })
    : undefined;
  const groundBy = new Map<string, { grounded: boolean; evidence?: string }>();
  for (const it of grounding?.items ?? []) groundBy.set(`${it.section}|${norm(it.text)}`, it);

  const turns = turnsOf((c.transcript ?? '').trim());
  const maps = goldMaps(c.gold ?? {});
  const md: string[] = [];
  md.push(`# ${caseId}`, '');
  if (c.quality)
    md.push(
      `corpus screen: **${(c.quality as any).verdict}**${(c.quality as any).why ? ` — ${(c.quality as any).why}` : ''}`,
      ''
    );
  md.push(
    "Every prediction below is matched with the SCORER's keys. `grounded` is the judge asking whether the dictation supports an item the gold lacks.",
    ''
  );

  md.push('## Dialogue', '');
  for (const t of turns) md.push(`**${t.n}. ${t.speaker}:** ${t.text}`);
  md.push('');

  const live = (arr: unknown): Record<string, any>[] =>
    (Array.isArray(arr) ? arr : []).filter((x: any) => x && !x.removed);
  const rows: [string, { key: string; label: string; source?: string }[]][] = [
    [
      'diagnoses',
      live(state.diagnoses).map((p) => ({
        key: normCode(p.code),
        label: `${normCode(p.code) || '(no code)'} — ${p.display ?? ''}${p.isPrimary ? ' (primary)' : ''}`,
        source: p.source,
      })),
    ],
    [
      'cpt',
      live(state.cptCodes).map((p) => ({
        key: normCode(p.code),
        label: `${normCode(p.code)} — ${p.display ?? ''}`,
        source: p.source,
      })),
    ],
    [
      'ros',
      live(state.rosObservations).map((p) => ({ key: p.baseKey, label: p.label ?? p.baseKey, source: p.source })),
    ],
    ['exam', live(state.examObservations).map((p) => ({ key: p.field, label: p.label ?? p.field, source: p.source }))],
    [
      'medications',
      live(state.medications).map((p) => ({ key: norm(p.display ?? ''), label: p.display ?? '', source: p.source })),
    ],
  ];

  md.push('## What the run charted', '');
  for (const [section, preds] of rows) {
    if (preds.length === 0) continue;
    md.push(`### ${section} — ${preds.length} charted`, '');
    md.push('| charted | by | gold match | verdict | evidence | turn |', '|---|---|---|---|---|---|');
    const map = maps[section] ?? new Map<string, GoldEntry>();
    for (const p of preds) {
      // Medications match fuzzily, exactly as the scorer pools them; everything else is an exact key.
      let hit: GoldEntry | undefined = map.get(p.key);
      if (!hit && section === 'medications')
        hit = [...map.values()].find((g) => nameMatch(p.label, g.label.replace(/ \[.*$/, '')));
      let verdict: string;
      let evidence = '';
      let turn = '';
      if (hit?.kind === 'scored') {
        verdict = '**matched (voiced gold)**';
        evidence = hit.evidence ?? '';
        turn = locate(evidence, turns);
      } else if (hit?.kind === 'unvoiced') {
        verdict = 'on unvoiced gold — forgiven';
      } else if (hit?.kind === 'context') {
        verdict = 'on context gold — forgiven';
      } else {
        const j = groundBy.get(`${section}|${norm(p.label)}`);
        verdict = j
          ? j.grounded
            ? 'NOT in gold, but **grounded** in the dictation'
            : 'NOT in gold, **not grounded** — false positive'
          : 'NOT in gold (not judged)';
        evidence = j?.evidence ?? '';
        turn = locate(evidence, turns);
      }
      md.push(
        `| ${p.label} | ${p.source ?? ''} | ${hit ? hit.label : '—'} | ${verdict} | ${
          evidence ? `"${evidence}"` : ''
        } | ${turn} |`
      );
    }
    md.push('');
  }

  const missedBlocks: string[] = [];
  for (const [section, preds] of rows) {
    const map = maps[section] ?? new Map<string, GoldEntry>();
    const predKeys = new Set(preds.map((p) => p.key));
    const missed = [...map.values()].filter((g) => g.kind === 'scored' && !predKeys.has(g.key));
    if (missed.length === 0) continue;
    missedBlocks.push(`### ${section} — ${missed.length} missed`, '');
    missedBlocks.push('| gold item | voiced | evidence | turn |', '|---|---|---|---|');
    for (const g of missed)
      missedBlocks.push(
        `| ${g.label} | ${g.voiced === true ? 'yes' : g.voiced === false ? 'no' : '—'} | ${
          g.evidence ? `"${g.evidence}"` : ''
        } | ${locate(g.evidence ?? '', turns)} |`
      );
    missedBlocks.push('');
  }
  // Only SCORED gold can be missed: unvoiced and context items are excluded from recall by design, so
  // listing them here would contradict the denominators this file exists to explain.
  md.push('## Gold the run never charted', '');
  md.push(...(missedBlocks.length ? missedBlocks : ['Nothing: every scored gold item was charted.', '']));

  const out = join(runDir, `${caseId}.explain.md`);
  writeFileSync(out, md.join('\n'));
  console.log(`${caseId} -> ${out}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const runDir = args.find((a) => !a.startsWith('--') && existsSync(a));
  if (!runDir) {
    console.log('usage: explain-case.ts <runDir> case001 [case002 ...] | <runDir> --all');
    process.exit(1);
  }
  const ids = args.includes('--all')
    ? readdirSync(runDir)
        .filter((f) => f.endsWith('.result.json'))
        .map((f) => f.replace('.result.json', ''))
        .sort()
    : args.filter((a) => /^case\d+$/.test(a));
  if (ids.length === 0) {
    console.log('name at least one caseNNN, or pass --all');
    process.exit(1);
  }
  for (const id of ids) explain(runDir, id);
}

main();
