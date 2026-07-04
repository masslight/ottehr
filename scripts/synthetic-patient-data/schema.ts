/**
 * Synthetic Patient Visit Scenario — Zod schema.
 *
 * Domain-shaped JSON describing one synthetic patient visit. The Stage 2
 * "synthesize-visit" script translates each scenario into the sequence of
 * Ottehr zambda calls documented in OttehrVisitAnatomyZambdas.md.
 *
 * Design rules:
 *   1. Field names mirror zambda input contracts where the mapping is 1:1
 *      (e.g., save-chart-data keys). Otherwise they are domain-shaped.
 *   2. Logical references (medication name, practitioner name, location name)
 *      are used in place of FHIR IDs. Stage 2 resolves them at runtime.
 *   3. The scenario does NOT carry data that templates supply (CC, HPI, ROS,
 *      exam, MDM, diagnoses, CPT, E&M, instructions) when `template.name` is
 *      set — those fields belong on the template.
 *   4. Required at the top level: patient, visit. Everything else is optional;
 *      a minimal scenario should be ~15 lines.
 *
 * Source of truth for what data Stage 2 needs. Update when zambda input
 * contracts change, new zambdas are added to the pipeline, or new clinical
 * features need representation.
 */
import { followUpInOptions, OTHER_SPECIALTY_TRANSFER_OPTION, specialtyTransferOptions } from 'utils';
import { z } from 'zod';

// ── Primitives ────────────────────────────────────────────────────────────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be ISO date YYYY-MM-DD')
  .describe('ISO date, e.g. 2026-04-25');

const isoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/, 'must be ISO date-time')
  .describe('ISO date-time, e.g. 2026-04-25T14:30:00Z');

const usStateCode = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/)
  .describe('Two-letter US state postal code, e.g. NY');

const sexCode = z.enum(['male', 'female', 'other', 'unknown']).describe('FHIR PersonSex code');

// ── Patient ───────────────────────────────────────────────────────────────────

const AddressSchema = z
  .object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: usStateCode,
    postalCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  })
  .describe('US mailing address');

const InsurancePlanSchema = z
  .object({
    carrier: z.string().describe('Payer / carrier name, e.g. "Blue Cross Blue Shield"'),
    memberId: z.string(),
    groupNumber: z.string().optional(),
    planName: z.string().optional().describe('e.g. "PPO Gold 1500"'),
    subscriberRelationship: z.enum(['self', 'spouse', 'child', 'other']).optional(),
    subscriberName: z.string().optional().describe('Required if relationship is not "self"'),
    subscriberDob: isoDate
      .optional()
      .describe(
        'Subscriber date of birth — REQUIRED by the harvest when subscriberRelationship is not "self", or no Coverage gets created.'
      ),
    subscriberSex: z
      .enum(['Male', 'Female', 'Intersex'])
      .optional()
      .describe(
        'Subscriber birth sex — REQUIRED by the harvest when subscriberRelationship is not "self", or no Coverage gets created.'
      ),
  })
  .describe('A single insurance plan (primary or secondary)');

const FixturesSchema = z
  .object({
    idCardFront: z
      .string()
      .optional()
      .describe(
        'Path to photo ID front image, relative to scenario file. Uploaded to Z3 and attached to the photo-id-page in the intake QR.'
      ),
    idCardBack: z.string().optional().describe('Path to photo ID back image.'),
    insuranceCardFront: z
      .string()
      .optional()
      .describe(
        'Path to insurance card front image. Uploaded to Z3 and attached to payment-option-page.insurance-card-front.'
      ),
    insuranceCardBack: z.string().optional(),
    consentSignature: z.string().optional().describe('Patient signature image path'),
  })
  .describe('Binary fixture paths uploaded to Z3 by Stage 2');

const EmergencyContactSchema = z
  .object({
    relationship: z.string().describe('e.g. "Parent", "Spouse", "Sibling", "Friend"'),
    firstName: z.string(),
    middleName: z.string().optional(),
    lastName: z.string(),
    phone: z.string().describe('US 10-digit or formatted'),
    addressAsPatient: z.boolean().optional().describe('If true, emergency contact reuses patient address'),
    address: AddressSchema.optional(),
  })
  .describe('Emergency contact captured on the intake emergency-contact-page');

