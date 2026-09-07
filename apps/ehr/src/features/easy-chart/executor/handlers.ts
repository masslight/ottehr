// THE DISPATCH TABLE. One entry per action kind, assembled as `satisfies HandlerTable`.
//
// Exhaustiveness is guaranteed by construction: adding an action to the registry without a handler
// here is a BUILD ERROR. The previous version was a single 730-line function whose only safety net
// was an accidental type-narrowing at the end.
//
// Handlers are grouped by write path rather than one file per kind — the property that matters is
// the typed table, and thirty-four one-function modules obscure the shape of the note more than they
// clarify it. Every entry is still independently addressable and independently testable.
//
// Rules every handler follows:
//   - Return a StepOutcome. Never return nothing, and never write and then report a skip.
//   - A skip carries a REASON written for a provider to read.
//   - Nothing is written on a guess. If the catalogue does not resolve, skip and say why.

import {
  buildExamCommentFields,
  buildExamLeafCatalogue,
  inferExamSectionKey,
} from 'utils/lib/config-helpers/exam-leaves';
import { ActionKind, NoteTextField } from 'utils/lib/easy-chart/actions';
import { chartKeyForNoteField, NOTE_FIELD_LABELS } from 'utils/lib/easy-chart/note-fields';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { getRosFindingFieldKeys } from 'utils/lib/ottehr-config/review-of-systems';
import { ProcedureQuickPickContext } from './procedure-quick-pick';
import { describeQuery, resolvePick } from './resolve';
import {
  applied,
  CatalogueMatch,
  CatalogueQuery,
  CatalogueResult,
  ChartedItem,
  failed,
  Handler,
  HandlerContext,
  HandlerTable,
  isCatalogueList,
  skipped,
  StepOutcome,
} from './types';

const query = (action: { display?: string; searchTerms?: string[]; sourceText?: string }): CatalogueQuery => ({
  display: action.display ?? '',
  searchTerms: action.searchTerms,
  // The quote is the only thing here that speaks for the VISIT rather than for the model's phrasing.
  evidence: [action.sourceText, action.display, ...(action.searchTerms ?? [])].filter(Boolean).join(' '),
});

/**
 * Resolve against a catalogue, then write. The shared shape behind most add-* handlers: it keeps the
 * "confident / ask / skip-with-reason" rule in exactly one place instead of thirteen.
 */
async function addFromCatalogue(
  action: { display?: string; searchTerms?: string[] },
  context: HandlerContext,
  options: {
    search: (q: CatalogueQuery) => Promise<CatalogueResult>;
    noun: string;
    /** Set when the write path is not reachable here; the step skips before searching. */
    unsupported?: boolean;
    /**
     * A plain id list for a simple row. A COMPOSITE row (a procedure) returns the extra provenance it
     * produced instead — which of the rows it created were the template's contribution rather than the
     * provider's words, and which of its fields need their own "default, verify".
     */
    write: (match: CatalogueMatch) => Promise<string[] | CompositeWriteResult>;
    /**
     * What to do when the catalogue holds nothing for this wording, instead of skipping.
     *
     * Only the exam passes it: its catalogue is a fixed set of checkboxes while the provider's
     * vocabulary is not, and the exam tab has a free-text note per card to put the words in. Every
     * other catalogue is a real terminology and "no match" there means the item genuinely cannot be
     * charted, which the provider must be told rather than have written somewhere approximate.
     */
    onNoMatch?: () => Promise<StepOutcome>;
  }
): Promise<StepOutcome> {
  const subject = describeQuery(action.display);

  // Not supported HERE is not a failure and not an empty search result. Say what it is, and say
  // where the provider can do it, so a dictated item is never just quietly gone.
  if (options.unsupported) {
    return skipped(`the assistant cannot add a ${options.noun} yet ("${subject}") — enter it in the chart yourself`);
  }

  const result = await options.search(query(action));
  if (!isCatalogueList(result)) {
    // The catalogue could not be consulted. Prefer its own reason — it names the unmet precondition
    // and the item — and fall back to a generic one only when it gave none.
    return skipped(
      result?.reason ?? `the assistant cannot search ${options.noun}s yet — enter "${subject}" in the chart yourself`
    );
  }
  const matches = result;

  const pick = await resolvePick(matches, context, {
    query: subject,
    prompt: `Which ${options.noun} did you mean?`,
  });
  if (!pick) {
    // ONLY when the catalogue held nothing. `resolvePick` also returns undefined when the provider was
    // ASKED and declined, and a decline must be respected, not answered with a fallback write — its own
    // doc comment says as much. `classifyMatches` reports 'none' only for an empty candidate list, so
    // that is the condition to test, never the absence of a pick.
    if (options.onNoMatch && matches.length === 0) return options.onNoMatch();
    return skipped(`no ${options.noun} in the catalogue matches "${subject}"`);
  }
  const written = await options.write(pick.match);
  const composite: CompositeWriteResult = Array.isArray(written) ? { createdResourceIds: written } : written;
  if (composite.skipReason) return skipped(composite.skipReason);
  return applied(composite.createdResourceIds, {
    lowConfidence: pick.lowConfidence,
    note: pick.note,
    matchedId: pick.match.id,
    ...(composite.inferredResourceIds?.length ? { inferredResourceIds: composite.inferredResourceIds } : {}),
    ...(composite.templateFilledFields?.length ? { templateFilledFields: composite.templateFilledFields } : {}),
  });
}

