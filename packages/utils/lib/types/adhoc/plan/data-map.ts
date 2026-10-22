// The data map: what Ottehr's FHIR data MEANS, as data. The planner (an AI) reads it to write a
// fetch plan; the plan check uses it as the allowlist (only described resource types are readable);
// the report code gets its computed fields as iframe helpers. First pass — facts taken from today's
// dataset code (shared/adhoc-report.ts, shared/adhoc-datasets/*). Kept zod-free and side-effect-free
// so the iframe runtime can import names from it cheaply.
//
// Naming rule for editors: a bug fix keeps an entry's name; a change in MEANING gets a new name.

export interface DataMapEntry {
  resourceType: string;
  /** What this resource is in Ottehr's terms. */
  meaning: string;
  /** Fields worth knowing, with Ottehr specifics. One line each. */
  fields: readonly string[];
  /** How it links to other resources — and the search parameters that follow those links. */
  links?: readonly string[];
  /** Search parameters known to work against Oystehr (besides the standard ones). */
  search?: readonly string[];
  /** Known server gaps / things to avoid. */
  gaps?: readonly string[];
}

export const ADHOC_DATA_MAP: readonly DataMapEntry[] = [
  {
    resourceType: 'Appointment',
    meaning:
      'One visit booking. A visit is an Appointment plus its Encounter (status and timeline live on BOTH). Only ' +
      'Ottehr visits carry a module tag: meta.tag code OTTEHR-IP (in-person) or OTTEHR-TM (telemed) — always ' +
      'filter with _tag=OTTEHR-IP,OTTEHR-TM or the search also returns non-visit appointments.',
    fields: [
      "start / end: scheduled instants (ISO, UTC). Use helpers.localDay(start) for the visit day in the viewer's zone.",
      'status: proposed | pending | booked | arrived | checked-in | fulfilled | cancelled | noshow | waitlist. ' +
        'The visit status users see is COMPUTED from Appointment + Encounter: helpers.visitStatus(appointment, encounter).',
      "appointmentType.text: 'walkin' | 'prebook' | 'posttelemed' (helpers.appointmentType gives the label).",
      'serviceCategory[].coding (system .../service-category): the practice-defined visit category (display is the label).',
      'participant[]: actor Patient/<id> (the patient), Location/<id> (the location of in-person visits), ' +
        'Practitioner/<id> (telemed assignment). Use helpers.participantRef(appointment, "Location").',
      'cancelationReason.coding[0].display: why a cancelled visit was cancelled.',
      'created: when it was booked (walk-ins are created at arrival).',
      'description: the reason for visit (free text the patient or staff entered). reasonCode is rarely set.',
      'meta.tag with system "created-by": who registered the visit, in display only (no code): "QR - Patient …" = walk-in ' +
        'at the kiosk, "Patient …" = self-scheduled, "Staff <email>" = staff, "M2M Client …" = automated. A visit can carry two.',
    ],
    links: [
      'Encounter.appointment[0].reference → this Appointment (_revinclude=Encounter:appointment, small result sets only — see gaps).',
      '_include=Appointment:patient brings the Patient; _include=Appointment:location the Location (small result sets only).',
      'FAST PATH for visit-level clinical data: add _revinclude:iterate=<Type>:encounter to the SAME step for Procedure, ' +
        'Condition, ServiceRequest, DiagnosticReport, MedicationRequest (and MedicationAdministration:context). A year of ' +
        'visits with all six took well under half the time of the same tables as scoped steps; for Procedure alone the ' +
        'fast path and a scoped step after the encounters cost the same (60 days at a busy practice).',
    ],
    search: [
      'date=ge{{start}}&date=le{{end}} bounds the scheduled start (both bounds inclusive).',
      'status=booked,arrived,... (comma list). _tag=OTTEHR-IP,OTTEHR-TM.',
      'THE STANDARD VISIT SEARCH — three date-bounded steps side by side, each with "elements": Appointment?date=ge{{start}}' +
        '&date=le{{end}}&_tag=OTTEHR-IP,OTTEHR-TM; Encounter?appointment.date=ge{{start}}&appointment.date=le{{end}}; ' +
        'Patient?_has:Appointment:patient:date=ge{{start}}&_has:Appointment:patient:date=le{{end}}. Then Location (and ' +
        'Practitioner) as SMALL scoped id lists with "elements" from { step: "visits", path: "participant.actor.reference", ' +
        'param: "_id", keepType: "Location" }. Join in code by id: Encounter.appointment[0].reference → Appointment, ' +
        'Appointment.participant Patient/<id> → Patient. ALTERNATIVE, faster at a year on a busy practice: ' +
        "Encounters and Patients scoped to the visits' ids as PAGED batches (mode auto) — at a year, encounters by id " +
        'ran in about a third of the time of appointment.date and patients by id in about a sixth of _has, after the ' +
        'visits step; at 60 days the two shapes cost about the same — the same sets. An earlier ' +
        'measurement had id lists at a couple of hundred requests and minutes for a year; those ran as bulk jobs per batch, not pages. On a year of synth the by-date steps returned exactly the id-list sets (2,697 Encounters, ' +
        '2,427 Patients, no differences). The Encounter step also brings encounters of appointments outside the Ottehr tags, ' +
        'and the Patient step every patient with an appointment in the range (in principle also one with a visit at or after ' +
        'the start and another at or before the end, a superset) — the joins by id ignore both. Follow-up encounters (partOf ' +
        "→ the visit Encounter, class VR, type SNOMED 390906007) carry their visit's appointment too: at a busy practice " +
        'every follow-up of 60 days of visits came back with the visit encounters by appointment (a part-of step found ' +
        'none more), so _revinclude:iterate Encounter:part-of adds nothing there (warm, it cost nothing measurable either). ' +
        'Follow-ups are ~1 per visit, 1–7 days after it, and their ' +
        'period has NO end: Encounter?date=ge{{start}}&date=le{{end}}&part-of:missing=false matches every follow-up since ' +
        'go-live (about five times the follow-ups that started in a 60-day range); "started in the range" is ' +
        'date=sa{{start}}&date=le{{end}} (starts after).',
      'Per-patient reports: Appointment?patient=Patient/{{patientId}} (no date range needed) with _include patient / location ' +
        'and _revinclude Encounter:appointment on the same step (a small result set).',
    ],
    gaps: [
      'For more than a few hundred visits do NOT _include Patient/Location or _revinclude Encounter on the Appointment step: ' +
        'included resources ignore _elements, so the step is 17+ MB and 8–10 s for a year of synth visits (2,700). The split ' +
        'shape above with "elements" on every step fetched the same resources in 4–5 s (12 MB).',
      'Leave mode on "auto": the runner reads one page and finishes a step with more as one async-bulk job (up to 30,000 ' +
        'primary resources a job; a step past that is split into date halves), and with saved densities a large step goes ' +
        'straight to bulk jobs of ~10,000 records side by side — a year of visits at a busy practice is two to four ' +
        'jobs. A year of synth (2,697) is three pages or one job, 1.3–3.2 s either way.',
      'Never put _revinclude on a date-bounded Encounter step at volume: Encounter + Condition:encounter for a year ran as ' +
        'one job of minutes (two at a busy practice, nine at a busier one); the same Conditions as ' +
        'their own step — Condition?encounter:Encounter.appointment.date=ge{{start}}&encounter:Encounter.appointment.date=le{{end}} ' +
        '— took a third of that unsized and a tenth in 8 windows, beside a comparable Encounter step.',
    ],
  },
  {
    resourceType: 'Encounter',
    meaning:
      'The clinical side of a visit: who saw the patient, the status timeline, the diagnoses. One per Appointment; ' +
      'a follow-up note is an extra Encounter with partOf → the visit Encounter (type coding SNOMED 390906007).',
    fields: [
      'status: planned | arrived | in-progress | finished | cancelled. period is NOT populated by Ottehr (blank on nearly ' +
        'every encounter) — all visit times come from statusHistory.',
      'statusHistory[]: {status, period, extension visit-status} — the timeline the visit went through; helpers.visitStatusHistory(encounter, appointment) ' +
        'turns it into Ottehr visit statuses (pending, arrived, intake, ready for provider, provider, discharged, completed…) ' +
        'with periods; helpers.visitTiming(appointment, encounter) gives the key instants and interval minutes. ' +
        'Wait = minutes in "arrived" + "ready" before intake; length of stay = helpers.visitTotalMinutes.',
      'participant[]: type coding ATND = attending provider, ADM = admitter (intake staff); individual.reference = ' +
        'Practitioner/<id>; period.start/end = when they started / finished with the patient. helpers.attendingId(encounter).',
      'diagnosis[].condition.reference → Condition/<id> (the visit diagnoses; rank 1 = primary). Some references point to ' +
        'Conditions that no longer exist — resolve and skip the misses. helpers.diagnosesOf(encounter, idx).',
      'hospitalization.dischargeDisposition: coding[0].code ∈ pcp | pcp-no-type (follow up with PCP), specialty, ed (ED transfer), ' +
        'another (another location), ip | ip-oth (in-person office transfer); text = the discharge instructions.',
      'subject.reference → Patient/<id>. appointment[0].reference → Appointment/<id>. partOf → parent Encounter (follow-ups).',
      'helpers.encounterVisitType(encounter): "main" | "follow-up" | "scheduled-follow-up".',
    ],
    links: [
      'Condition by _id from diagnosis[].condition.reference (scoped step, keepType Condition).',
      'Practitioner by _id from participant.individual.reference (scoped step, keepType Practitioner).',
      'Procedure?encounter=Encounter/<id>, DocumentReference?encounter=…, ServiceRequest?encounter=…, ' +
        'Observation?encounter=…, QuestionnaireResponse?encounter=…, PaymentNotice?request=Encounter/<id> ' +
        '(scoped step: from { step: "visits", path: "id", param: "encounter", keepType: "Encounter" }).',
    ],
    search: [
      "The encounters of the visits in a range: Encounter?appointment=<the visits' ids> as a scoped step after the " +
        'Appointment step (paged batches; at a year on a busy practice about a third of the time of the chain), or ' +
        'Encounter?appointment.date=ge{{start}}&appointment.date=le{{end}} (chained) beside it — the same set; the chain ' +
        'cost about the same as the scoped step at 60 days but three times as much at a year. Encounter.period is blank on the visit ' +
        "encounters on synth (Encounter?date= found 3 of 2,697) and set but open-ended on a busy practice's follow-ups — a period " +
        'with no end matches any date=ge…&le… range after its start, so for "started in the range" use date=sa{{start}}&' +
        'date=le{{end}} (ge/le returned about five times the follow-ups that started in a 60-day range). Visits through their appointments.',
    ],
  },
  {
    resourceType: 'Patient',
    meaning: 'A patient. Demographics only — the chart lists hang off the patient as tagged resources.',
    fields: [
      'name[0].given/family (helpers.fullName), birthDate (yyyy-MM-dd; helpers.ageAt), gender.',
      'address[0].city/state/postalCode, telecom (phone/email). Extensions carry race, ethnicity, preferred language.',
    ],
    search: [
      'Patient?_has:Appointment:patient:date=ge{{start}}&_has:Appointment:patient:date=le{{end}} with elements ["name", …]: the ' +
        'patients of the visits in a range as a date-bounded step beside the Appointment step (the standard shape, see ' +
        'Appointment) — the same 2,427 patients as the id list on a year of synth, one bulk job for a year at a busy practice. ' +
        'It can also include a patient with one appointment at or after the start and another at or before the end; the join ' +
        'by id ignores them. A scoped id list from { step: "visits", path: "participant.actor.reference", param: "_id", ' +
        'keepType: "Patient" } is for small sets only.',
    ],
    links: [
      'Appointment?patient=Patient/<id>; Coverage?beneficiary=…; Account?subject=…; RelatedPerson?patient=… (contacts).',
      'Chart lists: AllergyIntolerance?patient=…&_tag=known-allergy; Condition?patient=…&_tag=medical-condition; ' +
        'MedicationStatement?patient=…&_tag=current-medication,prescribed-medication; Procedure?patient=…&_tag=surgical-history; ' +
        'EpisodeOfCare?patient=…&_tag=hospitalization.',
    ],
    gaps: [
      'Report code must never list patient identities unless the request is a per-patient worklist; aggregate by default.',
    ],
  },
  {
    resourceType: 'Location',
    meaning: 'A practice location (in-person) or the virtual location of a telemed state.',
    fields: [
      'name, address.state/city (region), identifier (slug), extension url …/StructureDefinition/timezone (valueString IANA zone). ' +
        'Opening hours are NOT here — they are on the Schedule whose actor is this Location.',
    ],
  },
  {
    resourceType: 'Practitioner',
    meaning: 'A provider or staff member. Role on a visit comes from Encounter.participant types, not from here.',
    fields: ['name[0] (helpers.fullName), identifier NPI, qualification (credentials), extension provider type.'],
    search: [
      'Fetch by _id in batches (scoped step) with elements ["name","identifier","qualification"] — never the whole table.',
    ],
  },
  {
    resourceType: 'Condition',
    meaning:
      'A diagnosis (ICD-10) — of a visit when tagged diagnosis and referenced from Encounter.diagnosis; a problem-list entry when tagged medical-condition.',
    fields: [
      'code.coding[]: system is http://hl7.org/fhir/sid/icd-10 on almost all (a few icd-10-cm) — match the system by "icd-10" or use ' +
        'helpers.icd10Code(condition). code + display. ICD-10 is hierarchical — match families by prefix.',
      'encounter.reference, subject.reference, clinicalStatus, onsetDateTime.',
    ],
    search: [
      'The diagnoses of the visits in a range: Condition?encounter:Encounter.appointment.date=ge{{start}}&encounter:Encounter.' +
        'appointment.date=le{{end}} as a step of its own with elements ["code", "encounter"] (the typed chain; see Encounter ' +
        'for why not _revinclude), or a scoped step Condition?encounter=<the visit encounters> — the same set at 60 days ' +
        "on a busy practice; warm, the chain was somewhat faster than the scoped plan, but the chain's first cold run " +
        'took five times as long. At a year the scoped plan was steady while the chain ran three times as long cold — prefer scoped when the first run matters. Never Condition?recorded-date: Ottehr leaves it empty (0 found). Join to the Encounter by ' +
        'encounter.reference or Encounter.diagnosis in code.',
    ],
  },
  {
    resourceType: 'Procedure',
    meaning:
      'A billing code of a visit — an E&M level (tag em-code) or a CPT procedure code (tag cpt-code) — or surgical history (tag surgical-history).',
    fields: [
      'code.coding[0].code + display. E&M codes (99202–99215) carry NO system; CPT codes carry system http://www.ama-assn.org/go/cpt. ' +
        'The kind is the meta tag: helpers.procedureKind(procedure) → "em" | "cpt" | "surgical-history". CPT is NOT hierarchical — never prefix-match.',
      'encounter.reference, subject.reference, status. performedDateTime is usually absent — use the visit date.',
      'The cpt-code tag does not say where a code came from: codes a provider added and codes created by radiology, in-house lab ' +
        'and medication orders share it. basedOn → ServiceRequest names the order when the code was order-created (rare on synth).',
    ],
    search: [
      'Best fetched with the visits step via _revinclude:iterate=Procedure:encounter; or Procedure?encounter=Encounter/<id>,… ' +
        '(scoped step, path "id", keepType Encounter). helpers.proceduresOf(encounter, idx).',
    ],
  },
  {
    resourceType: 'Coverage',
    meaning:
      "An insurance coverage of a patient. Primary / secondary is the Account's coverage order, not Coverage.order alone.",
    fields: [
      'beneficiary → Patient; payor[0] → Organization (the payer); class[] type "plan" name = plan name. type.coding is BLANK on ' +
        'every synth coverage (the self-pay coding coverage-selfpay|pay occurs 0 times) — the usable rule is: a patient with no ' +
        'active Coverage is self-pay.',
      'status active | cancelled; period; subscriberId.',
    ],
    links: [
      'Coverage?beneficiary=Patient/<id>,…&_include=Coverage:payor brings the payer Organizations along (scoped step from the ' +
        'visits step: path participant.actor.reference, keepType Patient) — small sets only.',
    ],
    search: [
      'The coverages of the patients with a visit in a range: Coverage?beneficiary:Patient._has:Appointment:patient:date=ge{{start}}' +
        '&beneficiary:Patient._has:Appointment:patient:date=le{{end}} as a step of its own (the same 2,919 coverages as the id list ' +
        'on a year of synth; one of the slower steps for a year at a busy practice). Then Organization by _id from payor.reference (small).',
    ],
  },
  {
    resourceType: 'Account',
    meaning: "A patient's billing account: which coverages apply and in which order.",
    fields: ['subject[0] → Patient; coverage[]: {coverage → Coverage, priority 1 = primary}; status; type.'],
    search: [
      'The accounts of the patients with a visit in a range: Account?subject:Patient._has:Appointment:patient:date=ge{{start}}' +
        '&subject:Patient._has:Appointment:patient:date=le{{end}} as a step of its own — the type in the chain is required ' +
        '(subject._has:… is rejected: "set type explicitly"); the same 2,427 accounts as the id list on a year of synth. ' +
        'Account?subject=Patient/<id>,… (scoped from the visits step, keepType Patient) for small sets only.',
    ],
    gaps: [
      '_include=Account:coverage is NOT a valid include (the server rejects it) — fetch Coverage by beneficiary instead.',
    ],
  },
  {
    resourceType: 'Organization',
    meaning: 'Payers (insurance companies), employers and the practice itself.',
    fields: ['name, type[].coding (pay = payer), identifier (payer id), active.'],
  },
  {
    resourceType: 'InsurancePlan',
    meaning: "A payer plan offered in the practice's insurance picker.",
    fields: ['name, ownedBy → Organization, status.'],
  },
  {
    resourceType: 'Claim',
    meaning: 'An insurance claim built from a visit (RCM).',
    fields: [
      "identifier[] with type/system 'claim-encounter-id' carries the visit's Encounter id.",
      'patient, provider, insurer → Organization, created, status, total.value, item[]: productOrService.coding (CPT), ' +
        'quantity, unitPrice, diagnosisSequence; diagnosis[].diagnosisCodeableConcept (ICD-10).',
    ],
  },
  {
    resourceType: 'PaymentNotice',
    meaning: 'A patient payment (card or cash) against a visit.',
    fields: [
      'request → Encounter (the visit paid for); amount.value (USD); created; status active = collected, cancelled = voided.',
      'extensions record refunds and voids — helpers.paymentNetAmount(notice) gives amount less settled refunds.',
    ],
    search: ['PaymentNotice?request=Encounter/<id>,… (scoped step from Encounter step).'],
  },
  {
    resourceType: 'Invoice',
    meaning:
      'A patient invoice (self-pay balance) — Ottehr itself writes NO Invoice resources (synth has none); patient invoicing goes ' +
      'through Stripe and is tracked by Tasks coded rcm-task|send-invoice-to-patient. Expect this table to be empty.',
    fields: [
      'subject → Patient, status (draft | issued | balanced | cancelled), date, totalGross.value, totalNet.value.',
    ],
  },
  {
    resourceType: 'ChargeItemDefinition',
    meaning: 'Fee schedules / charge masters used to price visits (tagged under the rcm tag system).',
    fields: [
      'code, propertyGroup[].priceComponent (amounts), meta.tag codes fee-schedule | charge-master | self-pay | default-insurance.',
    ],
  },
  {
    resourceType: 'Task',
    meaning:
      'Work items (follow-ups, lab/radiology review, billing, messages). The kind is code.coding for system tasks and ' +
      'groupIdentifier (system …/Identifier/task-category) for the staff worklist — manual staff tasks have an EMPTY code and ' +
      'a task-category value of manual-* (manual-external-lab, manual-in-house-lab, …).',
    fields: [
      'code.coding: system …/CodeSystem/ottehr-system-task (harvest-paperwork, send-document-packet, …), in-house-lab-task ' +
        '(IRT, CST, RFRT), external-lab-task; groupIdentifier.value: in-house-lab | external-lab | radiology | manual-… (the worklist category).',
      'status (requested | in-progress | completed | cancelled | failed), businessStatus.text, authoredOn (created), lastModified, ' +
        'executionPeriod.end (completed at), owner → Practitioner, for → Patient, focus → the resource it is about, intent.',
    ],
    search: [
      'Task?authored-on=ge{{start}}&authored-on=le{{end}}; status=…; code=<system>|<code>; group-identifier=<system>|<value>.',
    ],
    gaps: [
      'Most Tasks are automated harvest-paperwork tasks (one per visit); filter by code or category before counting "work".',
    ],
  },
  {
    resourceType: 'ServiceRequest',
    meaning:
      'An order or plan of a visit: a lab test, a radiology study, an in-office procedure, a referral, or the disposition follow-up. ' +
      'The kind is the meta tag or the code system, not category.',
    fields: [
      'Lab orders: code.coding[] with system …/in-house-lab-test-code (code = the test name, e.g. "Rapid Strep A", plus a CPT coding) ' +
        'or …/oystehr-lab-local-codes (external labs); no tag. helpers.labResultsOf(encounter, idx) pairs them with results.',
      'Tags: radiology (imaging orders, category SNOMED 363679005), procedure (in-office procedures; category = procedure type), ' +
        'disposition-follow-up (the generic "follow up in N days" plan), sub-follow-up (a named follow-up: performerType = the ' +
        'specialist / service, SNOMED coded). Count follow-ups with sub-follow-up, status != revoked.',
      'status active | completed | revoked, authoredOn, requester → Practitioner, encounter, subject, reasonCode (ICD-10).',
    ],
    search: [
      'With the visits step via _revinclude:iterate=ServiceRequest:encounter (fast), or ServiceRequest?encounter=… (scoped), ' +
        'or ServiceRequest?authored=ge{{start}}&authored=le{{end}}.',
    ],
  },
  {
    resourceType: 'DiagnosticReport',
    meaning: 'Lab or radiology results for an order (one per resulted test).',
    fields: [
      'code.coding[]: the test name is the coding with system …/in-house-lab-test-code (code = name) or …/oystehr-lab-local-codes ' +
        '(display = name); a CPT coding sits beside it. code.text is usually blank on in-house results.',
      'Abnormal / inconclusive results are META TAGS (code abnormal | inconclusive), not interpretation. ' +
        'basedOn → ServiceRequest, encounter, status (final), issued, result[] → Observation, category LAB | OSL.',
    ],
    search: [
      'With the visits step via _revinclude:iterate=DiagnosticReport:encounter, or DiagnosticReport?encounter=… (scoped).',
    ],
  },
  {
    resourceType: 'Observation',
    meaning:
      'Vitals, exam/ROS findings, screening answers, AI observations and in-house lab result values. There is NO category: chart ' +
      'Observations are told apart by the meta tag SYSTEM (…/StructureDefinitions/patient-vitals-field, exam-observation-field, ' +
      'ros-observation-field, additional-questions-field, ai-observation); in-house lab RESULT values carry no tag at all — their ' +
      'code.coding system is …/in-house-lab-test-code (plus a CPT coding), with basedOn → ServiceRequest, specimen and interpretation.',
    fields: [
      'Vitals: meta.tag code vital-temperature | vital-heartbeat | vital-respiration-rate | vital-oxygen-sat | vital-blood-pressure | ' +
        'vital-weight | vital-height (search with _tag=vital-temperature,…). valueQuantity.value/unit: temperature in °C (unit "C"), ' +
        'heart rate beats/min, SpO2 % (unit label may be wrong), weight kg, height cm. Blood pressure is in component[] coded ' +
        'LOINC 8480-6 / 8462-4 or SNOMED 271649006 / 271650006 (systolic / diastolic) — many BP observations have no components.',
      'effectiveDateTime, encounter, subject, performer → Practitioner. code.text repeats the tag on most vitals. helpers.vitalsOf(observations).',
      'Exam / ROS findings: tags like normal-mental-status with valueBoolean; most Observations of a visit are these.',
    ],
    search: [
      'Observation?encounter=… (scoped, keepType Encounter) with _tag=vital-… — fetching all Observations of a visit brings the exam too.',
      'Practice-wide vitals by date: _tag=vital-…&date=ge{{start}}&date=le{{end}} (the tag makes the date search fast; Observation ' +
        'by date alone could not even be counted on a busy practice). A threshold goes to the server: value-quantity=gt38 with ' +
        '_tag=vital-temperature returned exactly the fevers that filtering the temperatures in code found, in about a third ' +
        'of the time (60 days at a busy practice); add _summary=count when only the number is needed (faster still).',
    ],
    gaps: [
      'Never search Observation without an encounter, patient or date filter — the table is huge.',
      '_elements must name "value" and "effective" (FHIR base names), not valueQuantity / effectiveDateTime.',
    ],
  },
  {
    resourceType: 'MedicationRequest',
    meaning: 'A prescription (eRx, tagged erx-medication).',
    fields: [
      'medicationCodeableConcept.text = drug name with strength and form; status, authoredOn, requester → Practitioner, encounter, subject, dosageInstruction.',
    ],
    search: [
      'MedicationRequest?encounter=…&_tag=erx-medication, or with the visits step via _revinclude:iterate=MedicationRequest:encounter.',
    ],
  },
  {
    resourceType: 'MedicationAdministration',
    meaning:
      'An in-house medication order / dose (tag in-house-medication-administration-order) or a vaccine given (tag immunization).',
    fields: [
      'The drug is a CONTAINED Medication (medicationReference "#…"): contained[0].code.text (or coding display) for medications, ' +
        'contained[0].identifier[].value for vaccines (the inventory name). medicationCodeableConcept is not set.',
      'status: in-progress = pending, completed = administered, on-hold = partly administered, not-done = not administered, ' +
        'stopped = cancelled (synth only has the first two). effectiveDateTime, context → Encounter, performer[] → Practitioner ' +
        '(function codes), reasonReference → Condition.',
    ],
    search: [
      'MedicationAdministration?context=Encounter/<id>,… (scoped), or with the visits step via _revinclude:iterate=MedicationAdministration:context.',
    ],
  },
  {
    resourceType: 'MedicationStatement',
    meaning:
      'Current / prescribed medications (chart list, tags current-medication / prescribed-medication) and immunization records.',
    fields: [
      'medicationCodeableConcept, status, effectiveDateTime, subject, context → Encounter, partOf → MedicationAdministration, meta.tag.',
    ],
  },
  {
    resourceType: 'AllergyIntolerance',
    meaning: 'Chart allergy list (tag known-allergy).',
    fields: ['code.coding, clinicalStatus, patient, recordedDate, reaction.'],
  },
  {
    resourceType: 'EpisodeOfCare',
    meaning: 'Hospitalization history entries (tag hospitalization).',
    fields: ['type, period, patient, status.'],
  },
  {
    resourceType: 'DocumentReference',
    meaning:
      'A document of a visit or patient: visit note PDF, consent, insurance card, school/work note, uploaded file.',
    fields: [
      'type.coding (document kind), description, date, status (current | superseded), context.encounter[0] → Encounter, subject → Patient, ' +
        'content[].attachment.title is a document-type key, content[].attachment.url the file.',
    ],
    search: [
      'DocumentReference?encounter=… with elements ["type","description","date","status","context","subject"] — never attachments.',
    ],
  },
  {
    resourceType: 'QuestionnaireResponse',
    meaning: 'Paperwork and screening-form answers (intake paperwork, consents, scored screening forms).',
    fields: [
      'questionnaire (canonical url|version of the form), status (in-progress | completed), authored, encounter, subject, ' +
        'item[] tree: {linkId, text, answer[].value*, item[]} — helpers.qrAnswers(response) flattens to {linkId: value}.',
    ],
    search: [
      'The paperwork of the visits in a range: QuestionnaireResponse?encounter:Encounter.appointment.date=ge{{start}}&encounter:' +
        'Encounter.appointment.date=le{{end}} as a step of its own, or scoped to the visit encounters — the same set ' +
        "in 60 days at a busy practice, about the same warm (the chain's first cold run three times slower); at a year scoped was steady while the chain cost more cold and warm — prefer scoped. Always trim: " +
        'paged, 14 days took a tenth of the time with "elements". Never QuestionnaireResponse?authored=: it found ' +
        'under a third of them. ' +
        'It is the heaviest visit table — hundreds of MB a year at a busy practice — so ' +
        'always set "elements" and expect it to be the slowest step. QuestionnaireResponse?encounter=… (scoped) for small sets; ' +
        '?authored=ge{{start}}&authored=le{{end}}&status=completed when the authored date is what matters.',
    ],
    gaps: [
      'Intake paperwork: the tag questionnaire-response-type|intake-paperwork is on only recent rows (45 of 3,587 on synth); match ' +
        'paperwork by the canonical instead — questionnaire starts with https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson ' +
        'or …/intake-paperwork-virtual (a |version follows). Screening forms use their own canonicals (phq-9-…, gad-7-…, vanderbilt-…).',
    ],
  },
  {
    resourceType: 'Questionnaire',
    meaning:
      'A form definition (paperwork pages, screening questionnaires). Read live to learn linkIds and question text.',
    fields: ['url, version, name, title, status, item[] tree with linkId / text / type.'],
  },
  {
    resourceType: 'Communication',
    meaning: 'Patient messaging (SMS / portal) and staff notes exchanged about a patient.',
    fields: [
      'status, sent, received, sender, recipient, subject → Patient, payload[].contentString, category, medium.',
    ],
    gaps: ['Searching Communication by "about" is NOT supported by the server; use subject / sender / date.'],
  },
  {
    resourceType: 'RelatedPerson',
    meaning: "A patient's contact or guarantor / policy holder.",
    fields: ['patient → Patient, relationship, name, telecom.'],
  },
  {
    resourceType: 'Schedule',
    meaning: 'Bookable schedule of a Location or Practitioner (hours, capacity live in extensions).',
    fields: [
      'actor[] → Location | Practitioner, active. Opening hours: extension url https://fhir.zapehr.com/r4/StructureDefinitions/schedule, ' +
        'valueString = JSON {"schedule": {"monday": {"open": 8, "close": 20, "workingDay": true, "hours": [{"hour", "capacity"}]}, …}} — JSON.parse it.',
    ],
    search: [
      'Schedule?actor=Location/<id>,… (scoped step from the visits step, path participant.actor.reference, keepType Location).',
    ],
  },
  {
    resourceType: 'Slot',
    meaning: 'A bookable or booked time slot.',
    fields: ['schedule → Schedule, status (free | busy | busy-tentative), start, end, serviceCategory.'],
    search: ['Slot?start=ge{{start}}&start=le{{end}}&status=busy.'],
  },
] as const;

