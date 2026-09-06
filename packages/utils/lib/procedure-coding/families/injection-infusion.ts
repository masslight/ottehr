// Bespoke therapeutic-injection/infusion coding core for the declarative
// procedure-coding architecture. The multi-administration initial-service
// hierarchy (physician primary-reason rule), 96366 unit arithmetic from start/stop
// timestamps, and second-initial separate-site gating exceed the weak table vocabulary
// (../tables/injection-ekg-decision-tables.json requiresBespokeCode #1/#2), so this
// family gets a code core — but every gate, band edge, unit cap, checklist, and payer
// note stays data in the tables: the core derives the scalar table facts
// (route_profile, num_im_sc_injections, infusion_total_minutes) from the declared
// administrations list, delegates single-path encounters to the generic evaluator
// wholesale, and re-enters the SAME threshold tables for each drug event it resolves
// in the multi-administration path (no band arithmetic is duplicated here).
//
// Facts shape mirrors the 'administrations' declaration in the tables JSON.
// Spec citations ("A4.2", "bespoke #1(e)", ...) refer to injection-ekg-cleanroom-spec.md,
// which wins over legacy-engine behavior wherever they differ.

import {
  checklistDocs,
  EvaluatorSuggestResult,
  Facts,
  familyCaps,
  getFamily,
  suggest as tableSuggest,
  TableDoc,
} from '../evaluator';
import { InjectionAdministration, InjectionInfusionFacts } from '../facts.types';
import { DefendCodeFinding, SuggestedClaimLine } from '../model.types';

const FAMILY = 'therapeutic-injection-infusion';

// ── Time and candidate resolution ──────────────────────────────────────────────

function segmentMinutes(start: string, stop: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = stop.split(':').map(Number);
  let t = eh * 60 + em - (sh * 60 + sm);
  if (t < 0) t += 24 * 60; // cross-midnight within one date of service (A3.1)
  return t;
}

/** One IV "drug event": an infusion drug group (segments summed, open question 3) or a push drug group. */
interface IvCandidate {
  kind: 'infusion' | 'push';
  drug: string;
  minutes: number;
  missingTimes: boolean; // some infusion segment lacks recorded start/stop (bespoke #2 → block)
  pushCount: number;
  ivSiteId?: string;
  primaryReason: boolean;
  separateEncounter: boolean;
}

function ivCandidates(admins: InjectionAdministration[]): IvCandidate[] {
  const byKey = new Map<string, IvCandidate>();
  for (const a of admins) {
    if (a.route !== 'iv-infusion' && a.route !== 'iv-push') continue;
    const kind = a.route === 'iv-infusion' ? 'infusion' : 'push';
    const drug = (a.drug ?? '').trim().toLowerCase();
    const key = `${kind}|${drug}`;
    const c: IvCandidate = byKey.get(key) ?? {
      kind,
      drug,
      minutes: 0,
      missingTimes: false,
      pushCount: 0,
      primaryReason: false,
      separateEncounter: false,
    };
    if (kind === 'infusion') {
      if (a.startTime !== undefined && a.stopTime !== undefined) c.minutes += segmentMinutes(a.startTime, a.stopTime);
      else c.missingTimes = true;
    } else {
      c.pushCount += 1;
    }
    // Free-text site labels: trim/casefold so 'Left AC ' and 'left ac' compare equal.
    const normalizedSiteId = a.ivSiteId?.trim().toLowerCase();
    c.ivSiteId = c.ivSiteId ?? (normalizedSiteId !== '' ? normalizedSiteId : undefined);
    c.primaryReason = c.primaryReason || a.primaryReason === true;
    c.separateEncounter = c.separateEncounter || a.separateEncounterReturn === true;
    byKey.set(key, c);
  }
  return [...byKey.values()];
}

// ── Multi-administration hierarchy resolution (bespoke #1) ─────────────────────

