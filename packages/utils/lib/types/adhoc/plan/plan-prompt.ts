// The planner / report-writer prompt sections that describe the fetch plan format, the scope a plan
// report's code runs in and the helpers it gets — rendered from the same constants the runner and the
// iframe runtime use, so the three never drift. Ported from Report Studio's system prompt.
import { FETCH_PLAN_LIMITS } from './fetch-plan';
import { PLAN_REPORT_SCOPE_PARAMS } from './report-scope';

export const renderFetchPlanFormatPrompt = (): string => `
FETCH PLAN FORMAT (JSON; the "plan" field of your answer):
{
  "version": 1,
  "steps": [
    {
      "id": "visits",                       // identifier; report code reads resources.visits
      "resourceType": "Appointment",        // must be a data-map type
      "description": "why this step exists",
      "params": [                           // FHIR search parameters, in order
        { "name": "date", "value": "ge{{start}}" },     // {{start}} / {{end}} = the run's ISO instants,
        { "name": "date", "value": "le{{end}}" },       // {{startDate}} / {{endDate}} = yyyy-MM-dd
        { "name": "_tag", "value": "OTTEHR-IP,OTTEHR-TM" },
        { "name": "_include", "value": "Appointment:patient" },
        { "name": "_include", "value": "Appointment:location" },
        { "name": "_revinclude", "value": "Encounter:appointment" }
      ],
      "mode": "auto",                       // auto (counted first, then paged or bulk jobs of ~5,000 rows; a step the saved densities
                                            //   expect past ${FETCH_PLAN_LIMITS.autoBulkThreshold} goes straight to bulk) | normal (paged only) | bulk
      "elements": ["status", "start", "participant"]   // optional _elements trim; id/meta always come back
    },
    {
      "id": "providers",
      "resourceType": "Practitioner",
      "from": { "step": "visits", "path": "participant.individual.reference", "param": "_id", "keepType": "Practitioner" },
      "params": [],
      "elements": ["name"]
    }
  ]
}
- A step WITHOUT "from" is a plain search. A step WITH "from" is scoped: the values found at "path" in the
  earlier step's resources (arrays flattened, deduped, references filtered to keepType) are fed to "param" in
  batches of up to ${FETCH_PLAN_LIMITS.scopedBatchSize}, searched side by side. For "_id" the "Type/" prefix is stripped; for reference params
  ("encounter", "patient", "request", "context") the full "Type/id" is kept (a bare id gets "keepType/" prefixed).
  For a bare-value path such as "id", keepType picks WHICH source resources contribute: { path: "id", param:
  "encounter", keepType: "Encounter" } over a mixed visits step feeds only the Encounter ids.
- Included resources (_include / _revinclude) land in the SAME step array; use helpers.index(resources.visits).byType.
  "elements" does NOT trim included resources. _revinclude:iterate is for small per-visit tables (Procedure, Condition,
  ServiceRequest, DiagnosticReport); for Observation, QuestionnaireResponse, Coverage use a scoped step with "elements".
- "elements" takes FHIR base names for choice types: "value" not "valueQuantity", "effective" not "effectiveDateTime".
- COUNT-ONLY steps: a step whose params include { "name": "_summary", "value": "count" } fetches no records and gives
  the server's exact total in params.totals[stepId]. When the report shows only counts (visits per month, per
  location, per status), use one count step per bucket — each with its own literal date or filter params, up to
  ${FETCH_PLAN_LIMITS.maxSteps} steps a plan — instead of fetching the records: a year of monthly visit counts took 5.7 s
  on a busy practice against 23.6 s to fetch its 32,285 visits. Not for QuestionnaireResponse (the server fails the count).
- Clinical records of visits — Condition, MedicationRequest, Procedure, QuestionnaireResponse — have no reliable date of
  their own in Ottehr data (recorded-date / authoredon / authored were empty or partial on a busy practice: 0, 0 and
  2,922 of 9,316 found by date). Fetch them through the visits' encounters, as the data map says, never by their own date.
- A date search on a Period that has no end (follow-up encounters, active coverages) matches everything started before
  the range end: date=ge{{start}}&date=le{{end}} found 20,358 follow-ups for 60 days where 4,150 started in it. For
  "started in the range" use date=sa{{start}}&date=le{{end}} (sa = starts after).
- {{patientId}} in a param value is the run's patient parameter (the screen that runs the report supplies it) — for
  per-patient reports such as one patient's history, e.g. { "name": "patient", "value": "Patient/{{patientId}}" }.
  A per-patient report has no date range: do not template {{start}} / {{end}} in it.
- A report over a period templates {{start}} / {{end}} (or {{startDate}} / {{endDate}}) in its plan; the screen that
  runs it supplies the range and lets the user change it. Never put literal dates computed from today into a plan.
- At most ${FETCH_PLAN_LIMITS.maxSteps} steps. Independent steps run in parallel; a scoped step waits for its source.
- The server rejects unknown search parameters with an error, which fails that step: use only the parameters the data
  map lists for a resource type and the standard FHIR ones (_id, _tag, _include, _revinclude, _elements, _summary).
`;