const ResponsiblePartySchema = z
  .object({
    relationship: z.enum(['Self', 'Parent', 'Spouse', 'Other', 'Legal Guardian']).default('Self'),
    firstName: z.string().optional().describe('Only used when relationship !== "Self"'),
    lastName: z.string().optional(),
    middleName: z.string().optional(),
    dateOfBirth: isoDate.optional(),
    sex: z.enum(['Male', 'Female', 'Other', 'Unknown']).optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    addressAsPatient: z.boolean().optional().describe('If true, responsible-party reuses patient address'),
    address: AddressSchema.optional(),
  })
  .describe('Responsible party for billing — defaults to "Self" with patient demographics');

const ConsentsSchema = z
  .object({
    hipaa: z.boolean().default(true).describe('HIPAA acknowledgement'),
    treat: z.boolean().default(true).describe('Consent to treat'),
    signatureName: z.string().optional().describe('Name typed/drawn for signature; defaults to patient first+last'),
    signerRelationship: z
      .enum(['Self', 'Parent/Legal Guardian', 'Other'])
      .default('Self')
      .describe('Who signed the consent forms'),
  })
  .describe(
    'Captured on the intake consent-forms-page; defaults are sane and harvest produces Consent + DocumentReference resources'
  );

const PrimaryCarePhysicianSchema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    practice: z.string().optional(),
    address: z.string().optional().describe('Free-text address line'),
    phone: z.string().optional(),
  })
  .describe('Optional PCP captured on the intake primary-care-physician-page');

const PreferredPharmacySchema = z
  .object({
    name: z.string(),
    address: z.string().describe('Free-text address line'),
  })
  .describe('Optional preferred pharmacy captured on the intake pharmacy-page');

const PatientSchema = z
  .object({
    firstName: z.string(),
    middleName: z.string().optional(),
    lastName: z.string(),
    dateOfBirth: isoDate,
    sex: sexCode,
    email: z.string().email().optional(),
    phoneNumber: z.string().optional().describe('E.164 or US 10-digit'),
    address: AddressSchema.optional(),
    // Demographics captured on the intake patient-details-page (harvested into Patient).
    race: z.string().optional().describe('e.g. "White", "Black or African American", "Asian", "Decline to answer"'),
    ethnicity: z.string().optional().describe('"Hispanic or Latino", "Not Hispanic or Latino", "Decline to answer"'),
    pronouns: z.string().optional().describe('e.g. "He/him", "She/her", "They/them"'),
    preferredLanguage: z.string().optional().describe('e.g. "English", "Spanish"'),
    pointOfDiscovery: z.string().optional().describe('How patient heard about us'),
    preferredCommunication: z.enum(['Cell Phone', 'Email']).optional(),
    mobileOptIn: z.boolean().optional().describe('Defaults to true'),
    // Registration data captured by the intake QR (see Phase 1.5 in the synthesizer).
    primaryCarePhysician: PrimaryCarePhysicianSchema.optional(),
    preferredPharmacy: PreferredPharmacySchema.optional(),
    responsibleParty: ResponsiblePartySchema.optional().describe(
      'Defaults to "Self" — patient is their own responsible party'
    ),
    emergencyContact: EmergencyContactSchema.optional().describe(
      'Strongly recommended — leaves the EHR Visit Details emergency contact section blank if omitted'
    ),
    consents: ConsentsSchema.optional().describe('Defaults to all-true with signature derived from patient name'),
    insurance: z
      .object({
        primary: InsurancePlanSchema,
        secondary: InsurancePlanSchema.optional(),
      })
      .optional(),
    fixtures: FixturesSchema.optional(),
  })
  .describe('Patient demographics, insurance, and registration data harvested via the intake QR');

// ── Visit ─────────────────────────────────────────────────────────────────────