function resolveMultiAdmin(
  doc: TableDoc,
  res: EvaluatorSuggestResult,
  cands: IvCandidate[],
  imScCount: number,
  baseFacts: Facts
): void {
  const lines: SuggestedClaimLine[] = [];

  // Emit a candidate's initial-form codes by re-entering the tables (band arithmetic stays
  // data). The gate facts ride along so the walk's compliance gates stay determined.
  const emit = (c: IvCandidate, secondInitial: boolean): void => {
    if (c.kind === 'infusion' && c.missingTimes) {
      res.flags.push('blocked:missing_infusion_stop_time'); // bespoke #2
      res.review = true;
      return;
    }
    const sub =
      c.kind === 'push'
        ? tableSuggest(doc, FAMILY, { ...baseFacts, route_profile: 'single_iv_push' })
        : tableSuggest(doc, FAMILY, {
            ...baseFacts,
            route_profile: 'single_iv_infusion',
            infusion_total_minutes: c.minutes,
          });
    res.flags.push(...sub.flags);
    if (sub.flags.some((f) => f.startsWith('blocked:'))) res.review = true;
    const out = sub.codes.map((l) => ({ ...l, modifiers: [...l.modifiers] }));
    if (secondInitial && out.length > 0) out[0].modifiers.push('59'); // A4.1: second initial takes 59/XS
    lines.push(...out);
    if (c.kind === 'push' && c.pushCount > 1) {
      res.flags.push('advisory:repeat_push_same_drug_96376_practitioner_not_billable'); // A4.6, MUE 0
    }
  };

  // (b) exactly ONE initial service, chosen by the physician primary-reason rule (A4.2).
  let initial: IvCandidate | undefined;
  if (cands.length === 1) {
    initial = cands[0];
  } else if (cands.length > 1) {
    const marked = cands.filter((c) => c.primaryReason);
    if (marked.length === 1) initial = marked[0];
    else {
      // Primary reason is code-determining for the initial: refuse to guess (A4.2).
      res.flags.push('blocked:primary_reason_undetermined');
      res.review = true;
    }
  }

  if (initial) {
    emit(initial, false);
    // (c)/(e) everything else is subsequent — advisory only — unless separate-site/encounter
    // evidence supports a second initial with 59/XS (A4.1/A4.3).
    for (const c of cands) {
      if (c === initial) continue;
      const separateSite =
        c.ivSiteId !== undefined && initial.ivSiteId !== undefined && c.ivSiteId !== initial.ivSiteId;
      if (separateSite || c.separateEncounter) {
        res.flags.push('second_initial:separate_site_or_encounter_59_xs');
        emit(c, true);
      } else if (c.kind === 'infusion') {
        res.flags.push('advisory:sequential_infusion_96367_out_of_scope'); // A4.3
      } else if (c.drug === initial.drug) {
        res.flags.push('advisory:repeat_push_same_drug_96376_practitioner_not_billable'); // A4.6
      } else {
        res.flags.push('advisory:sequential_push_96375_out_of_scope'); // A4.3
      }
    }
  }

  // (d) IM/SC injections always emit 96372 × count via the count band; 59/XS attaches
  // when an IV family code is also emitted (PTP 96365×96372 / 96374×96372 mod 1, B5).
  if (imScCount > 0) {
    const sub = tableSuggest(doc, FAMILY, {
      ...baseFacts,
      route_profile: 'im_sc_only',
      num_im_sc_injections: imScCount,
    });
    res.flags.push(...sub.flags);
    const ivEmitted = lines.length > 0;
    for (const l of sub.codes) {
      lines.push({ ...l, modifiers: [...l.modifiers, ...(ivEmitted ? ['59'] : [])] });
    }
  }
  res.codes = lines;
}

// ── Forward: facts → claim lines ───────────────────────────────────────────────

