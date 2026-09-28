// The dispatch table: one handler per action kind, typed as HandlerTable, so a kind without a handler
// is a build error. Every handler returns a StepOutcome, writes nothing on a guess, and gives a
// provider-readable reason when it skips.

import { buildExamLeafCatalogue, ExamLeaf } from 'utils/lib/config-helpers/exam-leaves';
import { ActionKind, PlannableVitalField } from 'utils/lib/easy-chart/actions';
import { chartKeyForNoteField, NOTE_FIELD_LABELS } from 'utils/lib/easy-chart/note-fields';
import { HeightMeasurement } from 'utils/lib/helpers/vitals/vitals-height.helper';
import { fahrenheitToCelsius } from 'utils/lib/helpers/vitals/vitals-temperature.helper';
import { LBS_IN_KG } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { getRosFindingFieldKeys } from 'utils/lib/ottehr-config/review-of-systems';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { examCommentTarget, normalizeExamComment } from './examComment';
import { describeQuery, resolvePick } from './resolve';
import {
  applied,
  CatalogueMatch,
  CatalogueQuery,
  CatalogueResult,
  ChartedItem,
  ChartListField,
  failed,
  Handler,
  HandlerContext,
  HandlerTable,
  isCatalogueList,
  ResolvedExamFindingAction,
  skipped,
  StepOutcome,
} from './types';

const query = (action: { display?: string; searchTerms?: string[]; sourceText?: string }): CatalogueQuery => ({
  display: action.display ?? '',
  searchTerms: action.searchTerms,
  evidence: [action.sourceText, action.display, ...(action.searchTerms ?? [])].filter(Boolean).join(' '),
});

/** Resolve against a catalogue, then write: confident writes, ambiguous asks or auto-picks, none skips. */
async function addFromCatalogue(
  action: { display?: string; searchTerms?: string[]; sourceText?: string },
  context: HandlerContext,
  options: {
    search: (q: CatalogueQuery) => Promise<CatalogueResult>;
    noun: string;
    write: (match: CatalogueMatch) => Promise<string[]>;
    /** Instead of skipping when the catalogue holds nothing for these words (exam findings only). */
    onNoMatch?: () => Promise<StepOutcome>;
  }
): Promise<StepOutcome> {
  const subject = describeQuery(action.display);
  const result = await options.search(query(action));
  if (!isCatalogueList(result)) {
    return skipped(
      result?.reason ?? `the assistant cannot search ${options.noun}s yet — enter "${subject}" in the chart yourself`
    );
  }

  const pick = await resolvePick(result, context, { query: subject, prompt: `Which ${options.noun} did you mean?` });
  if (!pick) {
    // Only an empty catalogue falls back; a provider who declined the picker is respected.
    if (options.onNoMatch && result.length === 0) return options.onNoMatch();
    return skipped(`no ${options.noun} in the catalogue matches "${subject}"`);
  }
  const created = await options.write(pick.match);
  return applied(created, { lowConfidence: pick.lowConfidence, note: pick.note, matchedId: pick.match.id });
}

/** Remove a charted row. Destructive, so ambiguity asks even in a bulk run. */
async function removeCharted(
  action: { display?: string },
  context: HandlerContext,
  options: { items: ChartedItem[]; field: ChartListField; noun: string }
): Promise<StepOutcome> {
  const needle = (action.display ?? '').toLowerCase().trim();
  if (!needle) return skipped(`no ${options.noun} was named, so nothing was removed`);

  const candidates = options.items
    .map((item) => ({ item, hay: item.display.toLowerCase() }))
    .filter(({ hay }) => hay.includes(needle) || needle.includes(hay));
  if (candidates.length === 0) {
    return skipped(`"${action.display}" is not on the chart, so nothing was removed`);
  }

  const pick = await resolvePick(
    candidates.map(({ item, hay }) => ({
      id: item.resourceId,
      display: item.display,
      // An exact name outscores a partial one by more than the ambiguity ratio, so it never asks.
      score: hay === needle ? 1 : 0.5,
      payload: item,
    })),
    context,
    { query: describeQuery(action.display), prompt: `Which ${options.noun} should be removed?`, destructive: true }
  );
  if (!pick) return skipped(`removal of "${action.display}" was not confirmed`);

  await context.writer.remove(options.field, pick.match.payload as ChartedItem);
  return applied();
}

/** The eRx id of a medication or allergen match, as the string the chart stores (the search returns a number). */
function erxId(payload: unknown): string | undefined {
  const id = (payload as { id?: unknown } | undefined)?.id;
  return id === undefined || id === null || id === '' ? undefined : String(id);
}

/**
 * A dictated finding no checkbox matched: appended to the free-text comment of the card it most likely
 * belongs to, once. Always low confidence, because the card is a guess.
 */