const VisitSchema = z
  .object({
    type: z.enum(['in-person', 'telemed']).describe('Maps to Ottehr ExamType'),
    date: isoDate.describe('Appointment date'),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'must be HH:MM')
      .optional()
      .describe('Appointment time-of-day; Stage 2 finds or creates a Slot at this time'),
    reasonForVisit: z
      .string()
      .max(500)
      .describe(
        'Patient-stated reason. The EHR splits this on " - " (separator); the part before is validated against ' +
          "the booking-config reason-for-visit options for the visit's service category (e.g., for urgent care: " +
          '"Throat pain", "Fever", "Cough and/or congestion", … — see BOOKING_CONFIG.serviceCategories[].reasonsForVisit ' +
          'in packages/utils). The part after the separator is free-text additional detail. Example: ' +
          '"Throat pain - × 3 days". An unrecognized leading value renders as the literal string "undefined" on the ' +
          'visit-detail page.'
      ),
    locationName: z.string().describe('Logical location name; Stage 2 resolves to FHIR Location ID'),
    locationState: usStateCode
      .optional()
      .describe('Required for telemed visits if Stage 2 cannot derive it from the location'),
    language: z.enum(['en', 'es']).optional(),
    targetStatus: z
      .enum(['pending', 'arrived', 'ready', 'intake', 'ready for provider', 'provider', 'discharged', 'completed'])
      .optional()
      .default('completed')
      .describe(
        'How far the EHR visit-status lifecycle should walk. Defaults to "completed" (full walk + sign-off, ' +
          'visit ends APPOINTMENT_LOCKED). Earlier targets stop the Phase 13 status walk at the named state and ' +
          'skip Phase 14 sign-off, leaving the visit unlocked. ' +
          'IMPORTANT: clinical phases (chart data, template, orders, eligibility, etc.) ALWAYS run regardless of ' +
          'targetStatus — the chart can be fully populated even on early-lifecycle visits, just like in the real ' +
          'EHR where intake nurses enter vitals while the provider is still away. The target only controls the ' +
          'dashboard tab the visit lands in (preBooked / waitingRoom / inExam / checkedOut), not the chart contents.'
      ),
  })
  .describe('Visit metadata; Stage 2 uses date+time+location to resolve the slot');

// ── Template reference ────────────────────────────────────────────────────────

const TemplateSchema = z
  .object({
    name: z.string().describe('Global template name. Stage 2 calls list-templates to verify it exists.'),
    examType: z.enum(['inPerson', 'telemed']).optional().describe('Defaults to derived from visit.type'),
  })
  .describe(
    'Reference to a global template. When set, the scenario should NOT carry CC/HPI/ROS/exam/MDM/diagnoses/CPT/E&M/instructions — the template supplies those.'
  );

// ── Clinical history ──────────────────────────────────────────────────────────

const AllergyEntrySchema = z
  .object({
    name: z.string().describe('Allergen name, e.g. "Penicillin"'),
    severity: z.enum(['mild', 'moderate', 'severe']).optional(),
    reaction: z.string().optional().describe('Free-text, e.g. "hives", "anaphylaxis"'),
    current: z
      .boolean()
      .optional()
      .describe('Defaults to true if omitted; set false only when narrative says the allergy resolved.'),
    note: z.string().optional(),
  })
  .describe('Maps to save-chart-data.allergies[]');

const MedicationEntrySchema = z
  .object({
    name: z.string().describe('Medication name, e.g. "lisinopril 10mg daily"'),
    status: z.enum(['active', 'completed']).default('active'),
    dose: z.string().optional(),
    frequency: z.string().optional(),
    route: z.string().optional(),
  })
  .describe('Maps to save-chart-data.medications[]');

const ConditionEntrySchema = z
  .object({
    code: z.string().optional().describe('ICD-10 code if known'),
    display: z.string().describe('Human-readable condition name'),
    current: z.boolean().optional(),
    note: z.string().optional(),
  })
  .describe('Past medical history; maps to save-chart-data.conditions[]');

const SurgicalEntrySchema = z
  .object({
    code: z.string().optional().describe('CPT code, if known'),
    display: z.string(),
    modifier: z.string().optional(),
  })
  .describe('Maps to save-chart-data.surgicalHistory[]');

const AccidentSchema = z
  .object({
    type: z.array(z.string()).describe('e.g. ["auto-accident"], ["work-related"]'),
    state: usStateCode.optional().describe('State where the accident occurred'),
    date: isoDate.optional(),
    description: z.string().optional(),
  })
  .describe('Maps to save-chart-data.accident; presence implies the visit is accident-related');