export function suggestInjection(doc: TableDoc, facts: InjectionInfusionFacts): EvaluatorSuggestResult {
  const admins = facts.administrations ?? [];
  const missingRoute = admins.some((a) => a.route === undefined);
  const imScCount = admins.filter((a) => a.route === 'im' || a.route === 'sc').length;
  const cands = missingRoute ? [] : ivCandidates(admins);

  const derived: Facts = {
    setting: facts.setting,
    substance_class: facts.substance_class,
    direct_supervision_met: facts.direct_supervision_met,
    payer_type: facts.payer_type,
    em_separately_identifiable: facts.em_separately_identifiable,
  };
  let missingStopFlag = false;
  if (admins.length > 0 && !missingRoute) {
    if (cands.length === 0) {
      derived.route_profile = 'im_sc_only';
      derived.num_im_sc_injections = imScCount;
    } else if (imScCount === 0 && cands.length === 1 && cands[0].kind === 'push' && cands[0].pushCount === 1) {
      derived.route_profile = 'single_iv_push';
    } else if (imScCount === 0 && cands.length === 1 && cands[0].kind === 'infusion') {
      derived.route_profile = 'single_iv_infusion';
      // bespoke #2: a segment without both times blocks; 0 hits the band's blocked row.
      derived.infusion_total_minutes = cands[0].missingTimes ? 0 : cands[0].minutes;
      missingStopFlag =
        cands[0].missingTimes && admins.some((a) => a.startTime !== undefined || a.stopTime !== undefined);
    } else {
      derived.route_profile = 'multiple_or_mixed';
    }
  }

  const res = tableSuggest(doc, FAMILY, derived);

  // Refusal-to-emit paths the tables cannot see (code-determining facts absent).
  if (admins.length === 0) {
    res.flags.push('missing:administrations');
    res.review = true;
  } else if (missingRoute) {
    res.flags.push('missing:administration_route');
    res.review = true;
  }
  if (missingStopFlag) res.flags.push('blocked:missing_infusion_stop_time');
  // Cross-midnight arithmetic keeps segments codable, but a total over 12 hours is far
  // outside urgent-care plausibility — likely a stop-time entry error. Verify, don't block.
  if (cands.some((c) => c.kind === 'infusion' && !c.missingTimes && c.minutes > 12 * 60)) {
    res.flags.push('verify:infusion_duration_exceeds_12_hours');
  }
  if (res.flags.some((f) => f.startsWith('blocked:'))) res.review = true;

  const bespokeFlag = res.flags.find((f) => f === 'requires_bespoke:multi_administration_hierarchy');
  if (bespokeFlag !== undefined) {
    res.flags = res.flags.filter((f) => f !== bespokeFlag);
    resolveMultiAdmin(doc, res, cands, imScCount, derived);
    // Attach doc checklists for the codes the bespoke path emitted (payer notes and
    // aux tables were already attached by the top-level table walk).
    const emitted = res.codes.map((l) => l.code);
    res.requiredDocumentation.push(...checklistDocs(getFamily(doc, FAMILY).tables, emitted));
  }
  return res;
}

// ── Inverse: selected codes → per-code verdicts (mirrors evaluator.defend) ─────

export function defendInjection(
  doc: TableDoc,
  selected: { code: string; units?: number }[],
  facts: InjectionInfusionFacts
): DefendCodeFinding[] {
  const fam = getFamily(doc, FAMILY);
  const suggestion = suggestInjection(doc, facts);
  const caps = new Map(familyCaps(fam).map((c) => [c.code, c.maxUnitsPerDay]));

  return selected.map(({ code, units }) => {
    if (!fam.codes.includes(code)) {
      return { code, status: 'not-assessed' as const, reasons: [`${code} is outside the ${FAMILY} tables`] };
    }
    const lines = suggestion.codes.filter((l) => l.code === code);
    if (lines.length === 0) {
      const alternative =
        suggestion.codes.length > 0
          ? [`facts yield ${suggestion.codes.map((l) => l.code + (l.units > 1 ? `x${l.units}` : '')).join(' + ')}`]
          : [];
      return { code, status: 'not-supported' as const, reasons: [...suggestion.flags, ...alternative] };
    }
    const cap = caps.get(code);
    if (cap !== undefined && (units ?? 1) > cap) {
      return {
        code,
        status: 'not-supported' as const,
        reasons: [`${units} units exceed the ${cap}-unit per-day cap (B6)`],
      };
    }
    const documentedUnits = lines.reduce((sum, l) => sum + l.units, 0);
    if ((units ?? 1) > documentedUnits) {
      return {
        code,
        status: 'not-supported' as const,
        reasons: [`${units} units exceed the ${documentedUnits} the documented facts support (A3/A5.1)`],
      };
    }
    return { code, status: 'supported' as const, reasons: [`facts resolve to ${code} for this encounter`] };
  });
}
