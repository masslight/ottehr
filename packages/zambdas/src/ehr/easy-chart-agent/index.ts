import { APIGatewayProxyResult } from 'aws-lambda';
import { EasyChartAgentIntent, EasyChartAgentOutput, INVALID_INPUT_ERROR } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'easy-chart-agent';

// Dosage-form keywords ordered most-specific first so "Oral Suspension" wins over "Suspension".
const DOSE_FORM_KEYWORDS = [
  'oral suspension',
  'oral solution',
  'oral tablet',
  'extended release tablet',
  'chewable tablet',
  'suspension',
  'solution',
  'tablet',
  'capsule',
  'liquid',
  'cream',
  'ointment',
  'drops',
  'spray',
  'injection',
  'patch',
  'inhaler',
];

function sniffDoseForm(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const kw of DOSE_FORM_KEYWORDS) {
    if (lower.includes(kw)) {
      // Capitalize first letter for downstream display ("Suspension" not "suspension").
      return kw.charAt(0).toUpperCase() + kw.slice(1);
    }
  }
  return undefined;
}

// Scope the sniff to the RIGHT side of the medication name so a form mentioned for
// one drug doesn't contaminate another's intent in multi-med messages. Dose forms
// in clinical prose conventionally follow the ingredient ("amoxicillin SUSPENSION").
function sniffDoseFormScoped(text: string, display: string, searchTerms: string[]): string | undefined {
  const needles = [...searchTerms, display].map((s) => s.trim()).filter(Boolean);
  const lower = text.toLowerCase();
  for (const needle of needles) {
    const idx = lower.indexOf(needle.toLowerCase());
    if (idx === -1) continue;
    const start = idx + needle.length;
    const end = Math.min(text.length, start + 40);
    return sniffDoseForm(text.slice(start, end));
  }
  return undefined;
}

// ICD-10 code pattern — see planner for full notes. Used as a fallback when Gemini omits the
// `code` field but the provider clearly dictated one.
const ICD10_REGEX = /\b([A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?)\b/g;
function sniffIcdCodeScoped(text: string, display: string, searchTerms: string[]): string | undefined {
  const needles = [display, ...searchTerms].map((s) => s.trim()).filter(Boolean);
  const lower = text.toLowerCase();
  for (const needle of needles) {
    const idx = lower.indexOf(needle.toLowerCase());
    if (idx === -1) continue;
    const start = Math.max(0, idx - 20);
    const end = Math.min(text.length, idx + needle.length + 60);
    const matches = text.slice(start, end).match(ICD10_REGEX);
    if (matches && matches.length > 0) return matches[0];
    return undefined;
  }
  return undefined;
}

const KIND_VALUES = [
  'unknown',
  'add-allergy',
  'add-condition',
  'add-medication',
  'add-surgical-history',
  'add-hospitalization',
  'add-diagnosis',
  'remove-allergy',
  'remove-condition',
  'remove-medication',
  'remove-surgical-history',
  'remove-hospitalization',
  'remove-diagnosis',
  'set-em-code',
  'add-cpt',
  'remove-em-code',
  'remove-cpt',
  'apply-template',
  'add-procedure',
  'update-procedure',
  'edit-note-text',
  'add-exam-finding',
  'remove-exam-finding',
] as const;

const NOTE_TEXT_FIELDS = [
  'chiefComplaint',
  'historyOfPresentIllness',
  'mechanismOfInjury',
  'ros',
  'medicalDecision',
] as const;
type NoteTextField = (typeof NOTE_TEXT_FIELDS)[number];

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: KIND_VALUES as unknown as string[] },
        display: { type: 'string' },
        searchTerms: { type: 'array', items: { type: 'string' } },
        strength: { type: 'string' },
        doseForm: { type: 'string' },
        isPrimary: { type: 'boolean' },
        code: { type: 'string' },
        message: { type: 'string' },
        procedureMatch: { type: 'string' },
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['field', 'value'],
          },
        },
        field: { type: 'string' },
        newText: { type: 'string' },
      },
      required: ['kind'],
    },
  },
  required: ['intent'],
};