const HospitalizationEntrySchema = z
  .object({
    code: z
      .string()
      .optional()
      .describe(
        'SNOMED code from the EHR hospitalization picklist (e.g. "233604007" for Pneumonia). Free-text is not allowed; use code "OTH" with display "Other" if no match exists.'
      ),
    display: z
      .string()
      .describe('Picklist label only — e.g. "Pneumonia". Date / context belongs in `note`, not in `display`.'),
    note: z
      .string()
      .optional()
      .describe('Free-text detail like the year hospitalized; goes in the hospitalization note field, not in display.'),
  })
  .describe('Maps to save-chart-data.episodeOfCare[]');

const BirthHistoryEntrySchema = z
  .object({
    field: z.enum(['age', 'weight', 'length', 'preg-compl', 'del-compl']),
    value: z.union([z.string(), z.number()]).optional(),
    flag: z.string().optional(),
    note: z.string().optional(),
  })
  .describe('Maps to save-chart-data.birthHistory[] — pediatric only');

const ScreeningObservationSchema = z
  .object({
    field: z.string().describe('e.g. "tobacco-use", "alcohol-use"'),
    value: z.union([z.boolean(), z.string(), z.number()]),
  })
  .describe('Maps to save-chart-data.observations[]');

const ScreenNoteSchema = z
  .object({
    code: z.enum([
      'allergy',
      'medication',
      'medical-condition',
      'hospitalization',
      'intake',
      'vitals',
      'screening',
      'internal',
    ]),
    text: z.string(),
  })
  .describe('Free-text "Notes" field at the bottom of various screens; maps to save-chart-data.notes[]');

const HistorySchema = z
  .object({
    allergies: z.array(AllergyEntrySchema).optional(),
    medications: z.array(MedicationEntrySchema).optional(),
    conditions: z.array(ConditionEntrySchema).optional(),
    surgicalHistory: z.array(SurgicalEntrySchema).optional(),
    surgicalHistoryNote: z.string().optional(),
    hospitalizations: z.array(HospitalizationEntrySchema).optional(),
    birthHistory: z.array(BirthHistoryEntrySchema).optional(),
    accident: AccidentSchema.optional(),
    screening: z.array(ScreeningObservationSchema).optional(),
    screenNotes: z.array(ScreenNoteSchema).optional().describe('Per-screen free-text notes (css-note)'),
  })
  .describe('Clinical history; each key maps to a save-chart-data key of the same name (or close)');

// ── Vitals ────────────────────────────────────────────────────────────────────

const VitalReadingNumeric = z.object({
  value: z.number(),
  flag: z.enum(['low', 'high', 'critical']).optional(),
});
const VitalReadingWithUnit = VitalReadingNumeric.extend({ unit: z.string().optional() });

const VitalsSchema = z
  .object({
    temperature: VitalReadingWithUnit.optional().describe('°F default'),
    heartRate: VitalReadingNumeric.optional().describe('bpm'),
    bloodPressure: z
      .object({
        systolic: z.number(),
        diastolic: z.number(),
        flag: z.enum(['low', 'high', 'critical']).optional(),
      })
      .optional(),
    respirationRate: VitalReadingNumeric.optional().describe('breaths/min'),
    oxygenSaturation: VitalReadingNumeric.optional().describe('% SpO2'),
    weight: VitalReadingWithUnit.optional().describe('lb or kg'),
    height: VitalReadingWithUnit.optional().describe('in or cm'),
    visionLeft: z.string().optional().describe('e.g. "20/20"'),
    visionRight: z.string().optional(),
    lmp: isoDate.optional().describe('Last menstrual period'),
  })
  .describe('Maps to save-chart-data.vitalsObservations');

// ── Modules: orders & ancillary services ─────────────────────────────────────

const InHouseLabOrderSchema = z
  .object({
    testName: z.string().describe('Logical test name; Stage 2 resolves to ActivityDefinition'),
    diagnoses: z
      .array(z.object({ code: z.string(), display: z.string(), isPrimary: z.boolean().optional() }))
      .min(1)
      .describe('At least one ICD-10 diagnosis; Stage 2 splits into diagnosesAll/diagnosesNew'),
    notes: z.string().optional(),
    results: z
      .array(
        z.object({
          analyte: z.string(),
          value: z.union([z.string(), z.number()]),
          unit: z.string().optional(),
          flag: z.enum(['normal', 'abnormal', 'critical']).optional(),
        })
      )
      .optional()
      .describe('If set, Stage 2 walks order through specimen-collected and results-final'),
  })
  .describe('Maps to create-in-house-lab-order + collect + handle-results');