export const renderPlanReportCodeContractPrompt = (): string => `
REPORT CODE CONTRACT (the "code" field): a JavaScript/JSX FUNCTION BODY, run inside a sandboxed iframe as the body of
  function buildReport(${PLAN_REPORT_SCOPE_PARAMS.join(', ')}) { <YOUR CODE>; return ReportRoot; }
In scope, and nothing else:
- React — the React namespace (hooks as React.useState etc., or destructure once).
- MUI — the curated MUI components listed under COMPONENTS.
- Report — the report components listed under COMPONENTS.
- resources — { [stepId]: FhirResource[] } exactly as fetched (raw FHIR R4B JSON).
- helpers — the data map's computed fields and lookups (HELPERS below).
- params — { dateRange: { start, end } (ISO instants of the run, when the plan has a date range), timeZone (the
  viewer's IANA zone), patientId (the run's patient parameter, when one is set), totals: { [stepId]: number } for
  count-only steps }.
Rules:
- Define a root component and END with:  return ReportRoot;   The runtime renders <ReportRoot /> with NO props —
  read resources/helpers/params from the enclosing scope. Prepare data at the top level with plain JS (no hooks
  there); hooks only inside components.
- Write JSX freely; no import/require/exports, no network, no window/document access; render through React only.
- A bare < or > or { } inside JSX TEXT breaks transpilation — write them as expressions ({'<'}) or in words.
- NULL-SAFETY: any FHIR field may be missing. Guard every property read on optional data.
- NEVER FABRICATE: every number comes from the resources. If something cannot be computed, render a
  <Report.Note tone="warn"> at the top saying so; never a plausible-looking placeholder.
- DISCLOSE the rules you applied (thresholds, code sets, which statuses count) in a Report.Note or section title.
- Group by viewer-local day with helpers.localDay(iso); never slice ISO strings for dates.
- Patient identities only when the request is a per-patient worklist; aggregate otherwise.
- Empty / all-zero series: render a Note instead of blank axes. Cover a step with no resources with a friendly Note.
`;

export const renderPlanReportHelpersPrompt = (): string => `
HELPERS (helpers.*):
- ref(resource) → "Type/id";  refId("Type/id") → "id".
- index(...lists) → { byType: { Encounter: [...], Patient: [...] }, byRef: Map("Type/id" → resource) };
  resolve(reference, idx) → the resource or undefined.
- participantRef(appointment, "Location" | "Patient" | "Practitioner") → reference; encountersOf(appointment, encounters).
- localDay(iso) → "yyyy-MM-dd" in the viewer's zone; localTime(iso) → "HH:mm"; localHour(iso) → 0..23; weekdayName(iso).
- minutesBetween(startIso, endIso); ageAt(birthDate, atIso?) → years.
- fullName(patientOrPractitioner) → "First Middle Last".
- codings(concept, system?) → Coding[]; codeOf(concept, system?) → code; displayOf(concept, system?) → display|text|code.
  Systems: ICD-10 "http://hl7.org/fhir/sid/icd-10" (a few icd-10-cm), CPT "http://www.ama-assn.org/go/cpt".
- hasTag(resource, code) → meta.tag code present.
- icd10Code(condition) → the ICD-10 code; procedureKind(procedure) → "em" | "cpt" | "surgical-history" | undefined.
- diagnosesOf(encounter, idx) → [{ code, display, primary, condition }] in rank order, one per code, missing Conditions skipped.
- proceduresOf(encounter, idx) → [{ code, display, kind, procedure }] one per code, the E&M ("em") first; idx must hold the
  Procedures (fetched with the visits step via _revinclude:iterate=Procedure:encounter).
- labResultsOf(encounter, idx) → { orders: [{ name, status, serviceRequest }], results: [{ name, abnormal, status, report }],
  abnormal } from the ServiceRequests coded as lab tests and the DiagnosticReports of the visit.
- vitalsOf(observations) → { temperatureF, heartRate, respirationRate, oxygenSaturation, systolicBP, diastolicBP, weightKg,
  heightCm, hasBloodPressure, count } — the latest reading per vital out of ONE visit's vital-* Observations: group first with
  helpers.groupBy(resources.vitals, (o) => o.encounter && o.encounter.reference), then vitalsOf(byEnc[helpers.ref(e)] || []).
- visitStatus(appointment, encounter) → pending | arrived | intake | ready | ready for provider | provider | discharged |
  completed | cancelled | no show | awaiting supervisor approval | unknown.
- visitStatusHistory(encounter, appointment) → [{ status, period: { start, end } }];
  visitTiming(appointment, encounter) → { arrived, intake, provider, discharged, completed (ISO), arrivedToIntake,
  intakeToProvider, arrivedToProvider, providerToDischarge, total, withProvider (minutes; undefined when an end is missing) };
  visitTotalMinutes(appointment, encounter) → length of stay; waitMinutes(encounter, appointment) → minutes in arrived+ready.
- attendingId(encounter) / admitterId(encounter) → Practitioner id; encounterVisitType(encounter) → main | follow-up | scheduled-follow-up.
- isTelemed(appointment) / isInPerson(appointment); appointmentType(appointment) → walk-in | pre-booked | post-telemed.
- paymentNetAmount(paymentNotice) → USD after settled refunds.
- qrAnswers(questionnaireResponse) → { linkId: value | [values] }.
- groupBy(items, keyFn) → { key: items[] }; countBy(items, keyFn) → { key: n }; sum, avg, median, round(value, digits).
`;
