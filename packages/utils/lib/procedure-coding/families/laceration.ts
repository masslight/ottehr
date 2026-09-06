// Bespoke laceration-repair coding core for the declarative procedure-coding
// architecture. The ordered class cascade, class-dependent site grouping,
// cross-wound/cross-side summing, and complex base/add-on arithmetic exceed the
// weak table vocabulary, so this family stays code — but it consumes the facts +
// tables declared in ../tables/laceration-facts.json (every code number, band
// edge, group membership, unit cap, checklist, and payer note is data there) and
// returns the evaluator's exact result shapes so dispatch is uniform.
//
// Sided-site keys (see laceration-facts.json meta.vocabulary.sidedSiteKeys):
// paired sites appear only as '<site>-left' / '<site>-right' — the form offers no
// side-less option, so missing laterality is unrepresentable from the UI. Two key
// forms exist only for legacy/imported data, never for the form:
//   '<pairedSite>-unsided' — wounds whose source predates the sided vocabulary;
//     coded normally (full group membership) with a laterality item added to
//     requiredDocumentation.
//   'other' (or any unrecognized key) — review-not-authoritative: contributes no
//     codes; sets review plus a flag naming the key.
//
// Spec citations ("A2", "B1.3", ...) refer to laceration-cleanroom-spec.md, which
// wins over legacy-engine behavior wherever they differ (divergences are labeled
// in the external validation harness).

import { EvaluatorSuggestResult } from '../evaluator';
import { LacerationFacts, LacerationWound } from '../facts.types';
import { DefendCodeFinding, SuggestedClaimLine } from '../model.types';

// ── Tables document (laceration-facts.json) ────────────────────────────────────

type Cls = 'simple' | 'intermediate' | 'complex';

interface BandStep {
  code: string;
  maxCm: number | null;
}
interface SeriesDef {
  group: string;
  class: 'simple' | 'intermediate';
  steps: BandStep[];
}
interface ComplexDef {
  base: string;
  second: string;
  addOn: string;
}

interface Table {
  id: string;
  kind: string;
  groups?: Record<string, Record<string, string[]> | ComplexDef>;
  series?: SeriesDef[];
  floorCm?: number;
  defaultMaxUnitsPerDay?: number;
  caps?: { code: string; maxUnitsPerDay: number }[];
  codes?: string[];
  required?: string[];
  notes?: { trigger: string; note: string }[];
}

export interface LacerationDoc {
  families: {
    family: string;
    codes: string[];
    siteVocabulary: { paired: string[]; unsided: string[] };
    tables: Table[];
  }[];
}

interface Tables {
  codes: string[];
  paired: string[];
  unsided: string[];
  siteGroups: Record<Cls, Record<string, string[]>>;
  series: SeriesDef[];
  floorCm: number;
  complex: Record<string, ComplexDef>;
  capDefault: number;
  caps: Record<string, number>;
  checklists: { codes: string[]; required: string[] }[];
  payerNotes: Record<string, string>;
  siIndex: Record<string, { cls: 'simple' | 'intermediate'; group: string }>;
  cxIndex: Record<string, { group: string; role: 'base' | 'second' | 'addOn' }>;
}

const docCache = new WeakMap<LacerationDoc, Tables>();