const InHouseMedicationOrderSchema = z
  .object({
    medicationName: z.string().describe('Stage 2 resolves to medication formulary item'),
    dose: z.string(),
    units: z.string(),
    route: z.string(),
    administered: z.boolean().optional().default(false),
    effectiveDateTime: isoDateTime.optional().describe('Required if administered=true'),
  })
  .describe('Maps to create-update-medication-order');

const RadiologyOrderSchema = z
  .object({
    studyName: z.string().optional(),
    cptCode: z.string().describe('CPT code; validated against terminology service'),
    diagnosisCode: z.string().describe('ICD-10 code; validated against terminology service'),
    stat: z.boolean().default(false),
    clinicalHistory: z.string().max(255),
    consentObtained: z.boolean().default(true),
    lateralityModifier: z.object({ code: z.string(), display: z.string() }).optional(),
    preliminaryReport: z.string().optional().describe('If set, Stage 2 calls save-preliminary-report'),
  })
  .describe('Maps to radiology/create-order');

const ImmunizationOrderSchema = z
  .object({
    vaccineName: z.string().describe('Stage 2 resolves to medication formulary item'),
    dose: z.string(),
    units: z.string(),
    route: z.string().optional(),
    location: z
      .object({ name: z.string(), code: z.string() })
      .optional()
      .describe('Anatomic site, e.g. { name: "left deltoid", code: "LD" }'),
    instructions: z.string().optional(),
    administered: z.boolean().default(false),
  })
  .describe('Maps to immunization/create-update-order + administer-order');

const ProcedureEntrySchema = z
  .object({
    procedureType: z.string().describe('e.g. "throat-swab-collection"'),
    occurrenceDateTime: isoDateTime,
    documentedDateTime: isoDateTime.optional(),
    performerType: z.enum(['Healthcare staff', 'Provider', 'Both']).default('Provider'),
    bodySite: z.enum(['Head', 'Face', 'Arm', 'Leg', 'Torso', 'Genital', 'Ear', 'Nose', 'Eye', 'Other']).optional(),
    technique: z
      .array(z.enum(['Sterile', 'Clean', 'Aseptic', 'Field']))
      .optional()
      .describe('Asepsis technique only — NOT the procedure motion. Throat swab → "Clean".'),
    suppliesUsed: z.string().optional(),
    procedureDetails: z.string().describe('Free-text description'),
    specimenSent: z.boolean().optional(),
    complications: z.enum(['None', 'Bleeding', 'Incomplete Removal', 'Allergic Reaction', 'Other']).default('None'),
    patientResponse: z
      .enum(['Tolerated Well', 'Mild Distress', 'Severe Distress', 'Improved', 'Stable', 'Worsened'])
      .default('Tolerated Well'),
    timeSpent: z
      .enum(['< 5 min', '5-10 min', '10-20 min', '20-30 min', '> 30 min'])
      .optional()
      .describe('Time bucket only; do not write free-text minute counts.'),
    documentedBy: z.enum(['Provider', 'Healthcare staff']).default('Provider'),
    consentObtained: z.boolean().default(true),
    cptCode: z
      .string()
      .optional()
      .describe('CPT code linked to this procedure; Stage 2 resolves to template-created CPT Procedure id'),
    diagnosisCode: z
      .string()
      .optional()
      .describe('ICD-10 linked to this procedure; Stage 2 resolves to template-created Condition id'),
  })
  .describe('Maps to save-chart-data.procedures[] (a ServiceRequest with up to 12 extensions)');

const ModulesSchema = z
  .object({
    inHouseLabs: z.array(InHouseLabOrderSchema).optional(),
    inHouseMedications: z.array(InHouseMedicationOrderSchema).optional(),
    radiology: z.array(RadiologyOrderSchema).optional(),
    immunizations: z.array(ImmunizationOrderSchema).optional(),
    procedures: z.array(ProcedureEntrySchema).optional(),
  })
  .describe('Module-specific orders; each maps to its own zambda or save-chart-data key');

// ── Eligibility (Candid raw-response format) ─────────────────────────────────

