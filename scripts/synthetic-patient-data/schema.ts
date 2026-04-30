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
    subscriberDob: isoDate.optional(),
  })
  .describe('A single insurance plan (primary or secondary)');

const FixturesSchema = z
  .object({
    idCardFront: z.string().optional().describe('Path relative to scenario file'),
    idCardBack: z.string().optional(),
    insuranceCardFront: z.string().optional(),
    insuranceCardBack: z.string().optional(),
    consentSignature: z.string().optional().describe('Patient signature image path'),
  })
  .describe('Binary fixture paths uploaded to Z3 by Stage 2');

const PatientSchema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    dateOfBirth: isoDate,
    sex: sexCode,
    email: z.string().email().optional(),
    phoneNumber: z.string().optional().describe('E.164 or US 10-digit'),
    address: AddressSchema.optional(),
    insurance: z
      .object({
        primary: InsurancePlanSchema,
        secondary: InsurancePlanSchema.optional(),
      })
      .optional(),
    fixtures: FixturesSchema.optional(),
  })
  .describe('Patient demographics, insurance, and fixture references');

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
    reasonForVisit: z.string().max(500).describe('Patient-stated reason; max 500 chars'),
    locationName: z.string().describe('Logical location name; Stage 2 resolves to FHIR Location ID'),
    locationState: usStateCode
      .optional()
      .describe('Required for telemed visits if Stage 2 cannot derive it from the location'),
    language: z.enum(['en', 'es']).optional(),
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
    code: z.string().optional().describe('ICD-10 if known'),
    display: z.string().describe('e.g. "Pneumonia, hospitalized 2023"'),
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
    performerType: z.string().default('Provider'),
    bodySite: z.string().optional().describe('e.g. "pharynx"'),
    technique: z.array(z.string()).optional().describe('e.g. ["swabbing"]'),
    suppliesUsed: z.string().optional(),
    procedureDetails: z.string().describe('Free-text description'),
    specimenSent: z.boolean().optional(),
    complications: z.string().default('None'),
    patientResponse: z.string().default('Tolerated procedure well'),
    timeSpent: z.string().optional().describe('e.g. "2 minutes"'),
    documentedBy: z.string().default('Provider'),
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

const FollowUpSchema = z
  .object({
    type: z.string().describe('e.g. "primary-care", "specialty"'),
    note: z.string().optional(),
    daysOut: z.number().optional().describe('Follow-up window in days'),
  })
  .describe('Maps to disposition.followUp[]');

const DispositionSchema = z
  .object({
    type: z.string().describe('e.g. "home", "transfer", "specialty"'),
    text: z.string().optional(),
    note: z.string().optional(),
    followUp: z.array(FollowUpSchema).optional(),
  })
  .describe('Maps to save-chart-data.disposition');

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

// ── Top-level scenario ───────────────────────────────────────────────────────

export const VisitScenarioSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    label: z.string().optional().describe('Human-friendly label, e.g. "Jane Doe — sore throat urgent care"'),
    patient: PatientSchema,
    visit: VisitSchema,
    template: TemplateSchema.optional(),
    history: HistorySchema.optional(),
    vitals: VitalsSchema.optional(),
    modules: ModulesSchema.optional(),
    eligibility: EligibilitySchema.optional(),
    pricing: PricingSchema.optional(),
    notes: NotesSchema.optional(),
    disposition: DispositionSchema.optional(),
    signOff: SignOffSchema.optional(),
  })
  .describe('A single synthetic patient visit scenario');

export const VisitScenarioBatchSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    scenarios: z.array(VisitScenarioSchema).min(1),
  })
  .describe('Multiple scenarios in a single file');

// ── Inferred types ───────────────────────────────────────────────────────────

export type VisitScenario = z.infer<typeof VisitScenarioSchema>;
export type VisitScenarioBatch = z.infer<typeof VisitScenarioBatchSchema>;
export type Patient = z.infer<typeof PatientSchema>;
export type Visit = z.infer<typeof VisitSchema>;
export type History = z.infer<typeof HistorySchema>;
export type Vitals = z.infer<typeof VitalsSchema>;
export type Modules = z.infer<typeof ModulesSchema>;
export type Eligibility = z.infer<typeof EligibilitySchema>;
export type Pricing = z.infer<typeof PricingSchema>;
export type Disposition = z.infer<typeof DispositionSchema>;