function parseDoc(doc: LacerationDoc): Tables {
  const cached = docCache.get(doc);
  if (cached) return cached;
  const fam = doc.families.find((f) => f.family === 'laceration-repair');
  if (!fam) throw new Error('laceration-repair family not found in tables document');
  const table = (kind: string): Table => {
    const found = fam.tables.find((x) => x.kind === kind);
    if (!found) throw new Error(`missing ${kind} table`);
    return found;
  };
  const t: Tables = {
    codes: fam.codes,
    paired: fam.siteVocabulary.paired,
    unsided: fam.siteVocabulary.unsided,
    siteGroups: table('siteGroups').groups as Record<Cls, Record<string, string[]>>,
    series: table('bandSeries').series ?? [],
    floorCm: table('complexSeries').floorCm ?? 1.1,
    complex: table('complexSeries').groups as Record<string, ComplexDef>,
    capDefault: table('unitCaps').defaultMaxUnitsPerDay ?? 1,
    caps: Object.fromEntries((table('unitCaps').caps ?? []).map((c) => [c.code, c.maxUnitsPerDay])),
    checklists: fam.tables
      .filter((x) => x.kind === 'docChecklist')
      .map((x) => ({ codes: x.codes ?? [], required: x.required ?? [] })),
    payerNotes: Object.fromEntries((table('payerNotes').notes ?? []).map((n) => [n.trigger, n.note])),
    siIndex: {},
    cxIndex: {},
  };
  for (const s of t.series) {
    for (const step of s.steps) t.siIndex[step.code] = { cls: s.class, group: s.group };
  }
  for (const [group, def] of Object.entries(t.complex)) {
    t.cxIndex[def.base] = { group, role: 'base' };
    t.cxIndex[def.second] = { group, role: 'second' };
    t.cxIndex[def.addOn] = { group, role: 'addOn' };
  }
  docCache.set(doc, t);
  return t;
}

// ── Resolution: wounds → class buckets → claim lines ───────────────────────────

const EPS = 1e-9;
const CLS_RANK: Record<Cls, number> = { simple: 1, intermediate: 2, complex: 3 };

interface ParsedWound {
  key: string;
  base: string;
  w: LacerationWound;
  cls: Cls;
  adhesiveOnly: boolean;
}
interface Bucket {
  cls: Cls;
  group: string;
  totalCm: number;
  allAdhesive: boolean;
  wounds: ParsedWound[];
}

interface Evaluation {
  buckets: Bucket[];
  lines: { line: SuggestedClaimLine; bucket: Bucket }[];
  flags: string[];
  noteTriggers: string[];
  missing: string[];
  latAsks: string[];
  review: boolean;
  att: boolean;
  strips: boolean;
  floorGroups: string[];
  elementsDocumented: boolean;
  layeredDocumented: boolean;
}

function groupOf(t: Tables, cls: Cls, base: string): string {
  const groups = t.siteGroups[cls];
  const id = Object.keys(groups).find((g) => groups[g].includes(base));
  if (!id) throw new Error(`no ${cls} site group covers '${base}' — vocabulary/grouping data out of sync`);
  return id;
}

function addToBucket(t: Tables, byKey: Map<string, Bucket>, cls: Cls, pw: ParsedWound): void {
  const group = groupOf(t, cls, pw.base);
  const k = `${cls}|${group}`;
  const b = byKey.get(k) ?? { cls, group, totalCm: 0, allAdhesive: true, wounds: [] };
  b.totalCm = Math.round((b.totalCm + (pw.w.lengthCm ?? 0)) * 10) / 10;
  b.allAdhesive = b.allAdhesive && pw.adhesiveOnly;
  b.wounds.push(pw);
  byKey.set(k, b);
}

function emitBucket(t: Tables, ev: Evaluation, facts: LacerationFacts, b: Bucket): SuggestedClaimLine[] {
  if (b.cls === 'complex') {
    const g = t.complex[b.group];
    if (b.totalCm <= 2.5 + EPS) return [{ code: g.base, units: 1, modifiers: [] }];
    const second: SuggestedClaimLine = { code: g.second, units: 1, modifiers: [] };
    if (b.totalCm <= 7.5 + EPS) return [second];
    let units = Math.ceil((b.totalCm - 7.5) / 5 - EPS); // A6: each additional 5 cm OR LESS
    const cap = t.caps[g.addOn] ?? t.capDefault;
    if (units > cap) {
      ev.flags.push(`units_capped:${g.addOn}:${cap}`); // B4 MUE
      units = cap;
    }
    return [second, { code: g.addOn, units, modifiers: [] }];
  }
  if (b.allAdhesive) {
    if (facts.payer_type === 'medicare') {
      ev.flags.push(`medicare_adhesive_only:G0168:${b.group}`); // A1.4
      ev.noteTriggers.push('medicare-adhesive-only');
      return [{ code: 'G0168', units: 1, modifiers: [] }];
    }
    ev.noteTriggers.push('adhesive-only-cpt'); // A1.7 + open question 3
  }
  const series = t.series.find((s) => s.group === b.group);
  const step = series?.steps.find((st) => st.maxCm === null || b.totalCm <= st.maxCm + EPS);
  if (!step) throw new Error(`no band step for group ${b.group} at ${b.totalCm} cm`);
  return [{ code: step.code, units: 1, modifiers: [] }];
}