const EligibilityCptScenarioSchema = z
  .object({
    cpt: z.string().describe('CPT code from pricing.cptPrices'),
    serviceType: z.string().describe('X12 service-type code, e.g. "UC" (urgent care), "OV", "5", "73", "BG"'),
    inNetwork: z.boolean(),
    allowedAmount: z.number().describe('Negotiated allowed amount'),
    patientResponsibility: z.number(),
    insuranceResponsibility: z.number(),
    note: z.string().optional(),
  })
  .describe('Per-CPT eligibility breakdown for the demo eligibility widget');

const EligibilitySchema = z
  .object({
    plan: z.string().describe('Plan label, e.g. "BCBS PPO Gold"'),
    coverageActive: z.boolean().default(true),
    deductible: z
      .object({
        individual: z.number(),
        family: z.number().optional(),
        met: z.number().describe('Amount of individual deductible already met'),
      })
      .optional(),
    outOfPocketMax: z.object({ individual: z.number(), family: z.number().optional() }).optional(),
    copays: z
      .object({
        officeVisit: z.number().optional(),
        urgentCare: z.number().optional(),
        emergencyRoom: z.number().optional(),
        specialist: z.number().optional(),
      })
      .optional(),
    coinsurancePercent: z.number().min(0).max(100).optional(),
    inNetwork: z.boolean().default(true),
    cptScenarios: z
      .array(EligibilityCptScenarioSchema)
      .optional()
      .describe('Per-CPT breakdown rendered by CopayWidget when service code matches'),
  })
  .describe('Eligibility data; Stage 2 builds a Candid-format CoverageEligibilityResponse');

// ── Pricing (charge master + fee schedule) ───────────────────────────────────

const CptPriceEntrySchema = z
  .object({
    cpt: z.string(),
    chargedAmount: z.number().describe('Project charge master price'),
    allowedAmount: z.number().describe('Payer-negotiated fee schedule allowed amount'),
  })
  .describe('Pricing pair: what the project bills vs. what the payer allows');

const PricingSchema = z
  .object({
    feeScheduleName: z.string().optional().describe('e.g. payer plan name'),
    cptPrices: z.array(CptPriceEntrySchema).optional(),
  })
  .describe('Charge master and fee schedule entries; Stage 2 ensures both exist for each CPT');

// ── Notes & education ────────────────────────────────────────────────────────

const AppointmentNoteSchema = z
  .object({
    text: z.string(),
    authorName: z.string().optional(),
  })
  .describe('Maps to Communication on the appointment');

const PatientEducationDocSchema = z
  .object({
    topic: z.string().describe('e.g. "strep throat"'),
    title: z.string().optional(),
    url: z.string().url().optional().describe('External MedlinePlus or vendor URL'),
  })
  .describe('Patient education materials attached to the encounter');

const NotesSchema = z
  .object({
    appointmentNotes: z.array(AppointmentNoteSchema).optional(),
    patientEducationDocs: z.array(PatientEducationDocSchema).optional(),
  })
  .describe('Polish for demo realism — appointment notes, patient ed handouts');

// ── Disposition ───────────────────────────────────────────────────────────────
//
// Constrained to EXACTLY what a clinician can produce through the EHR's
// Disposition card. The card exposes four selectable tabs
// (apps/ehr/src/features/visits/shared/components/DispositionCard.tsx) and each
// tab renders a fixed field set (dispositionFieldsPerType in
// apps/ehr/src/features/visits/telemed/utils/disposition.helper.ts):
//
//   pcp-no-type → followUpIn
//   another     → reason
//   ed          → nothingToEatOrDrink, refusalOfEmsTransport
//   specialty   → specialty (+ specialtyOther when "Other"), followUpIn
//
// The legacy DispositionType values ('pcp', 'ip', 'ip-lab', 'ip-oth') and the
// subspecialty followUp[] checkboxes (dentistry/ent/…/lurie-ct sub-follow-up
// ServiceRequests) are NOT reachable from any tab, so synthetic data must not
// emit them — a specialty referral is expressed as type 'specialty' + the
// `specialty` dropdown value instead.

// Mirrors reasonsForTransferOptions in
// apps/ehr/src/features/visits/telemed/utils/disposition.helper.ts (the EHR app
// isn't importable from scripts, so the three options are restated here).
const REASONS_FOR_TRANSFER = ['Equipment availability', 'Procedure or advanced care', 'Xray'] as const;

