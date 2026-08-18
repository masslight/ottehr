// Turn a practice procedure quick-pick into the ProcedureDTO the regular Procedures page would save.
//
// WHY THIS MIRRORS ProceduresNew RATHER THAN RE-DERIVING: several procedure fields are multi-select
// with a free-text "Other", and they are STORED as one comma-joined string that `parseWithOther`
// re-splits on load. The joining rule is not obvious — an "Other: <text>" entry must serialize LAST,
// because everything after "Other:" is read back as the free text. So this reuses the regular page's
// own serializer instead of writing a second one; a private join here would round-trip a provider's
// free text back as if it were a catalogue option.
//
// WHAT IT REFUSES TO CARRY. Three quick-pick fields are deliberately dropped, matching the regular
// page's `QUICK_PICK_APPLY_KEYS`, which excludes them as "encounter-specific":
//
//   consentObtained  — nothing in a dictation establishes that consent was obtained. A quick-pick that
//                      happens to store `true` must not assert it for THIS patient. Left unset, which
//                      is what a hand-charted procedure starts as.
//   performerType    — who performed it is a fact about this visit, not about the template.
//   diagnoses        — linked separately, and only after dedup against what is already charted.
//
// Everything else IS carried, and every field the template filled is reported back so the note can
// mark it "default, verify". That is the whole reason this is safe: the provider said four words, the
// template asserted ten fields, and each of those ten has to be confirmed on its own.

import { DateTime } from 'luxon';
import {
  combineMultipleValuesForSave,
  mergeOtherFromQuickPick,
  OTHER,
} from 'src/features/visits/in-person/pages/procedureOtherFields';
import { CPTCodeDTO, DiagnosisDTO, ProcedureDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ProcedureQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { PROCEDURE_REVIEW_FIELDS } from '../components/procedure-fields';

/** Everything the write needs, resolved by the catalogue so the writer guesses at nothing. */
export interface ProcedureQuickPickContext {
  /** The procedure itself, with no linked codes yet — those need resourceIds from step one. */
  dto: ProcedureDTO;
  /** The quick-pick's CPT codes, to be charted (or reused) and then linked. */
  cptCodes: CPTCodeDTO[];
  /** The quick-pick's supporting diagnoses. Never primary — see `linkQuickPickCodes`. */
  diagnoses: DiagnosisDTO[];
  /** Fields the TEMPLATE filled rather than the provider stating them. */
  templateFilledFields: string[];
}

/**
 * Build the DTO a quick-pick implies.
 *
 * `procedureTypeNameByCode` comes from the same ValueSet the regular page's dropdown reads, because
 * that page saves the human-readable NAME ("Laceration Repair") and not the code ("laceration-repair").
 * Saving the code would make the note disagree with the dropdown for the same procedure. When the
 * value set has not loaded the raw code is the honest fallback.
 *
 * `now` is a parameter so a test asserts a real timestamp rather than mocking the clock.
 */
export function procedureQuickPickContext(
  quickPick: ProcedureQuickPickData,
  procedureTypeNameByCode: Map<string, string>,
  now: string = DateTime.now().toUTC().toString()
): ProcedureQuickPickContext {
  const procedureType = quickPick.procedureType
    ? procedureTypeNameByCode.get(quickPick.procedureType) ?? quickPick.procedureType
    : undefined;

  // Single-select with "Other": the stored value is the option itself, or the free text when the
  // option was "Other".
  const singleWithOther = (value: string | undefined, other: string | undefined): string | undefined =>
    value === OTHER ? other?.trim() || undefined : value;

  // Multi-select with "Other": re-add the Other chip the quick-pick split out, then serialize through
  // the page's own joiner so it lands last.
  const multiWithOther = (values: (string | undefined)[] | undefined, other: string | undefined): string | undefined =>
    combineMultipleValuesForSave(mergeOtherFromQuickPick(values, other), other);

  const dto: ProcedureDTO = {
    procedureType,
    procedureDateTime: now,
    documentedDateTime: now,
    medicationUsed: quickPick.medicationUsed,
    bodySite: singleWithOther(quickPick.bodySite, quickPick.otherBodySite),
    bodySide: quickPick.bodySide,
    technique: quickPick.technique,
    suppliesUsed: multiWithOther(quickPick.suppliesUsed, quickPick.otherSuppliesUsed),
    procedureDetails: quickPick.procedureDetails,
    specimenSent: quickPick.specimenSent,
    complications: singleWithOther(quickPick.complications, quickPick.otherComplications),
    patientResponse: quickPick.patientResponse,
    postInstructions: multiWithOther(quickPick.postInstructions, quickPick.otherPostInstructions),
    timeSpent: quickPick.timeSpent,
    documentedBy: quickPick.documentedBy,
    // consentObtained and performerType are absent ON PURPOSE — see the module header.
  };

  return {
    dto,
    cptCodes: (quickPick.cptCodes ?? [])
      .filter((code): code is { code: string; display?: string } => Boolean(code?.code))
      .map((code) => ({ code: code.code, display: code.display ?? code.code })),
    // A procedure's linked diagnoses are SUPPORTING dx, never the encounter's primary — the primary is
    // the provider's own call and `add-diagnosis` owns it.
    diagnoses: (quickPick.diagnoses ?? [])
      .filter((dx): dx is { code: string; display?: string } => Boolean(dx?.code))
      .map((dx) => ({ code: dx.code, display: dx.display ?? dx.code, isPrimary: false })),
    templateFilledFields: templateFilledFields(dto),
  };
}

/**
 * Which fields the template actually filled — the per-field review set.
 *
 * Identity fields are excluded: `procedureType` and the linked codes are what the provider NAMED, so
 * marking them "verify" would cry wolf on the one part of the row that was dictated. The timestamps
 * are excluded for the same reason — they are derived from the clock, not asserted by a template.
 */
export function templateFilledFields(dto: ProcedureDTO): string[] {
  return PROCEDURE_REVIEW_FIELDS.filter((field) => {
    const value = (dto as unknown as Record<string, unknown>)[field];
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  });
}

/**
 * Split a quick-pick's codes into "already charted" and "must be created first".
 *
 * THE BUG THIS PREVENTS: a quick-pick carries its own linked diagnoses and CPT codes, and the plan has
 * usually ALREADY charted some of them from the dictation ("UTI", "fever"). Saving the quick-pick's
 * copies unconditionally produced duplicate diagnoses on the note. So only genuinely-new codes are
 * created, and the procedure links to the EXISTING row for the rest.
 */
export function linkQuickPickCodes<T extends { code?: string; resourceId?: string }>(
  fromQuickPick: T[],
  alreadyCharted: T[]
): { toCreate: T[]; existing: T[] } {
  const chartedByCode = new Map(alreadyCharted.filter((row) => row.code).map((row) => [row.code, row] as const));
  const toCreate: T[] = [];
  const existing: T[] = [];
  for (const row of fromQuickPick) {
    if (!row.code) continue;
    const charted = chartedByCode.get(row.code);
    if (charted) existing.push(charted);
    else toCreate.push(row);
  }
  return { toCreate, existing };
}