async function writeExamComment(
  action: { display?: string; searchTerms?: string[] },
  context: HandlerContext
): Promise<StepOutcome> {
  const text = (action.display ?? '').trim();
  if (!text) return skipped('no exam finding was named, so nothing was charted');

  const target = examCommentTarget(text, action.searchTerms, buildExamLeafCatalogue(DefaultExamComponentsConfig));
  if (!target) return skipped(`"${text}" matched no exam finding, and this exam has no comment field to note it in`);
  const { field } = target;

  const existing = context.chart.examComments.find((comment) => comment.field === field);
  if (existing && normalizeExamComment(existing.note).includes(normalizeExamComment(text))) {
    return skipped(`"${text}" is already in that exam section's note`);
  }
  const note = existing?.note ? `${existing.note}; ${text}` : text;
  const created = await context.writer.save({
    examObservations: [{ ...(existing?.resourceId ? { resourceId: existing.resourceId } : {}), field, note }],
  });
  return applied(created, {
    lowConfidence: true,
    note: `no checkbox matched — noted in ${target.sectionLabel} comments`,
    matchedId: field,
  });
}

/**
 * Convert a canonicalised reading to the unit vitals are stored in (kg, cm, °C). The server names the
 * unit the provider said; it does not convert, and storing "170 lb" as-is once charted 170 kg.
 */
export function toStoredVitalValue(value: number, unit: string | undefined): number {
  switch (unit) {
    case 'lb':
      return roundNumberToDecimalPlaces(value / LBS_IN_KG, 2);
    case 'in':
      return HeightMeasurement.fromInches(value).getCm();
    case 'F':
      return fahrenheitToCelsius(value);
    default:
      return value;
  }
}

/** A numeric-valued vitals row. The field list is tied to VitalFieldNames in actions.ts. */
const numericVital = (
  field: Exclude<PlannableVitalField, 'vital-blood-pressure'>,
  value: number
): VitalsObservationDTO => ({ field: field as VitalFieldNames, value }) as VitalsObservationDTO;

const setVital: Handler<'set-vital'> = async (action, context) => {
  const { field } = action;
  if (field === 'vital-blood-pressure') {
    if (action.systolic == null || action.diastolic == null) {
      return failed('no usable blood pressure reading reached the chart');
    }
    const created = await context.writer.save({
      vitalsObservations: [
        {
          field: VitalFieldNames.VitalBloodPressure,
          systolicPressure: action.systolic,
          diastolicPressure: action.diastolic,
        },
      ],
    });
    return applied(created, { note: action.caution });
  }
  // The server parsed and plausibility-checked the reading; reaching here without one is a guard bug.
  if (action.value == null) return failed(`no usable reading reached the chart for ${field}`);
  const created = await context.writer.save({
    vitalsObservations: [numericVital(field, toStoredVitalValue(action.value, action.unit))],
  });
  return applied(created, { note: action.caution });
};

const addDiagnosis: Handler<'add-diagnosis'> = async (action, context) => {
  // The server confirmed code and display against the terminology service from one row.
  if (!action.code) return skipped(`"${action.display}" reached the chart without a confirmed ICD-10 code`);
  if (context.chart.diagnoses.some((dx) => dx.code === action.code)) {
    return skipped(`"${action.display}" is already on the chart`);
  }

  // Exactly one primary: a new diagnosis never takes over an existing primary.
  const primaryTaken = context.chart.diagnoses.some((dx) => dx.isPrimary);
  const isPrimary = action.isPrimary === true && !primaryTaken;
  const created = await context.writer.save({
    diagnosis: [{ code: action.code, display: action.display, isPrimary }],
  });
  return applied(created, {
    note:
      action.isPrimary && !isPrimary
        ? 'a primary diagnosis was already set, so this was charted as secondary'
        : undefined,
  });
};