// The EHR "Follow up visit in" dropdown accepts ONLY these values
// (followUpInOptions in utils): 0 = "as needed", 1-5 days, 7 = 1 week, 14 = 2 weeks.
const FOLLOW_UP_IN_DAYS: readonly number[] = followUpInOptions.map((o) => o.value);

const DispositionSchema = z
  .object({
    type: z
      .enum(['pcp-no-type', 'another', 'ed', 'specialty'])
      .describe(
        'Discharge type — must be one of the four EHR Disposition tabs: "pcp-no-type" (routine discharge home ' +
          'with PCP follow-up), "another" (transfer to another location), "ed" (ED transfer), ' +
          '"specialty" (outpatient specialty referral/transfer).'
      ),
    note: z
      .string()
      .optional()
      .describe('Disposition note shown on the visit note; defaults to "N/A" exactly like the EHR.'),
    followUpIn: z
      .number()
      .optional()
      .describe(
        'Days until PCP/visit follow-up — only for type "pcp-no-type" or "specialty", and only one of the EHR ' +
          'dropdown values: 1, 2, 3, 4, 5, 7 (1 week), 14 (2 weeks), or 0 ("as needed").'
      ),
    reason: z.enum(REASONS_FOR_TRANSFER).optional().describe('Reason for transfer — only for type "another".'),
    specialty: z
      .enum(specialtyTransferOptions as [string, ...string[]])
      .optional()
      .describe(
        'Specialty the patient is referred to — only for type "specialty". For a specialty not in the list ' +
          '(e.g. Dentistry), use "Other" plus specialtyOther.'
      ),
    specialtyOther: z.string().optional().describe('Free-text specialty — only when specialty is "Other".'),
    nothingToEatOrDrink: z.boolean().optional().describe('"Nothing to eat or drink" checkbox — only for type "ed".'),
    refusalOfEmsTransport: z.boolean().optional().describe('"Refusal of EMS transport" checkbox — only for type "ed".'),
  })
  // strict: reject legacy fields (`text`, subspecialty `followUp[]`) loudly
  // instead of silently stripping a clinician-intent-bearing referral.
  .strict()
  .superRefine((d, ctx) => {
    // Reject (loudly, at authoring time) any field combination the EHR's
    // Disposition card cannot produce, rather than silently dropping fields.
    const fail = (path: string, message: string): void => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    };
    if (d.followUpIn !== undefined) {
      if (d.type !== 'pcp-no-type' && d.type !== 'specialty') {
        fail('followUpIn', `followUpIn is only available on the "pcp-no-type" and "specialty" tabs, not "${d.type}"`);
      }
      if (!FOLLOW_UP_IN_DAYS.includes(d.followUpIn)) {
        fail('followUpIn', `followUpIn must be one of ${FOLLOW_UP_IN_DAYS.join(', ')} (EHR dropdown options)`);
      }
    }
    if (d.reason !== undefined && d.type !== 'another') {
      fail('reason', `reason is only available on the "another" tab, not "${d.type}"`);
    }
    if (d.specialty !== undefined && d.type !== 'specialty') {
      fail('specialty', `specialty is only available on the "specialty" tab, not "${d.type}"`);
    }
    if (d.specialtyOther !== undefined) {
      if (d.type !== 'specialty') {
        fail('specialtyOther', `specialtyOther is only available on the "specialty" tab, not "${d.type}"`);
      } else if (d.specialty !== OTHER_SPECIALTY_TRANSFER_OPTION) {
        fail('specialtyOther', 'specialtyOther requires specialty to be "Other"');
      }
    }
    if ((d.nothingToEatOrDrink !== undefined || d.refusalOfEmsTransport !== undefined) && d.type !== 'ed') {
      fail('type', `nothingToEatOrDrink/refusalOfEmsTransport are only available on the "ed" tab, not "${d.type}"`);
    }
  })
  .describe('Maps to save-chart-data.disposition — restricted to shapes the EHR Disposition card can create.');

// ── Sign-off ──────────────────────────────────────────────────────────────────

