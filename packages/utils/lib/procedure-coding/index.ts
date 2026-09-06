// Declarative procedure-coding package: the interface layer (facts/result
// types, per-family field manifests, shared codec) plus the assembled engine —
// family → generic evaluator over the reviewed decision tables, or a bespoke
// core where the weak table vocabulary cannot express the family (laceration
// class cascade; injection-infusion multi-administration hierarchy).

import { defend as tableDefend, EvaluatorSuggestResult, Facts, suggest as tableSuggest, TableDoc } from './evaluator';
import { InjectionInfusionFacts, LacerationFacts } from './facts.types';
import { defendInjection, suggestInjection } from './families/injection-infusion';
import { defend as lacerationDefend, LacerationDoc, suggest as lacerationSuggest } from './families/laceration';
import { normalizeFactsForFamily } from './manifests';
import {
  CodingDispatch,
  DefendResult,
  ProcedureCodingFamilyId,
  ProcedureDocInput,
  ProcedureFamilyFactsMap,
  SuggestResult,
} from './model.types';
import burnCathLesionTables from './tables/burn-cath-lesion-fixed-decision-tables.json';
import cerumenIdTables from './tables/cerumen-id-decision-tables.json';
import injectionEkgTables from './tables/injection-ekg-decision-tables.json';
import lacerationTables from './tables/laceration-facts.json';
import splintFbNasalTables from './tables/splint-fb-nasal-decision-tables.json';

export * from './codec';
export * from './facts.types';
export * from './manifests';
export * from './model.types';

const CERUMEN_ID_DOC = cerumenIdTables as unknown as TableDoc;
const INJECTION_EKG_DOC = injectionEkgTables as unknown as TableDoc;
const BURN_CATH_LESION_DOC = burnCathLesionTables as unknown as TableDoc;
const SPLINT_FB_NASAL_DOC = splintFbNasalTables as unknown as TableDoc;
const LACERATION_DOC = lacerationTables as unknown as LacerationDoc;

type TableFamilyId = Exclude<ProcedureCodingFamilyId, 'laceration' | 'injection-infusion'>;

/** Families the generic evaluator serves directly: coding family → tables document + family name in it. */
const TABLE_ROUTES: Record<TableFamilyId, { doc: TableDoc; tableFamily: string }> = {
  cerumen: { doc: CERUMEN_ID_DOC, tableFamily: 'cerumen-removal' },
  'incision-drainage': { doc: CERUMEN_ID_DOC, tableFamily: 'cutaneous-incision-and-drainage' },
  splinting: { doc: SPLINT_FB_NASAL_DOC, tableFamily: 'splint-strap-application' },
  'foreign-body': { doc: SPLINT_FB_NASAL_DOC, tableFamily: 'foreign-body-removal' },
  'nasal-packing': { doc: SPLINT_FB_NASAL_DOC, tableFamily: 'nasal-hemorrhage-control' },
  'burn-treatment': { doc: BURN_CATH_LESION_DOC, tableFamily: 'burn-local-treatment' },
  ekg: { doc: INJECTION_EKG_DOC, tableFamily: 'electrocardiogram-12-lead' },
  'urinary-catheterization': { doc: BURN_CATH_LESION_DOC, tableFamily: 'urinary-catheterization' },
  'lesion-destruction': { doc: BURN_CATH_LESION_DOC, tableFamily: 'benign-lesion-destruction' },
  'nail-trephination': { doc: BURN_CATH_LESION_DOC, tableFamily: 'nail-trephination' },
  'nursemaid-elbow': { doc: BURN_CATH_LESION_DOC, tableFamily: 'nursemaid-elbow' },
  'iv-catheter-placement': { doc: BURN_CATH_LESION_DOC, tableFamily: 'iv-catheter-placement' },
  nebulizer: { doc: BURN_CATH_LESION_DOC, tableFamily: 'nebulizer' },
};

type AnyFamilyFacts = ProcedureFamilyFactsMap[ProcedureCodingFamilyId];

function engineSuggest(family: ProcedureCodingFamilyId, facts: AnyFamilyFacts): EvaluatorSuggestResult {
  if (family === 'laceration') {
    return lacerationSuggest(LACERATION_DOC, facts as LacerationFacts);
  }
  if (family === 'injection-infusion') {
    // The injection core re-enters the same tables document per resolved drug event.
    return suggestInjection(INJECTION_EKG_DOC, facts as InjectionInfusionFacts);
  }
  const route = TABLE_ROUTES[family];
  return tableSuggest(route.doc, route.tableFamily, facts as unknown as Facts);
}

const normalize = (family: ProcedureCodingFamilyId, facts: AnyFamilyFacts): AnyFamilyFacts =>
  normalizeFactsForFamily(family, facts as Record<string, unknown>) as AnyFamilyFacts;

/** Routes the evaluator's auxiliary table outputs onto the result: laterality
 * modifiers attach to the emitted lines; same-day-E/M and diagnosis guidance
 * surface as payer notes (the existing advisory channel). */
function applyAux(result: SuggestResult, aux: Record<string, unknown>): void {
  if (result.codes.length === 0) return;
  const appendModifiers = aux.appendModifiers;
  if (Array.isArray(appendModifiers)) {
    for (const line of result.codes) {
      for (const modifier of appendModifiers) {
        if (typeof modifier === 'string' && !line.modifiers.includes(modifier)) line.modifiers.push(modifier);
      }
    }
  }
  const requiredDx = aux.requiredDx;
  if (Array.isArray(requiredDx) && requiredDx.length > 0) {
    result.payerNotes.push(`Diagnosis coding: link ${requiredDx.join(', ')} to support the claim.`);
  }
  if (aux.emAllowed === true) {
    const emModifiers = Array.isArray(aux.emModifiers)
      ? aux.emModifiers.filter((m): m is string => typeof m === 'string')
      : [];
    result.payerNotes.push(
      emModifiers.length > 0
        ? `Same-day E/M is separately reportable — append modifier ${emModifiers.join(', ')} to the E/M line.`
        : 'Same-day E/M is separately reportable.'
    );
  }
}

// The `doc` free-text context is reserved: doc-checklist/defense refinement will
// consume it, and callers already supply it, so the contract keeps the parameter.
export const codingDispatch: CodingDispatch = {
  suggest: (family: ProcedureCodingFamilyId, facts: AnyFamilyFacts, _doc: ProcedureDocInput): SuggestResult => {
    const { aux, bandDerivedCodes: _bandDerivedCodes, ...result } = engineSuggest(family, normalize(family, facts));
    applyAux(result, aux);
    return result;
  },
  defend: (
    family: ProcedureCodingFamilyId,
    facts: AnyFamilyFacts,
    _doc: ProcedureDocInput,
    selectedCodes: string[]
  ): DefendResult => {
    const selected = selectedCodes.map((code) => ({ code }));
    const normalized = normalize(family, facts);
    const codes =
      family === 'laceration'
        ? lacerationDefend(LACERATION_DOC, selected, normalized as LacerationFacts)
        : family === 'injection-infusion'
        ? defendInjection(INJECTION_EKG_DOC, selected, normalized as InjectionInfusionFacts)
        : tableDefend(
            TABLE_ROUTES[family].doc,
            TABLE_ROUTES[family].tableFamily,
            selected,
            normalized as unknown as Facts
          );
    // Payer notes and blocking flags surface through suggest (the UI unions the two).
    return { codes, payerNotes: [], flags: [] };
  },
};