function evaluate(t: Tables, facts: LacerationFacts): Evaluation {
  const ev: Evaluation = {
    buckets: [],
    lines: [],
    flags: [],
    noteTriggers: [],
    missing: [],
    latAsks: [],
    review: false,
    att: false,
    strips: false,
    floorGroups: [],
    elementsDocumented: false,
    layeredDocumented: false,
  };
  if (facts.adjacent_tissue_transfer === true) {
    ev.att = true;
    ev.review = true;
    ev.flags.push('out_of_family:adjacent_tissue_transfer_14xxx'); // A1.8
    return ev;
  }
  const entries = Object.entries(facts.wounds ?? {});
  if (entries.length === 0) {
    ev.missing.push('wounds (site, repair depth, and length per wound)');
    return ev;
  }
  const codable: ParsedWound[] = [];
  for (const [key, list] of entries) {
    const m = /^(.*)-(left|right|unsided)$/.exec(key);
    const base = m ? m[1] : key;
    const known = m ? t.paired.includes(base) : t.unsided.includes(base);
    if (!known) {
      ev.review = true;
      ev.flags.push(`review:not_authoritative_site:${key}`);
      continue;
    }
    if (m?.[2] === 'unsided' && !ev.latAsks.includes(key)) ev.latAsks.push(key);
    for (const w of list) {
      const els = w.complexElements ?? [];
      if (els.length > 0) ev.elementsDocumented = true;
      let cls: Cls | undefined;
      let adhesiveOnly = false;
      switch (w.depth) {
        case 'adhesive-strips-only':
          ev.strips = true;
          ev.flags.push(`em_only:strips_only:${key}`); // A1.2: strips alone are E/M, no repair code
          continue;
        case 'tissue-adhesive-only':
          cls = 'simple'; // A1.4-A1.7; open question 3: contamination route not applied to adhesive-only
          adhesiveOnly = true;
          break;
        case 'single-layer':
          if (els.length > 0) ev.flags.push(`advisory:complex_elements_on_single_layer:${key}`); // A2: complex requires layered components
          cls = w.contaminated === true ? 'intermediate' : 'simple'; // A2 contamination route
          break;
        case 'layered':
          ev.layeredDocumented = true;
          cls = els.length > 0 ? 'complex' : 'intermediate'; // A2
          break;
        default:
          ev.missing.push(`repair depth for ${key}`);
          continue;
      }
      if (w.lengthCm === undefined) {
        ev.missing.push(`wound length (cm) for ${key}`);
        continue;
      }
      codable.push({ key, base, w, cls, adhesiveOnly });
    }
  }
  if (ev.missing.length > 0) return ev;

  // Bucket by class + class-specific site group, summing lengths across wounds and sides (A5.1).
  const byKey = new Map<string, Bucket>();
  for (const pw of codable) addToBucket(t, byKey, pw.cls, pw);

  // Complex floor (A2/A6): a group total under 1.1 cm is not reportable as complex —
  // fall back to what the layered closure alone establishes (intermediate), re-grouped.
  for (const b of [...byKey.values()]) {
    if (b.cls === 'complex' && b.totalCm < t.floorCm - EPS) {
      ev.flags.push(`complex_floor:${b.group}:${b.totalCm}cm`);
      ev.floorGroups.push(b.group);
      byKey.delete(`complex|${b.group}`);
      for (const pw of b.wounds) addToBucket(t, byKey, 'intermediate', pw);
    }
  }

  ev.buckets = [...byKey.values()].sort((a, b) => CLS_RANK[b.cls] - CLS_RANK[a.cls] || b.totalCm - a.totalCm);
  for (const b of ev.buckets) {
    for (const line of emitBucket(t, ev, facts, b)) ev.lines.push({ line, bucket: b });
  }
  if (ev.buckets.length > 1) ev.noteTriggers.push('multi-group-day'); // A5.3
  return ev;
}