const SignOffSchema = z
  .object({
    practitionerName: z
      .string()
      .optional()
      .describe('Logical name; Stage 2 resolves to Practitioner ID. Defaults to current user.'),
    userRole: z.string().optional().describe('Role label, e.g. "Provider"; Stage 2 builds Coding[]'),
    timezone: z.string().optional().describe('IANA timezone, e.g. "America/New_York"'),
    supervisorApproval: z.boolean().default(false),
    addendumNote: z.string().optional().describe('Note added at or after sign-off'),
    patientInfoConfirmed: z.boolean().default(true).describe('Provider confirmed intake info'),
    complete: z
      .boolean()
      .default(true)
      .describe('If true, Stage 2 walks the visit through to status=completed and signs.'),
  })
  .describe('How Stage 2 finishes the visit');

// ── Provider chart findings (for template-less archetypes) ───────────────────
// Templates supply diagnoses/exam/ROS/MDM; archetypes WITHOUT a template carry
// these explicitly so the note is still complete. All written via save-chart-data
// except prescriptions (a direct eRx-tagged MedicationRequest).
const DiagnosisEntrySchema = z
  .object({
    code: z.string().describe('ICD-10 code, e.g. "S72.142A"'),
    display: z.string().describe('Diagnosis display'),
    isPrimary: z.boolean().optional().describe('Primary diagnosis (defaults false)'),
  })
  .describe('Maps to save-chart-data.diagnosis[] (creates Condition + Encounter.diagnosis link)');
const ExamFindingSchema = z
  .object({
    field: z
      .string()
      .describe('Exam field code, e.g. "soft", "regular-rate-and-rhythm-with-no-murmur", "extremities-comment"'),
    value: z.boolean().optional().describe('Defaults true'),
    note: z.string().optional().describe('Free-text note (for *-comment fields)'),
  })
  .describe('Maps to save-chart-data.examObservations[]');
const RosFindingSchema = z
  .object({
    field: z
      .string()
      .describe(
        'ROS field code INCLUDING state suffix — ROS is structured checkboxes, NOT free text. ' +
          'E.g. "ros-ent-sore-throat-reports" (positive) or "ros-respiratory-cough-denies" (pertinent negative). ' +
          'Item keys: packages/utils/lib/ottehr-config/review-of-systems/in-person.config.ts'
      ),
  })
  .describe('Maps to save-chart-data.rosObservations[]');
const PrescriptionSchema = z
  .object({
    name: z.string().describe('Drug name + strength, e.g. "amoxicillin 500 mg capsule"'),
    sig: z.string().describe('Patient instructions / SIG, e.g. "Take 1 capsule by mouth twice daily for 10 days"'),
  })
  .describe('Discharge prescription → eRx-tagged MedicationRequest');

// ── Top-level scenario ───────────────────────────────────────────────────────

export const VisitScenarioSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    label: z.string().optional().describe('Human-friendly label, e.g. "Jane Doe — sore throat urgent care"'),
    patient: PatientSchema,
    visit: VisitSchema,
    template: TemplateSchema.optional(),
    emCode: z
      .object({
        code: z.string().describe('CPT E&M code, e.g. "99213"'),
        display: z.string().describe('Human-readable description, e.g. "Office visit, established, low complexity"'),
      })
      .optional()
      .describe(
        'Evaluation & Management CPT code billed for the visit. Templates do not carry E&M, so synth must supply it.'
      ),
    history: HistorySchema.optional(),
    vitals: VitalsSchema.optional(),
    // Provider chart findings — used by template-less archetypes (a template
    // otherwise supplies these). Written in Phase 5.5.
    diagnoses: z.array(DiagnosisEntrySchema).optional().describe('Encounter diagnoses when no template supplies them'),
    exam: z.array(ExamFindingSchema).optional().describe('Structured physical exam findings'),
    reviewOfSystems: z
      .array(RosFindingSchema)
      .optional()
      .describe('Structured ROS findings (checkbox items, NOT free text)'),
    medicalDecision: z.string().optional().describe('Medical decision making narrative'),
    prescriptions: z.array(PrescriptionSchema).optional().describe('Discharge prescriptions (eRx)'),
    modules: ModulesSchema.optional(),
    eligibility: EligibilitySchema.optional(),
    pricing: PricingSchema.optional(),
    notes: NotesSchema.optional(),
    disposition: DispositionSchema.optional(),
    signOff: SignOffSchema.optional(),
  })
  .describe('A single synthetic patient visit scenario');

// ── Inferred types ───────────────────────────────────────────────────────────

export type VisitScenario = z.infer<typeof VisitScenarioSchema>;
export type History = z.infer<typeof HistorySchema>;