/** The allowlist the plan check enforces: exactly the types the map describes. */
export const ADHOC_DATA_MAP_RESOURCE_TYPES: readonly string[] = ADHOC_DATA_MAP.map((entry) => entry.resourceType);

/** Cross-cutting notes the planner needs that belong to no single resource. */
export const ADHOC_DATA_MAP_NOTES: readonly string[] = [
  'A "visit" = Appointment (tag OTTEHR-IP or OTTEHR-TM) + its Encounter. Start every visit report from three date-bounded ' +
    'steps side by side, each with "elements": Appointment by date, Encounter by appointment.date, Patient by ' +
    '_has:Appointment:patient:date over the same range; then Location / Practitioner as small scoped id lists (see ' +
    'Appointment). Never a list of thousands of ids for a date range; _include / _revinclude on the Appointment step only ' +
    'for small result sets.',
  'Visit status for reports is helpers.visitStatus(appointment, encounter): pending | arrived | intake | ready | ready for provider | ' +
    'provider | discharged | completed | cancelled | no show | awaiting supervisor approval | unknown.',
  'Providers: fetch Practitioners by id from Encounter.participant.individual.reference (scoped step) and keep only name fields; ' +
    'the attending is the participant typed ATND.',
  'Payer mix: Account (by patient) → coverage priority → Coverage → payor Organization name. Self-pay = Coverage.type code in ' +
    '{pay, SELF, 81} or a patient with no active Coverage (type is often blank).',
  'Codes: diagnoses are Conditions referenced from Encounter.diagnosis (helpers.diagnosesOf); E&M and CPT codes are Procedures of the ' +
    'Encounter told apart by meta tag em-code / cpt-code (helpers.proceduresOf); claims carry both again (Claim.item / Claim.diagnosis).',
  'Dates come back as ISO instants in UTC; group by day with helpers.localDay(iso) so days match what the viewer sees in the EHR.',
  '_elements trims what the server returns; name the top-level elements the code reads in "elements". The runner always adds id ' +
    'to that list — a hand-written _elements param must include id itself, or the resources come back without ids and nothing ' +
    'joins. Choice-type fields go by their FHIR base name — value (not valueQuantity), effective (not effectiveDateTime), onset, ' +
    'performed, medication; the typed JSON key is accepted and converted, but the base name is what the server understands.',
  "The server rejects unknown search parameters with an error, which fails that step; the server's answer comes back to you per step — fix the plan rather than repeat the search.",
  'Token searches take system|code written plainly ("code": "http://hl7.org/fhir/sid/icd-10|J02.9"); the plan runner URL-encodes the ' +
    'value. Never ask for _summary=count — a count-only bundle brings no resources back; the step count in the run result is the count.',
  'A report should take about 20 requests at most. A date-bounded step is 1–4 requests (one page, or a probe and one bulk job ' +
    'per 10,000 records); a scoped step is one request per 250 ids — so a scoped step over thousands of ids is the thing to ' +
    'replace with the by-date search of its type. The run result reports requests per step.',
];

/** The data map rendered for the planner prompt. */
export function renderDataMapPrompt(): string {
  const lines: string[] = ["DATA MAP (what Ottehr's FHIR data means; only these resource types can be read):", ''];
  for (const note of ADHOC_DATA_MAP_NOTES) lines.push(`- ${note}`);
  lines.push('');
  for (const entry of ADHOC_DATA_MAP) {
    lines.push(`## ${entry.resourceType}`);
    lines.push(entry.meaning);
    for (const field of entry.fields) lines.push(`  - ${field}`);
    if (entry.links?.length) {
      lines.push('  links:');
      for (const link of entry.links) lines.push(`    - ${link}`);
    }
    if (entry.search?.length) {
      lines.push('  search:');
      for (const search of entry.search) lines.push(`    - ${search}`);
    }
    if (entry.gaps?.length) {
      lines.push('  gaps:');
      for (const gap of entry.gaps) lines.push(`    - ${gap}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