// ── Forward: facts → claim lines + required documentation ──────────────────────

function assemble(t: Tables, ev: Evaluation): EvaluatorSuggestResult {
  const res: EvaluatorSuggestResult = {
    codes: [],
    requiredDocumentation: [],
    payerNotes: [],
    flags: [...ev.flags],
    aux: {},
  };
  if (ev.review) res.review = true;
  for (const key of ev.latAsks) {
    res.requiredDocumentation.push(
      `Laterality for '${key}': legacy side-less site key — document left vs right (B1.1)`
    );
  }
  if (ev.att) return res;
  if (ev.missing.length > 0) {
    // B1: code-determining facts are required documentation — refuse to emit rather than guess.
    for (const m of ev.missing) {
      res.flags.push(`missing:${m}`);
      res.requiredDocumentation.push(`Document ${m} — code-determining (B1)`);
    }
    return res;
  }
  let primaryEmitted = false;
  for (const { line } of ev.lines) {
    const out: SuggestedClaimLine = { ...line, modifiers: [...line.modifiers] };
    if (t.cxIndex[line.code]?.role !== 'addOn' && line.code !== 'G0168') {
      if (primaryEmitted) out.modifiers = [...out.modifiers, '59']; // A5.3
      primaryEmitted = true;
    }
    res.codes.push(out);
  }
  // G0168 emits one line per adhesive-only bucket; the per-day MUE (B4) caps the total.
  const g0168Cap = t.caps['G0168'] ?? t.capDefault;
  const g0168Lines = res.codes.filter((l) => l.code === 'G0168');
  if (g0168Lines.length > g0168Cap) {
    res.flags.push(`units_capped:G0168:${g0168Cap}`);
    let kept = 0;
    res.codes = res.codes.filter((l) => l.code !== 'G0168' || ++kept <= g0168Cap);
  }
  const emitted = res.codes.map((l) => l.code);
  for (const cl of t.checklists) {
    if (cl.codes.includes('*') ? emitted.length > 0 : cl.codes.some((c) => emitted.includes(c))) {
      res.requiredDocumentation.push(...cl.required);
    }
  }
  for (const trigger of new Set(ev.noteTriggers)) {
    const note = t.payerNotes[trigger];
    if (note) res.payerNotes.push(note);
  }
  return res;
}

export function suggest(doc: LacerationDoc, facts: LacerationFacts): EvaluatorSuggestResult {
  const t = parseDoc(doc);
  return assemble(t, evaluate(t, facts));
}

// ── Inverse: selected codes → per-code verdicts ────────────────────────────────

const DEHISCENCE_CODES = ['12020', '12021', '13160'];