const buildPrompt = (message: string, noteContext?: Partial<Record<NoteTextField, string>>): string => {
  const noteFieldLabels: Record<NoteTextField, string> = {
    chiefComplaint: 'Chief Complaint',
    historyOfPresentIllness: 'History of Present Illness (HPI)',
    mechanismOfInjury: 'Mechanism of Injury',
    ros: 'Review of Systems',
    medicalDecision: 'Medical Decision Making (MDM)',
  };
  // Note: in this codebase the in-person Chief Complaint textarea is backed by the
  // historyOfPresentIllness chart-data key, and vice versa (CC <-> HPI swap). The labels
  // above describe what the provider sees, so the LLM should reason about "HPI" / "CC" by
  // those labels and emit the corresponding `field` value as documented in the prompt below.
  const contextLines: string[] = [];
  if (noteContext) {
    for (const field of NOTE_TEXT_FIELDS) {
      const v = noteContext[field];
      if (v && v.trim()) {
        const label = noteFieldLabels[field];
        contextLines.push(`- ${label} (field="${field}"): """${v}"""`);
      } else {
        contextLines.push(`- ${noteFieldLabels[field]} (field="${field}"): <empty>`);
      }
    }
  }
  const contextBlock =
    contextLines.length > 0 ? `\nCurrent free-text fields on this encounter:\n${contextLines.join('\n')}\n` : '';

  return `
You are an assistant for a provider charting a clinical encounter. The provider just typed this
free-text request:

"""
${message}
"""
${contextBlock}
Decide which single charting action the provider wants. The action choices are:

ADD actions (search a canonical source and add the chosen record):
- "add-allergy": add an allergy to the patient's known allergies.
- "add-condition": add a past medical history condition (ICD-10).
- "add-medication": add a current/active medication.
- "add-surgical-history": add a past surgical procedure.
- "add-hospitalization": add a past hospitalization.
- "add-diagnosis": add a diagnosis for the current encounter (ICD-10). If the provider implies
  this is the primary diagnosis, set isPrimary=true; otherwise false.

CODE-BASED actions (the provider gives the code directly — emit it as the "code" field):
- "set-em-code": set the encounter's E&M (evaluation & management) CPT code. Triggered by phrases like
  "add E&M 99214", "set em code 99213", "E/M 99203". Required fields: kind, code (the E&M code as a
  string e.g. "99214"), display (a brief standard description for that code if you know it; otherwise
  echo the code).
- "add-cpt": add a CPT procedure/billing code to the encounter. Triggered by phrases like
  "add CPT 90471". Required fields: kind, code, display (brief standard description if known;
  otherwise echo the code).
- "remove-em-code": remove the encounter's E&M code. Triggered by phrases like "remove E&M",
  "remove E&M 99214". Required fields: kind. Optional: code (if the provider names a specific code
  to remove — used to confirm the right one is being deleted).
- "remove-cpt": remove a CPT code from the encounter. Triggered by phrases like "remove CPT 90471".
  Required fields: kind, code.
- "apply-template": apply a saved chart template by name. Triggered by phrases like
  "apply template laceration repair", "use AOM right template", "use template otitis media".
  Required fields: kind, display (the template name as the provider phrased it), searchTerms
  (1-3 alternate phrasings — the client fuzzy-matches these against the live list of templates).
- "add-procedure": add a procedure to the encounter, drawn from the practice's procedure quick
  picks. Triggered by phrases like "add lac repair procedure", "perform x-ray of knee",
  "procedure: laceration repair", "do a nail trephination". Required fields: kind, display
  (the procedure name as the provider phrased it), searchTerms (1-3 alternate phrasings — the
  client fuzzy-matches against the practice's procedure quick-pick names).
  IMPORTANT: an in-clinic medication administration (e.g. "Acetaminophen 1g IV in clinic",
  "Ketorolac IM", "ondansetron 4 mg IV given") is NOT a procedure — emit add-medication
  instead, with strength/doseForm. Reserve add-procedure for suturing, splinting, lavage,
  I&D, imaging, foreign body removal, and similar physical interventions.
- "update-procedure": update one or more fields on an EXISTING procedure already in the chart.
  Triggered by phrases like "adjust procedure site to arm right", "change procedure technique
  to sterile", "set procedure time spent to 30 minutes", "update the lac repair complications
  to none". Required fields: kind, updates (array of { field, value } pairs). Optional:
  procedureMatch (a phrase identifying which procedure to update — the client fuzzy-matches it
  against the procedureType or the procedure's CPT display; omit if there is clearly only one
  procedure on the chart).
  Recognized canonical field names (use these exact strings — split phrases like "site arm
  right" into multiple updates: { field: "bodySite", value: "arm" } and { field: "bodySide",
  value: "right" }):
    bodySite, bodySide, technique, suppliesUsed, procedureDetails, medicationUsed,
    complications, patientResponse, postInstructions, timeSpent, performerType,
    documentedBy, specimenSent (use "true"/"false"), consentObtained ("true"/"false").

  Most of these fields (bodySite, bodySide, technique, suppliesUsed, complications,
  patientResponse, postInstructions, timeSpent, medicationUsed) are constrained to specific
  codes from the practice's FHIR ValueSets — the client coerces the value you emit to the
  closest allowed code, OR skips the update if there is no plausible match. So: emit the
  value the provider actually said (e.g. "sterile", "chest", "right") — don't make up codes,
  but also don't emit updates for fields the provider didn't actually mention.
  specimenSent / consentObtained: "true" or "false".
  Common pitfall: words like "site", "side", "body", "to" are field-name synonyms in the
  provider's request, NOT values. Don't emit a bodySide="side" update from a phrase like
  "set body side to chest" — instead reason about what value the provider actually meant
  (here, "chest" applies to bodySite, and no bodySide value is supplied so omit bodySide).

EXAM FINDING (check a specific structured exam item):
- "add-exam-finding": add (i.e. check the box for) a structured physical-exam observation.
  Triggered by phrases like "add scalp laceration to exam", "exam: TM bulging right",
  "patient has hematoma on head", "abnormal: scalp laceration". Required fields: kind,
  display (the finding as the provider phrased it), searchTerms (1-3 alternate phrasings
  including the most likely exact label). The client fuzzy-matches against the leaf checkbox
  labels in the practice's exam template (e.g. "Scalp laceration", "Right TM bulging") and
  presents the closest matches for the provider to pick.
- "remove-exam-finding": remove an exam finding that's currently on the chart. Triggered by
  phrases like "remove sinus tenderness from exam", "uncheck scalp laceration", "remove the
  TM bulging finding". Required fields: kind, display, searchTerms. The client matches
  against the items actually present on this encounter's exam (NOT the full catalog).

NOTE-TEXT EDIT (edit the free-text content of a section of the note):
- "edit-note-text": edit the prose in Chief Complaint, HPI, MOI, ROS, or MDM. Triggered by
  phrases like "adjust HPI area affected to show left arm", "edit MOI to mention the patient
  fell on concrete", "change MDM to add: discussed return precautions", "set CC to chest pain".
  Required fields: kind, field (one of: "chiefComplaint", "historyOfPresentIllness",
  "mechanismOfInjury", "ros", "medicalDecision"), newText (the FULL new content for that
  field reflecting the provider's edit — if the provider asked to fill in a placeholder or
  append a clause, return the entire updated paragraph, not just the change).
  Use the current free-text fields shown above as the starting point. If the current field
  is empty and the instruction implies adding new prose, just set newText to the new content.

REMOVE actions (match against items ALREADY in the chart and delete):
- "remove-allergy": remove an existing allergy.
- "remove-condition": remove an existing medical-history condition.
- "remove-medication": remove a current medication.
- "remove-surgical-history": remove a surgical-history entry.
- "remove-hospitalization": remove a hospitalization entry.
- "remove-diagnosis": remove a diagnosis from this encounter.

OTHER:
- "unknown": the request doesn't clearly match any of the above, or is too vague to act on.

Return JSON with a single "intent" object:

For action kinds (everything except "unknown"):
- kind: one of the above
- display: a short, natural-language phrase describing the item to add or remove
- searchTerms: 1-3 short alternative phrasings or canonical names. For add: improve search hit
  rate. For remove: improve fuzzy match against existing chart items. Always include the display
  phrase as one of the searchTerms. For add-medication: keep searchTerms focused on the active
  ingredient or brand name (e.g. "Amoxicillin"); don't pack strength/form into the searchTerms —
  use the strength/doseForm fields below for that.
- code (add-diagnosis / add-condition only, OPTIONAL): the ICD-10 code from the message when the
  provider explicitly stated it ("acute otitis media (H66.91)", "PMH hypertension I10",
  "S93.421A ankle sprain"). Format: just the code, no parentheses. Omit if the provider didn't
  state a code.
- strength (add-medication only): the exact dose+concentration as written by the provider,
  e.g. "400 mg/5 mL", "500 mg", "10 mg/mL". Include WHENEVER the provider gives a strength;
  omit ONLY if no strength was mentioned (e.g. "start metoprolol" with no dose).
- doseForm (add-medication only): the dosage-form word, e.g. "Suspension", "Tablet",
  "Capsule", "Liquid", "Solution", "Cream", "Drops", "Spray", "Ointment", "Injection".
  Include WHENEVER the provider names a form — even when it sits next to the ingredient
  ("amoxicillin SUSPENSION", "ibuprofen TABLET"). Omit ONLY if no form was mentioned.
- isPrimary (for add-diagnosis only): true if the provider implies this is the primary diagnosis,
  otherwise false. Default false if unspecified.

For "unknown":
- kind: "unknown"
- message: one short sentence explaining what you couldn't interpret and inviting the provider to
  rephrase (e.g. "I didn't understand 'foo'. Try 'add allergy ibuprofen' or 'remove diagnosis flu'.").

DO NOT emit codes (ICD-10, RxNorm, CPT) — codes come from the canonical search the client runs.
`;
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { message, noteContext, secrets } = validateRequestParameters(input);

  const raw = await invokeChatbotVertexAI([{ text: buildPrompt(message, noteContext) }], secrets, RESPONSE_SCHEMA);

  let parsed: { intent?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw INVALID_INPUT_ERROR('Model returned non-JSON output');
  }

  const i = parsed.intent as Record<string, unknown> | undefined;
  if (!i || typeof i !== 'object' || typeof i.kind !== 'string') {
    throw INVALID_INPUT_ERROR('Model returned a malformed intent');
  }

  let intent: EasyChartAgentIntent;
  if (i.kind === 'unknown') {
    intent = { kind: 'unknown', message: typeof i.message === 'string' ? i.message : "I'm not sure what to do." };
  } else if ((KIND_VALUES as readonly string[]).includes(i.kind)) {
    const display = typeof i.display === 'string' ? i.display : '';
    const searchTerms = Array.isArray(i.searchTerms)
      ? i.searchTerms.filter((t): t is string => typeof t === 'string' && !!t.trim())
      : [];
    if (i.kind === 'set-em-code' || i.kind === 'add-cpt') {
      const code = typeof i.code === 'string' ? i.code.trim() : '';
      if (!code) {
        intent = { kind: 'unknown', message: 'I need a code for that action. Try "add E&M 99214".' };
      } else {
        intent = { kind: i.kind, code, display: display || code };
      }
    } else if (i.kind === 'remove-em-code') {
      const code = typeof i.code === 'string' ? i.code.trim() : '';
      intent = code ? { kind: 'remove-em-code', code } : { kind: 'remove-em-code' };
    } else if (i.kind === 'remove-cpt') {
      const code = typeof i.code === 'string' ? i.code.trim() : '';
      if (!code) {
        intent = { kind: 'unknown', message: 'I need a CPT code to remove. Try "remove CPT 90471".' };
      } else {
        intent = { kind: 'remove-cpt', code };
      }
    } else if (i.kind === 'update-procedure') {
      const updates = Array.isArray(i.updates)
        ? i.updates
            .filter((u): u is { field: string; value: string } => {
              return (
                !!u &&
                typeof u === 'object' &&
                typeof (u as { field?: unknown }).field === 'string' &&
                typeof (u as { value?: unknown }).value === 'string' &&
                !!(u as { field: string }).field.trim() &&
                !!(u as { value: string }).value.trim()
              );
            })
            .map((u) => ({ field: u.field.trim(), value: u.value.trim() }))
        : [];
      if (updates.length === 0) {
        intent = {
          kind: 'unknown',
          message:
            'I need at least one field and value to update on the procedure. Try "adjust procedure site to arm".',
        };
      } else {
        const procedureMatch =
          typeof i.procedureMatch === 'string' && i.procedureMatch.trim() ? i.procedureMatch.trim() : undefined;
        intent = { kind: 'update-procedure', updates, procedureMatch };
      }
    } else if (i.kind === 'edit-note-text') {
      const field = typeof i.field === 'string' ? i.field.trim() : '';
      const newText = typeof i.newText === 'string' ? i.newText : '';
      if (!(NOTE_TEXT_FIELDS as readonly string[]).includes(field)) {
        intent = {
          kind: 'unknown',
          message: `I can't edit "${field}" — try referring to chief complaint, HPI, MOI, ROS, or MDM.`,
        };
      } else {
        intent = { kind: 'edit-note-text', field: field as NoteTextField, newText };
      }
    } else if (!display) {
      intent = { kind: 'unknown', message: "I couldn't extract what to add. Try rephrasing." };
    } else if (i.kind === 'add-diagnosis') {
      const llmCode = typeof i.code === 'string' && i.code.trim() ? i.code.trim() : undefined;
      const code = llmCode ?? sniffIcdCodeScoped(message, display, searchTerms);
      intent = { kind: 'add-diagnosis', display, searchTerms, isPrimary: i.isPrimary === true, code };
    } else if (i.kind === 'add-condition') {
      const llmCode = typeof i.code === 'string' && i.code.trim() ? i.code.trim() : undefined;
      const code = llmCode ?? sniffIcdCodeScoped(message, display, searchTerms);
      intent = { kind: 'add-condition', display, searchTerms, code };
    } else if (i.kind === 'add-medication') {
      const strength = typeof i.strength === 'string' && i.strength.trim() ? i.strength.trim() : undefined;
      const llmDoseForm = typeof i.doseForm === 'string' && i.doseForm.trim() ? i.doseForm.trim() : undefined;
      // Gemini's structured output is conservative with optional fields and frequently skips
      // doseForm even when the message says "amoxicillin SUSPENSION". Fall back to a keyword
      // sniff of the message text — scoped to a window near the medication name so a form
      // mentioned for a different drug in the same message doesn't contaminate this one.
      const doseForm = llmDoseForm ?? sniffDoseFormScoped(message, display, searchTerms);
      intent = { kind: 'add-medication', display, searchTerms, strength, doseForm };
    } else {
      // Add / remove kinds without extras
      intent = { kind: i.kind, display, searchTerms } as EasyChartAgentIntent;
    }
  } else {
    intent = { kind: 'unknown', message: `Unknown action kind "${i.kind}".` };
  }

  const output: EasyChartAgentOutput = { intent };
  return { statusCode: 200, body: JSON.stringify(output) };
});