export const HANDLERS: HandlerTable = {
  // Only a suggestion: the provider applies templates from the template picker.
  'apply-template': async (action, context) => {
    if (!action.templateId) {
      return skipped(
        `the server did not resolve "${describeQuery(action.display)}" to a template — pick one yourself if you want it`
      );
    }
    context.say(
      `Suggested template: "${action.display}". Apply it from the template picker if you want it — nothing was applied.`,
      'provider-note'
    );
    return applied([], { note: 'suggested only — not applied', matchedId: action.templateId });
  },

  // The same row the Allergies tab writes for an eRx pick.
  'add-allergy': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.allergies(q),
      noun: 'allergy',
      write: (match) =>
        context.writer.save({
          allergies: [
            {
              name: match.display,
              ...(erxId(match.payload) ? { id: erxId(match.payload) } : {}),
              current: true,
              lastUpdated: new Date().toISOString(),
            },
          ],
        }),
    }),

  // No catalogue: the server already confirmed the ICD-10 code, exactly as for add-diagnosis.
  'add-condition': async (action, context) => {
    if (!action.code) {
      return skipped(`"${describeQuery(action.display)}" reached the chart without a confirmed ICD-10 code`);
    }
    const display = action.display.trim() || action.code;
    if (context.chart.conditions.some((item) => item.display.toLowerCase() === display.toLowerCase())) {
      return skipped(`"${display}" is already on the chart`);
    }
    const created = await context.writer.save({
      conditions: [{ code: action.code, display, current: true, lastUpdated: new Date().toISOString() }],
    });
    return applied(created, { matchedId: action.code });
  },

  // The same row the Medications tab writes for an eRx pick; the dictated strength is recorded as the dose.
  'add-medication': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.medications(q),
      noun: 'medication',
      write: (match) =>
        context.writer.save({
          medications: [
            {
              name: match.display,
              ...(erxId(match.payload) ? { id: erxId(match.payload) } : {}),
              type: 'scheduled',
              status: 'active',
              intakeInfo: { ...(action.strength ? { dose: action.strength } : {}) },
            },
          ],
        }),
    }),
  'remove-medication': async (action, context) =>
    removeCharted(action, context, { items: context.chart.medications, field: 'medications', noun: 'medication' }),

  // Both catalogues are static coded option lists; a match's id is the option's code.
  'add-surgical-history': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.surgicalHistory(q),
      noun: 'procedure',
      write: (match) => context.writer.save({ surgicalHistory: [{ code: match.id, display: match.display }] }),
    }),

  'add-hospitalization': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.hospitalizations(q),
      noun: 'hospitalization',
      write: (match) => context.writer.save({ episodeOfCare: [{ code: match.id, display: match.display }] }),
    }),

  'edit-note-text': async (action, context) => {
    const chartKey = chartKeyForNoteField(action.field);
    // Update the row that already holds the field; a second row would never show on the note.
    const existing = context.chart.noteFields[chartKey];
    const created = await context.writer.save({
      [chartKey]: { ...(existing?.resourceId ? { resourceId: existing.resourceId } : {}), text: action.newText },
    });
    return applied(created, { note: `${NOTE_FIELD_LABELS[action.field]} rewritten` });
  },

  'set-vital': setVital,

  'add-exam-finding': async (action, context) => {
    const tick = (field: string, leaf: ExamLeaf | undefined): Promise<string[]> =>
      context.writer.save({ examObservations: [{ ...leaf, field, value: true }] });
    // The provider already confirmed this leaf in the panel; searching again could land elsewhere.
    const { resolvedLeaf } = action as ResolvedExamFindingAction;
    if (resolvedLeaf) {
      return applied(await tick(resolvedLeaf.field, resolvedLeaf), { matchedId: resolvedLeaf.field });
    }
    return addFromCatalogue(action, context, {
      search: (q) => context.catalogue.examFindings(q),
      noun: 'exam finding',
      write: (match) => tick(match.id, match.payload as ExamLeaf | undefined),
      onNoMatch: () => writeExamComment(action, context),
    });
  },

  'add-ros-finding': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.rosFindings(q),
      noun: 'review-of-systems finding',
      write: (match) => {
        // The polarity is in the field key (…-denies / …-reports), not in the boolean.
        const { deniesKey, reportsKey } = getRosFindingFieldKeys(match.id);
        const label = (match.payload as { label?: string } | undefined)?.label;
        return context.writer.save({
          rosObservations: [
            { field: action.finding === 'denies' ? deniesKey : reportsKey, value: true, ...(label ? { label } : {}) },
          ],
        });
      },
    }),

  'add-diagnosis': addDiagnosis,
  'remove-diagnosis': async (action, context) =>
    removeCharted(action, context, { items: context.chart.diagnoses, field: 'diagnosis', noun: 'diagnosis' }),

  'set-em-code': async (action, context) =>
    applied(await context.writer.save({ emCode: { code: action.code, display: action.display ?? action.code } })),

  'set-disposition': async (action, context) =>
    applied(
      await context.writer.save({
        disposition: {
          type: action.dispositionType,
          note: action.text,
          ...(action.followUpInDays != null ? { followUpIn: action.followUpInDays } : {}),
        },
      })
    ),

  'add-patient-instruction': async (action, context) =>
    applied(await context.writer.save({ instructions: [{ text: action.text }] })),

  'provider-note': async (action, context) => {
    context.say(action.text, 'provider-note');
    return applied([], { note: 'left as a note for you' });
  },
  reply: async (action, context) => {
    context.say(action.text, 'reply');
    return applied([], { note: 'answered in the chat' });
  },

  unknown: async (action, context) => {
    context.say(action.message ?? 'The assistant could not classify part of that request.', 'unknown');
    return skipped(action.message ?? 'the assistant could not classify this part of the request');
  },
};

export const isHandledKind = (kind: string): kind is ActionKind => kind in HANDLERS;