/** What a write returns when the row it created is composite. See `addFromCatalogue`'s `write`. */
interface CompositeWriteResult {
  createdResourceIds: string[];
  inferredResourceIds?: string[];
  templateFilledFields?: { resourceId: string; fields: string[] }[];
  /**
   * Set when the write could not proceed on what the catalogue handed back. The step settles as
   * SKIPPED with this reason rather than as applied-with-nothing — a step that reports success having
   * charted nothing reads to a provider as "there was nothing to chart".
   */
  skipReason?: string;
}

/**
 * Remove a charted row. Destructive, so ambiguity ASKS even during a bulk run — with several
 * plausible matches for a removal we never delete the first substring match.
 */
async function removeCharted(
  action: { display?: string },
  context: HandlerContext,
  options: { items: ChartedItem[]; field: string; noun: string }
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
      // Exact wording beats partial containment by more than the ambiguity ratio, so naming an item
      // exactly never asks — while two partial matches tie and therefore do.
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

/** Words that carry no anatomy, so a comment made only of these has nothing to file it under. */
const COMMENT_FALLBACK_SECTION = 'general';

/**
 * Append a dictated exam finding to the free-text note of the card it most likely belongs to.
 *
 * The last resort for `add-exam-finding`, reached only when the checkbox catalogue matched nothing.
 * Appends rather than overwrites — the provider may have typed in that box, and the plan and the
 * review pass can both route a finding here — and dedupes, because "Positive Homan's sign; Positive
 * Homan's sign" is what appending twice looks like.
 */
async function writeExamComment(action: { display?: string }, context: HandlerContext): Promise<StepOutcome> {
  const text = (action.display ?? '').trim();
  if (!text) return skipped('no exam finding was named, so nothing was charted');

  const leaves = buildExamLeafCatalogue(DefaultExamComponentsConfig);
  const commentFields = buildExamCommentFields(DefaultExamComponentsConfig);
  const sectionKey = inferExamSectionKey(
    `${text} ${(action as { searchTerms?: string[] }).searchTerms?.join(' ') ?? ''}`,
    leaves
  );
  const field = commentFields[sectionKey ?? ''] ?? commentFields[COMMENT_FALLBACK_SECTION];
  if (!field) return skipped(`"${text}" matched no exam finding, and this exam has no comment field to note it in`);

  const existing = context.chart.examComments.find((comment) => comment.field === field);
  const normalize = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  if (existing && normalize(existing.note).includes(normalize(text))) {
    return skipped(`"${text}" is already in that exam section's note`);
  }
  const note = existing?.note ? `${existing.note}; ${text}` : text;
  const created = await context.writer.save({
    examObservations: [{ ...(existing?.resourceId ? { resourceId: existing.resourceId } : {}), field, note }],
  });
  // LOW CONFIDENCE, always. The words are the provider's, but the CARD is this function's guess, and a
  // finding filed one section away is exactly what a reader needs flagged.
  return applied(created, {
    lowConfidence: true,
    note: `no checkbox matched — noted in the exam section's free text`,
    // The chart field actually written. Anything reading a plan afterwards — the provenance layer, the
    // eval harness — needs to tell a comment write from a ticked checkbox, and the field is what says
    // so: every comment field is one of `buildExamCommentFields`' values, which is a membership test
    // rather than a guess at the shape of the name.
    matchedId: field,
  });
}

const noteText: Handler<'edit-note-text'> = async (action, context) => {
  const field = action.field as NoteTextField;
  // ONE mapping function owns the CC↔HPI storage swap. Do not inline it.
  const chartKey = chartKeyForNoteField(field);
  const created = await context.writer.save({ [chartKey]: { text: action.newText } });
  return applied(created, { note: `${NOTE_FIELD_LABELS[field]} rewritten` });
};

const setVital: Handler<'set-vital'> = async (action, context) => {
  // The server already parsed, converted and plausibility-checked the reading; an action that got
  // this far carries numbers in a unit the write path provably handles. A set-vital with neither a
  // value nor a blood-pressure pair means a guard let something through, so fail loudly.
  const hasBloodPressure = action.systolic != null && action.diastolic != null;
  if (action.value == null && !hasBloodPressure) {
    return failed(`no usable reading reached the chart for ${action.field}`);
  }
  const created = await context.writer.save({
    vitalsObservations: [
      hasBloodPressure
        ? { field: action.field, systolicPressure: action.systolic, diastolicPressure: action.diastolic }
        : { field: action.field, value: action.value, unit: action.unit },
    ],
  });
  return applied(created, { note: action.caution });
};

const addDiagnosis: Handler<'add-diagnosis'> = async (action, context) => {
  // No catalogue lookup: the server already confirmed {code, display} against the terminology
  // service and both fields come from ONE row.
  if (!action.code) return skipped(`"${action.display}" reached the chart without a confirmed ICD-10 code`);

  const alreadyCharted = context.chart.diagnoses.some((dx) => dx.code === action.code);
  if (alreadyCharted) return skipped(`"${action.display}" is already on the chart`);

  // The exactly-one-primary invariant. It lives here rather than in the shared save hook because it
  // is the one chart rule this feature genuinely owns.
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

const setEmCode: Handler<'set-em-code'> = async (action, context) => {
  const created = await context.writer.save({ emCode: { code: action.code, display: action.display } });
  return applied(created);
};

const addCpt: Handler<'add-cpt'> = async (action, context) => {
  if (context.chart.cptCodes.some((cpt) => cpt.code === action.code)) {
    return skipped(`CPT ${action.code} is already on the chart`);
  }
  const created = await context.writer.save({ cptCodes: [{ code: action.code, display: action.display }] });
  return applied(created);
};

const setDisposition: Handler<'set-disposition'> = async (action, context) => {
  const created = await context.writer.save({
    disposition: {
      type: action.dispositionType,
      note: action.text,
      ...(action.followUpInDays != null ? { followUpIn: action.followUpInDays } : {}),
    },
  });
  return applied(created);
};

const addInstruction: Handler<'add-patient-instruction'> = async (action, context) => {
  const created = await context.writer.save({ instructions: [{ text: action.text }] });
  return applied(created);
};

/** A chat-only action: it writes nothing, and saying so is the whole point of its outcome. */
const chatOnly = <K extends 'reply' | 'provider-note'>(kind: K): Handler<K> =>
  (async (action: { text: string }, context: HandlerContext) => {
    context.say(action.text, kind);
    return applied([], { note: kind === 'reply' ? 'answered in the chat' : 'left as a note for you' });
  }) as Handler<K>;

export const HANDLERS = {
  'apply-template': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.templates(q),
      noun: 'template',
      write: (match) => context.writer.applyTemplate(match),
    }),

  'add-allergy': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.allergies(q),
      noun: 'allergy',
      write: (match) => context.writer.save({ allergies: [{ name: match.display, ...(match.payload as object) }] }),
    }),
  'remove-allergy': async (action, context) =>
    removeCharted(action, context, { items: context.chart.allergies, field: 'allergies', noun: 'allergy' }),

  'add-condition': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.conditions(q),
      noun: 'condition',
      write: (match) =>
        context.writer.save({
          conditions: [{ display: match.display, code: action.code, ...(match.payload as object) }],
        }),
    }),
  'remove-condition': async (action, context) =>
    removeCharted(action, context, { items: context.chart.conditions, field: 'conditions', noun: 'condition' }),

  'add-medication': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.medications(q),
      noun: 'medication',
      write: (match) =>
        context.writer.save({
          medications: [
            {
              name: match.display,
              ...(action.strength ? { strength: action.strength } : {}),
              ...(action.doseForm ? { doseForm: action.doseForm } : {}),
              ...(match.payload as object),
            },
          ],
        }),
    }),
  'remove-medication': async (action, context) =>
    removeCharted(action, context, { items: context.chart.medications, field: 'medications', noun: 'medication' }),

  'add-surgical-history': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.surgicalHistory(q),
      noun: 'procedure',
      write: (match) =>
        context.writer.save({ surgicalHistory: [{ display: match.display, ...(match.payload as object) }] }),
    }),
  'remove-surgical-history': async (action, context) =>
    removeCharted(action, context, {
      items: context.chart.surgicalHistory,
      field: 'surgicalHistory',
      noun: 'surgical history item',
    }),

  'add-hospitalization': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.hospitalizations(q),
      noun: 'hospitalization',
      write: (match) =>
        context.writer.save({ episodeOfCare: [{ display: match.display, ...(match.payload as object) }] }),
    }),
  'remove-hospitalization': async (action, context) =>
    removeCharted(action, context, {
      items: context.chart.hospitalizations,
      field: 'episodeOfCare',
      noun: 'hospitalization',
    }),

  'edit-note-text': noteText,
  'set-vital': setVital,

  'add-exam-finding': async (action, context) => {
    // NO CHECKBOX FOR IT IS NOT NOTHING TO CHART — see onNoMatch.
    return addFromCatalogue(action, context, {
      search: (q) => context.catalogue.examFindings(q),
      noun: 'exam finding',
      write: (match) =>
        context.writer.save({ examObservations: [{ field: match.id, value: true, ...(match.payload as object) }] }),
      onNoMatch: () => writeExamComment(action, context),
    });
  },
  'remove-exam-finding': async (action, context) =>
    removeCharted(action, context, {
      items: context.chart.examFindings,
      field: 'examObservations',
      noun: 'exam finding',
    }),

  'add-ros-finding': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.rosFindings(q),
      noun: 'review-of-systems finding',
      write: (match) => {
        // POLARITY IS IN THE FIELD KEY, NOT IN THE BOOLEAN.
        //
        // ROS storage gives each symptom two fields — `…-denies` and `…-reports` — and records the one
        // that applies with `value: true`. This wrote the BASE key instead, with the boolean carrying the
        // polarity, which produced a shape nothing reads: Review & Sign looks up the suffixed keys and
        // found none, so the signed note's ROS section was empty; Easy Chart's own snapshot keeps only
        // `value === true`, so a denial was invisible here too and could not be removed.
        const { deniesKey, reportsKey } = getRosFindingFieldKeys(match.id);
        return context.writer.save({
          rosObservations: [
            { field: action.finding === 'denies' ? deniesKey : reportsKey, value: true, ...(match.payload as object) },
          ],
        });
      },
    }),
  'remove-ros-finding': async (action, context) =>
    removeCharted(action, context, {
      items: context.chart.rosFindings,
      field: 'rosObservations',
      noun: 'review-of-systems finding',
    }),

  'add-diagnosis': addDiagnosis,
  'remove-diagnosis': async (action, context) =>
    removeCharted(action, context, { items: context.chart.diagnoses, field: 'diagnosis', noun: 'diagnosis' }),

  'add-in-house-lab': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.labs({ ...q, inHouse: true }),
      noun: 'in-house lab',
      write: (match) => context.writer.orderLab(match, true),
    }),
  'add-external-lab': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.labs({ ...q, inHouse: false }),
      noun: 'send-out lab',
      write: (match) => context.writer.orderLab(match, false),
    }),
  'add-radiology': async (action, context) => {
    // An imaging order is filed AGAINST a diagnosis, so refuse before searching rather than placing an
    // unlinked order the radiology tab would reject.
    if (context.chart.diagnoses.length === 0) {
      return skipped(`"${describeQuery(action.display)}" needs a diagnosis on the chart before it can be ordered`);
    }
    return addFromCatalogue(action, context, {
      search: (q) => context.catalogue.radiology(q),
      noun: 'imaging study',
      unsupported: !context.writer.supports.radiologyOrders,
      // `dictatedStudyName` is what the PROVIDER said, which is what goes on the order — the catalogue
      // match supplies the CPT, and its own display is the coding system's wording, not the visit's.
      write: (match) => context.writer.orderRadiology(match, { dictatedStudyName: action.display ?? match.display }),
    });
  },

  // A procedure is one dictated phrase in and a ten-field clinical form out, all of it pre-filled by
  // the practice's quick-pick: complications, patientResponse and timeSpent among them. Two of those
  // are legal claims and one feeds billing, so under per-ITEM provenance alone one confirm click would
  // have accepted ten assertions the provider never made — which is why this was deferred until the
  // per-FIELD "default, verify" marker existed. It does, so the write reports which fields the template
  // filled and each is confirmed on its own.
  'add-procedure': async (action, context) =>
    addFromCatalogue(action, context, {
      search: (q) => context.catalogue.procedures(q),
      noun: 'procedure',
      unsupported: !context.writer.supports.procedures,
      write: async (match) => {
        const payload = match.payload as ProcedureQuickPickContext | undefined;
        // THE CAST IS NOT A GUARANTEE. `payload` is whatever the catalogue chose to attach, and a
        // catalogue that attaches none — the eval harness stubbed procedures exactly that way — turned
        // `payload.dto` into a TypeError. A handler that throws reports the step as failed with a raw
        // `Cannot read properties of undefined (reading 'dto')`, which tells a provider nothing about
        // what went wrong or what to do instead. Skipping with the reason is the honest outcome, and it
        // is what every other unresolvable catalogue result already produces.
        if (!payload?.dto) {
          return {
            createdResourceIds: [],
            skipReason: `the procedure catalogue returned no quick-pick for "${match.display}" — chart it from the Procedures tab`,
          };
        }
        // A quick-pick whose template names no procedureType writes a row with NO NAME — the note then
        // shows a "Procedure" heading with a body site under it and nothing identifying what was done.
        // The provider named it, so fall back to that: an identifiable row beats a blank one, and the
        // catalogue display is the same text the plan step reported.
        const named = payload.dto.procedureType?.trim()
          ? payload
          : { ...payload, dto: { ...payload.dto, procedureType: match.display } };
        const written = await context.writer.addProcedure(named);
        return {
          createdResourceIds: written.createdResourceIds,
          inferredResourceIds: written.inferredResourceIds,
          // Only when the row came back with an id: a marker keyed to `undefined` would attach the
          // whole template's verify set to whatever row that hashes to.
          ...(written.procedureResourceId && written.templateFilledFields.length > 0
            ? {
                templateFilledFields: [
                  { resourceId: written.procedureResourceId, fields: written.templateFilledFields },
                ],
              }
            : {}),
        };
      },
    }),
  'update-procedure': async (action, context) => {
    const target = action.procedureMatch?.toLowerCase().trim();
    const procedure = target
      ? context.chart.procedures.find((p) => p.display.toLowerCase().includes(target))
      : context.chart.procedures[0];
    if (!procedure) {
      return skipped(`no charted procedure matches "${action.procedureMatch ?? 'the one described'}"`);
    }
    const updates = Object.fromEntries(action.updates.map((u) => [u.field, u.value]));
    const created = await context.writer.save({
      procedures: [{ resourceId: procedure.resourceId, ...updates }],
    });
    // Composite item: the procedure itself was dictated, but these field values may be template
    // defaults, so provenance is tracked per field by the caller from this note.
    return applied(created, { note: `updated ${Object.keys(updates).join(', ')}` });
  },

  'set-em-code': setEmCode,
  'remove-em-code': async (_action, context) => {
    if (!context.chart.hasEmCode) return skipped('no E&M level was set, so there was nothing to remove');
    await context.writer.remove('emCode', { resourceId: 'emCode', display: 'E&M code' });
    return applied();
  },
  'add-cpt': addCpt,
  'remove-cpt': async (action, context) => {
    const charted = context.chart.cptCodes.find((cpt) => cpt.code === action.code);
    if (!charted) return skipped(`CPT ${action.code} is not on the chart, so nothing was removed`);
    await context.writer.remove('cptCodes', charted);
    return applied();
  },

  'set-disposition': setDisposition,
  'add-patient-instruction': addInstruction,
  'add-nursing-order': async (action, context) => applied(await context.writer.createNursingOrder(action.text)),

  'provider-note': chatOnly('provider-note'),
  reply: chatOnly('reply'),

  unknown: async (action, context) => {
    context.say(action.message ?? 'The assistant could not classify part of that request.', 'unknown');
    return skipped(action.message ?? 'the assistant could not classify this part of the request');
  },
} satisfies HandlerTable;

/** Exported for the runtime twin in the step machine: does this build know how to execute `kind`? */
export const isHandledKind = (kind: string): kind is ActionKind => kind in HANDLERS;