export function defend(
  doc: LacerationDoc,
  selected: { code: string; units?: number }[],
  facts: LacerationFacts
): DefendCodeFinding[] {
  const t = parseDoc(doc);
  const ev = evaluate(t, facts);
  const sug = assemble(t, ev);
  const selectedCodes = selected.map((s) => s.code);
  const emitted = new Map(sug.codes.map((l) => [l.code, l]));
  const lineBucket = new Map(ev.lines.map((x) => [x.line.code, x.bucket]));

  return selected.map(({ code, units }) => {
    const si = t.siIndex[code];
    const cx = t.cxIndex[code];
    if (!si && !cx && code !== 'G0168') {
      return {
        code,
        status: 'not-assessed' as const,
        reasons: [
          DEHISCENCE_CODES.includes(code)
            ? `${code} covers dehiscence/secondary closure of surgical wounds — out of scope for fresh traumatic lacerations (A8)`
            : `${code} is outside the laceration-repair tables`,
        ],
      };
    }
    if (ev.att) {
      return {
        code,
        status: 'not-assessed' as const,
        reasons: [
          'adjacent tissue transfer documented — the repair is 14xxx ATT territory, outside these rules (A1.8)',
        ],
      };
    }

    const line = emitted.get(code);
    if (line) {
      const bucket = lineBucket.get(code);
      if (bucket && !bucket.allAdhesive && facts.closure_material === undefined) {
        // B1.3: closure material/method is required documentation for every repair code.
        return {
          code,
          status: 'not-supported' as const,
          reasons: ['required documentation missing: closure material/method (B1.3)'],
        };
      }
      const cap = t.caps[code] ?? t.capDefault;
      if ((units ?? line.units) > Math.min(line.units, cap)) {
        return {
          code,
          status: 'not-supported' as const,
          reasons: [`${units} units exceed the documented ${line.units} (per-day cap ${cap}, B4/A6)`],
        };
      }
      return {
        code,
        status: 'supported' as const,
        reasons: [
          `facts resolve to ${code}${
            line.units > 1 ? ` x${line.units}` : ''
          } — class, site group, and summed length all match`,
        ],
      };
    }

    // Not emitted — diagnose why.
    const reasons: string[] = [];
    if (ev.strips)
      reasons.push('adhesive strips alone are not separately reportable — included in the E/M service (A1.2)');
    if (ev.missing.length > 0) reasons.push(`code-determining facts undocumented: ${ev.missing.join('; ')} (B1)`);
    if (code === 'G0168')
      reasons.push('G0168 applies only to Medicare with tissue adhesive as the sole closure (A1.4)');
    if (cx?.role === 'addOn' && !selectedCodes.includes(t.complex[cx.group].second)) {
      reasons.push(`${code} is an add-on usable only in conjunction with ${t.complex[cx.group].second} (A6/B3.3)`);
    }
    if (cx && ev.floorGroups.includes(cx.group)) {
      reasons.push(
        `summed length is under the ${t.floorCm} cm complex floor — report simple/intermediate instead (A2/A6)`
      );
    }
    if (ev.missing.length === 0 && (si || cx)) {
      const cls: Cls = cx ? 'complex' : si.cls;
      const ofCls = ev.buckets.filter((b) => b.cls === cls);
      if (ofCls.length === 0 && ev.buckets.length > 0) {
        if (cx && ev.elementsDocumented && !ev.layeredDocumented) {
          reasons.push(
            'complex repair requires intermediate-level (layered closure) documentation in addition to a qualifying element (A2/B2)'
          );
        } else if (cx && !ev.elementsDocumented) {
          reasons.push('no CPT complex-repair qualifying element is documented (A2)');
        } else {
          reasons.push(`documentation resolves ${ev.buckets.map((b) => b.cls).join('/')} repair, not ${cls} (A2)`);
        }
      } else if (ofCls.length > 0) {
        const group = cx ? cx.group : si.group;
        const b = ofCls.find((x) => x.group === group);
        if (!b)
          reasons.push(`${cls} wounds fall in site group ${ofCls.map((x) => x.group).join('/')}, not ${group} (A3)`);
        else reasons.push(`summed ${group} length ${b.totalCm} cm supports a different line than ${code} (A4/A6)`);
      }
    }
    if (sug.codes.length > 0) {
      reasons.push(`facts yield ${sug.codes.map((l) => l.code + (l.units > 1 ? `x${l.units}` : '')).join(' + ')}`);
    }
    if (reasons.length === 0) reasons.push('the documented facts do not support this code');
    return { code, status: 'not-supported' as const, reasons };
  });
}
