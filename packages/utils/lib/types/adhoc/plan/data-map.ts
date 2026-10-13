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
    ],
    links: [
      'Encounter.appointment[0].reference → this Appointment (use _revinclude=Encounter:appointment).',
      '_include=Appointment:patient brings the Patient; _include=Appointment:location the Location.',
    ],
    search: [
      'date=ge{{start}}&date=le{{end}} bounds the scheduled start (both bounds inclusive).',
      'status=booked,arrived,... (comma list). _tag=OTTEHR-IP,OTTEHR-TM.',
      'Typical visit search: Appointment with date range + _tag + _include patient + _include location + ' +
        '_revinclude Encounter:appointment (+ _revinclude:iterate=Encounter:part-of for follow-up encounters).',
    ],
    gaps: [
      'Long ranges are slow: the server limits the query run time, so prefer mode "bulk" (or let auto decide) for more than ~2 weeks of visits.',
    ],
  },
  {
    resourceType: 'Encounter',
    meaning:
      'The clinical side of a visit: who saw the patient, the status timeline, the diagnoses. One per Appointment; ' +
      'a follow-up note is an extra Encounter with partOf → the visit Encounter (type coding SNOMED 390906007).',
    fields: [
      'status: planned | arrived | in-progress | finished | cancelled. period.start/end: actual visit times.',
      'statusHistory[]: {status, period} — the timeline the visit went through; helpers.visitStatusHistory(encounter, appointment) ' +
        'turns it into Ottehr visit statuses (pending, arrived, intake, ready for provider, provider, discharged, completed…) ' +
        'with periods. Wait = minutes in "arrived" + "ready" before intake; length of stay = helpers.visitTotalMinutes.',
      'participant[]: type coding ATND = attending provider, ADM = admitter (intake staff); individual.reference = ' +
        'Practitioner/<id>; period.start/end = when they started / finished with the patient. helpers.attendingId(encounter).',
      'diagnosis[].condition.reference → Condition/<id> (the visit diagnoses; rank 1 = primary).',
      'subject.reference → Patient/<id>. appointment[0].reference → Appointment/<id>. partOf → parent Encounter (follow-ups).',
      'helpers.encounterVisitType(encounter): "main" | "follow-up" | "scheduled-follow-up".',
    ],
    links: [
      'Condition by _id from diagnosis[].condition.reference (scoped step, keepType Condition).',
      'Practitioner by _id from participant.individual.reference (scoped step, keepType Practitioner).',
      'Procedure?encounter=Encounter/<id>, DocumentReference?encounter=…, ServiceRequest?encounter=…, ' +
        'Observation?encounter=…, QuestionnaireResponse?encounter=…, PaymentNotice?request=Encounter/<id>.',
    ],
  },
  {
    resourceType: 'Patient',
    meaning: 'A patient. Demographics only — the chart lists hang off the patient as tagged resources.',
    fields: [
      'name[0].given/family (helpers.fullName), birthDate (yyyy-MM-dd; helpers.ageAt), gender.',
      'address[0].city/state/postalCode, telecom (phone/email). Extensions carry race, ethnicity, preferred language.',
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
    fields: ['name, address.state/city, identifier (slug), extension (timezone, hours).'],
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
      'A diagnosis (ICD-10-CM) — of a visit when referenced from Encounter.diagnosis; a problem-list entry when tagged medical-condition.',
    fields: [
      'code.coding[] with system http://hl7.org/fhir/sid/icd-10-cm: code + display. ICD-10 is hierarchical — match families by prefix.',
      'encounter.reference, subject.reference, clinicalStatus, onsetDateTime.',
    ],
  },
  {
    resourceType: 'Procedure',
    meaning:
      'A CPT-coded service of a visit (E&M and procedure codes), or surgical history when tagged surgical-history.',
    fields: [
      'code.coding[] with system http://www.ama-assn.org/go/cpt: code + display. CPT is NOT hierarchical — never prefix-match.',
      'encounter.reference, subject.reference, performedDateTime, status.',
    ],
    search: [
      'Procedure?encounter=Encounter/<id>,Encounter/<id>,… (scoped step from an Encounter step, path "id", keepType Encounter).',
    ],
  },
  {
    resourceType: 'Coverage',
    meaning:
      "An insurance coverage of a patient. Primary / secondary is the Account's coverage order, not Coverage.order alone.",
    fields: [
      'beneficiary → Patient; payor[0] → Organization (the payer); class[] type "plan" name = plan name; type.coding (self-pay codes: pay, SELF, 81).',
      'status active | cancelled; period; subscriberId.',
    ],
    links: ['Organization by _id from payor.reference (keepType Organization) for payer names.'],
  },
  {
    resourceType: 'Account',
    meaning: "A patient's billing account: which coverages apply and in which order.",
    fields: ['subject[0] → Patient; coverage[]: {coverage → Coverage, priority 1 = primary}; status; type.'],
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
    meaning: 'A patient invoice (self-pay balance).',
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
    meaning: 'Work items (follow-ups, lab/radiology review, billing, messages). Code tells the kind.',
    fields: [
      'code.coding (system/code = kind of task), status (requested | in-progress | completed | cancelled | failed), ' +
        'businessStatus.text, authoredOn (created), lastModified, executionPeriod.end (completed at), owner → Practitioner, ' +
        'for → Patient, focus → the resource it is about, intent.',
    ],
    search: ['Task?authored-on=ge{{start}}&authored-on=le{{end}}; status=…; code=<system>|<code>.'],
    gaps: [
      'Code systems vary by feature; discover them with inspect_data on code.coding.system / code before filtering.',
    ],
  },
  {
    resourceType: 'ServiceRequest',
    meaning: 'An order: lab (in-house or external), radiology, or a referral.',
    fields: [
      'code.coding (test / study), category (lab vs radiology), status, authoredOn, requester → Practitioner, encounter, subject, ' +
        'performer → Organization (lab). orderDetail / extensions carry Ottehr order details.',
    ],
    search: ['ServiceRequest?encounter=… (scoped) or ServiceRequest?authored=ge{{start}}&authored=le{{end}}.'],
  },
  {
    resourceType: 'DiagnosticReport',
    meaning: 'Lab or radiology results for an order.',
    fields: [
      'basedOn → ServiceRequest, status (preliminary | final | corrected), code, issued, result[] → Observation, conclusion.',
    ],
  },
  {
    resourceType: 'Observation',
    meaning: 'Vitals (category vital-signs), lab result values, exam/ROS findings and other structured chart data.',
    fields: [
      'code.coding (LOINC or Ottehr codes), valueQuantity.value/unit | valueString | valueCodeableConcept, ' +
        'effectiveDateTime, encounter, subject, category[].coding.code (vital-signs …), interpretation.',
    ],
    gaps: ['Never search Observation without an encounter, patient or date filter — the table is huge.'],
  },
  {
    resourceType: 'MedicationRequest',
    meaning: 'A prescription (eRx, tagged erx-medication) or an in-house medication order.',
    fields: [
      'medicationCodeableConcept, status, authoredOn, requester → Practitioner, encounter, subject, dosageInstruction.',
    ],
    search: ['MedicationRequest?encounter=…&_tag=erx-medication for prescriptions.'],
  },
  {
    resourceType: 'MedicationAdministration',
    meaning: 'An in-house medication given (or ordered to be given) during a visit.',
    fields: [
      'medicationCodeableConcept, status, effectiveDateTime, context → Encounter, performer → Practitioner, request → MedicationRequest, reasonReference → Condition.',
    ],
    search: ['MedicationAdministration?context=Encounter/<id>,… (+ _include=MedicationAdministration:performer).'],
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
      'QuestionnaireResponse?encounter=… (scoped) or ?authored=ge{{start}}&authored=le{{end}}&status=completed.',
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
    fields: ['actor[] → Location | Practitioner, active, extension (schedule JSON).'],
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
  'A "visit" = Appointment (tag OTTEHR-IP or OTTEHR-TM) + its Encounter. Start every visit report from an Appointment ' +
    'step over the date range with _revinclude=Encounter:appointment, _include=Appointment:patient and _include=Appointment:location.',
  'Visit status for reports is helpers.visitStatus(appointment, encounter): pending | arrived | intake | ready | ready for provider | ' +
    'provider | discharged | completed | cancelled | no show | awaiting supervisor approval | unknown.',
  'Providers: fetch Practitioners by id from Encounter.participant.individual.reference (scoped step) and keep only name fields; ' +
    'the attending is the participant typed ATND.',
  'Payer mix: Account (by patient) → coverage priority → Coverage → payor Organization name. Self-pay = Coverage.type code in ' +
    '{pay, SELF, 81} or a patient with no active Coverage.',
  'Codes: diagnoses are Conditions referenced from Encounter.diagnosis; CPT codes are Procedures of the Encounter; ' +
    'claims carry both again (Claim.item / Claim.diagnosis).',
  'Dates come back as ISO instants in UTC; group by day with helpers.localDay(iso) so days match what the viewer sees in the EHR.',
  '_elements trims what the server returns: id, resourceType and meta always come back; name the top-level elements the code reads.',
  'The server rejects unknown search parameters with an error; the run_report / run_fetch result shows the error per step — read it and re-plan.',
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
