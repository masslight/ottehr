// Encounters dataset (one row per encounter). The Zod schemas below are the single source of truth:
// they derive the TS types, validate the response, and are serialized for the generation prompt
// (names/types/descriptions; enum members for closed vocabularies — never values sampled from data).
// Field descriptions are written for the LLM.
import { MedicationRequest } from 'fhir/r4b';
import { z } from 'zod';
import { mapDispositionTypeToLabel } from '../../../fhir/disposition';
import { PaymentVariant } from '../../../fhir/encounter';
import { LATERALITY_SELECTORS, LateralityValue } from '../../../fhir/radiology';
import {
  VitalBloodPressureObservationMethod,
  VitalHeartbeatObservationMethod,
  VitalsOxygenSatObservationMethod,
  VitalTemperatureObservationMethod,
} from '../../api/chart-data/chart-data.constants';
import { DispositionType, VitalsVisionOption } from '../../api/chart-data/chart-data.types';
import { NonNormalResult } from '../../api/lab';
import { DrugInteraction } from '../../api/medication-administration.types';
import { PROVIDER_TYPE_VALUES } from '../../api/practitioner.types';
import { RADIOLOGY_SAFETY_FLAGS, RadiologyOrderStatus } from '../../api/radiology';
import { OBSERVATION_CODES } from '../../data/in-house/in-house.constants';
import { TestStatus } from '../../data/in-house/in-house.types';
import { ExternalLabsStatus } from '../../data/labs/labs.types';
import { NursingOrdersStatus } from '../../data/orders/constants';
import { AdHocLayerMap, DatasetInput, datasetInputSchema, datasetRowSchema, LayerRowFields } from './dataset';

// Closed vocabularies are taken from the app's own constants, so a status the app adds or renames
// changes the schema the report is generated against instead of failing validation at runtime.
const enumValues = <T extends string>(values: T[]): [T, ...T[]] => values as [T, ...T[]];

const PAYMENT_VARIANT_VALUES = enumValues(Object.values(PaymentVariant));
const EXTERNAL_LAB_STATUS_VALUES = Object.values(ExternalLabsStatus);

// Record<TestStatus, true> requires every TestStatus as a key — a new status fails to compile here.
const IN_HOUSE_LAB_STATUSES = { ORDERED: true, COLLECTED: true, FINAL: true } satisfies Record<TestStatus, true>;
// determineOrderStatus falls back to 'UNKNOWN' (cast) when no rule matches, so it is part of the domain.
const IN_HOUSE_LAB_STATUS_VALUES = [...(Object.keys(IN_HOUSE_LAB_STATUSES) as TestStatus[]), 'UNKNOWN'] as const;
const LAB_TEST_STATUS_VALUES = enumValues<string>([...EXTERNAL_LAB_STATUS_VALUES, ...IN_HOUSE_LAB_STATUS_VALUES]);
const RADIOLOGY_ORDER_STATUS_VALUES = enumValues(Object.values(RadiologyOrderStatus));
const LATERALITY_VALUES = enumValues(Object.keys(LATERALITY_SELECTORS) as LateralityValue[]);
const DRUG_INTERACTION_SEVERITIES = { high: true, moderate: true, low: true } satisfies Record<
  NonNullable<DrugInteraction['severity']>,
  true
>;
const DRUG_INTERACTION_SEVERITY_VALUES = enumValues(
  Object.keys(DRUG_INTERACTION_SEVERITIES) as NonNullable<DrugInteraction['severity']>[]
);
// Record<…, true> requires every FHIR MedicationRequest.status as a key.
const MEDICATION_REQUEST_STATUSES = {
  active: true,
  'on-hold': true,
  cancelled: true,
  completed: true,
  'entered-in-error': true,
  stopped: true,
  draft: true,
  unknown: true,
} satisfies Record<NonNullable<MedicationRequest['status']>, true>;
const MEDICATION_REQUEST_STATUS_VALUES = enumValues(
  Object.keys(MEDICATION_REQUEST_STATUSES) as NonNullable<MedicationRequest['status']>[]
);
const TEMPERATURE_METHOD_VALUES = enumValues(Object.values(VitalTemperatureObservationMethod));
const HEARTBEAT_METHOD_VALUES = enumValues(Object.values(VitalHeartbeatObservationMethod));
const BLOOD_PRESSURE_METHOD_VALUES = enumValues(Object.values(VitalBloodPressureObservationMethod));
const OXYGEN_SAT_METHOD_VALUES = enumValues(Object.values(VitalsOxygenSatObservationMethod));

// Record<…, true> requires every chart vision option as a key.
const VISION_OPTIONS = { child_too_young: true, with_glasses: true, without_glasses: true } satisfies Record<
  VitalsVisionOption,
  true
>;

const VISION_OPTION_VALUES = enumValues(Object.keys(VISION_OPTIONS) as VitalsVisionOption[]);
const DISPOSITION_TYPE_VALUES = enumValues(Object.keys(mapDispositionTypeToLabel) as DispositionType[]);
const NURSING_ORDER_STATUS_VALUES = enumValues(Object.values(NursingOrdersStatus));
const NON_NORMAL_RESULT_VALUES = enumValues(Object.values(NonNormalResult));
const RESULT_INTERPRETATION_VALUES = enumValues(Object.values(OBSERVATION_CODES) as string[]);

// Base columns — always present on every row.
export const EncounterBaseRowSchema = z.object({
  // --- Visit ---
  appointmentId: z.string().describe('Visit id.'),
  encounterId: z.string().optional().describe('Encounter id (internal — dedupe/joins).'),
  date: z.string().nullable().describe('Viewer-local visit day (yyyy-MM-dd); day-level companion of startTime.'),
  startTime: z
    .string()
    .describe(
      "Full ISO visit start ('' when unknown). Format in the user's LOCAL timezone via new Date(startTime).toLocaleTimeString(...); do NOT slice the ISO string (shows UTC)."
    ),
  trackingBoardHref: z
    .string()
    .optional()
    .describe("Ready-made internal link for the visit ('' when none); pass to Report.Link href=."),
  visitType: z.enum(['In-Person', 'Telemed', 'Unknown']).describe('Visit modality.'),
  appointmentType: z.string().describe('Walk-in, pre-booked, or post-telemed.'),
  serviceCategory: z.string().describe('Service line (e.g. "Urgent Care").'),
  visitStatus: z
    .string()
    .describe(
      'CURRENT visit status only (completed / arrived / cancelled / no-show …). It carries NO history — ' +
        'for the order of statuses use statusHistory. A visit from an earlier day can still sit in an ' +
        'intermediate status (e.g. arrived) if it was never completed.'
    ),
  visitStatusSince: z
    .string()
    .nullable()
    .describe(
      'Full ISO instant the CURRENT visitStatus began (null when unknown); the time spent in the current ' +
        'status so far runs from here to now.'
    ),
  statusHistory: z
    .array(
      z.object({
        status: z.string().describe('Visit status at this step.'),
        start: z
          .string()
          .nullable()
          .describe(
            "Full ISO instant this status began (null when unknown). Format in the user's LOCAL " +
              'timezone via new Date(start); do NOT slice the ISO string (shows UTC).'
          ),
        end: z
          .string()
          .nullable()
          .describe(
            'Full ISO instant this status ended; null while it is still the current status — an open ' +
              'interval that runs to now, not a zero-length one.'
          ),
      })
    )
    .describe(
      'Visit status transitions, oldest first. [0] = first status, last = current. This is the ONLY ' +
        'source for anything about the ORDER of statuses (e.g. a status moving backward through the ' +
        'workflow) or how long a status lasted. Empty when no history was recorded.'
    ),
  encounterType: z
    .enum(['main', 'follow-up', 'scheduled-follow-up'])
    .describe(
      'Kind of encounter row. follow-up = a note added to a visit (phone call etc.) — it is included when its ' +
        'PARENT visit falls in the date range, and its startTime/date are its own; scheduled-follow-up = a ' +
        'booked follow-up visit, a visit of its own.'
    ),
  reason: z.string().describe('Reason for visit as entered at booking (free text). "" when not given.'),
  reasonForVisit: z
    .string()
    .describe(
      'The reason for visit picked at booking, without the free-text details — group and count by THIS. "" when ' +
        'not given.'
    ),
  reasonDetails: z.string().describe('Free-text details the patient added to the reason for visit. "" when none.'),
  scheduledSlotMinutes: z.number().nullable().describe('Booked slot length in minutes.'),
  bookedAt: z
    .string()
    .nullable()
    .describe(
      'Full ISO instant the appointment was booked. Booking lead time = startTime − bookedAt. Follow-up rows ' +
        "carry their parent visit's booking. Null when unknown."
    ),
  room: z.string().describe('Room the visit was assigned to. "" when none.'),
  group: z.string().describe('Provider group the visit was booked through. "" when not booked via a group.'),
  // --- Patient ---
  patientId: z.string().describe('Patient id; rows are per-encounter, so count UNIQUE patientId for a patient count.'),
  firstName: z.string().describe('Patient first name.'),
  lastName: z.string().describe('Patient last name.'),
  patientName: z.string().describe('Patient full name.'),
  dateOfBirth: z.string().nullable().describe('Patient date of birth (yyyy-MM-dd).'),
  sex: z.string().describe('Patient sex/gender label.'),
  city: z.string().describe('Patient city.'),
  state: z.string().describe('Patient state.'),
  zip: z.string().describe('Patient ZIP/postal code.'),
  phone: z.string().describe('Patient phone number.'),
  email: z.string().describe('Patient email address.'),
  source: z.string().describe('Point of discovery / marketing source.'),
  // --- Location / Provider ---
  location: z.string().describe('Clinic / location name.'),
  locationId: z.string().optional().describe('Location id (internal — joins).'),
  region: z.string().describe("Clinic region (location's state)."),
  clinicOpenHours: z
    .number()
    .nullable()
    .describe(
      "Hours the clinic was open on this visit's day (schedule, overrides and closures applied); 0 when closed. Null if unset."
    ),
  attendingProvider: z.string().describe('Attending provider name.'),
  attendingProviderId: z.string().optional().describe('Attending provider id (internal — joins).'),
  attendingProviderType: z
    .enum(PROVIDER_TYPE_VALUES)
    .nullable()
    .describe(
      "Attending provider's credential (MD / DO = physician, PA / NP = advanced practice). Null when no " +
        'attending or not set on the provider.'
    ),
  intakePerformer: z
    .string()
    .describe('Staff member who performed intake (full name). "" when intake was not recorded.'),
  intakePerformerId: z.string().optional().describe('Intake performer id (internal — joins).'),
  // --- Cancellation / payment ---
  cancellationReason: z
    .string()
    .describe(
      'Reason picked when the visit was cancelled — the category; group and count by THIS. "" when the visit ' +
        'was not cancelled or no reason was given. A no-show carries no reason.'
    ),
  cancellationReasonDisplay: z
    .string()
    .describe(
      'Cancellation reason as the app shows it: the category plus any free-text detail added, e.g. ' +
        '"Patient improved - feeling better". "" when none. For display only — group by cancellationReason.'
    ),
  paymentVariant: z
    .enum(PAYMENT_VARIANT_VALUES)
    .nullable()
    .describe(
      'How the patient said this visit will be paid: insurance, selfPay, or employer (occupational medicine). ' +
        "Chosen per visit in paperwork — may differ from the patient's current coverage. Null when not chosen."
    ),
  // --- Registration ---
  registrationChannel: z
    .enum(['Staff', 'Self-scheduled', 'Walk-in', 'Unknown'])
    .describe('How the visit was registered.'),
  registeredBy: z.string().describe('Staff login email, or "Patient".'),
  registeredByName: z.string().describe("Registrar's full name (falls back to email/Patient)."),
});

// Row-only ids: needed for dedupe/joins, never described to the model. Typed as keys of the row so a
// field absent from the schema is a compile error.
export const ENCOUNTER_INTERNAL_FIELDS: readonly (keyof AdHocEncounterRow)[] = [
  'encounterId',
  'locationId',
  'attendingProviderId',
  'intakePerformerId',
];

// Per-field opt-in value domain: for these fields ONLY, the distinct values present in the fetched
// rows are sampled and shown to the LLM (capped; see sampleDomains) — the one path by which real
// values reach the model. Limited to two safe kinds so the model filters/groups against values that
// truly occur instead of guessing:
//   - low-cardinality, data-dependent categoricals (service line, status, location, …) not closed
//     enough to be a z.enum;
//   - clinical code / code-label fields and order/result/vaccine/drug name arrays — the names a
//     report has to filter or group by, which are unguessable unless the real ones are disclosed.
// Excluded (schema-only): identifiers & contact, free text, provider names, exam/ROS findings, drug
// displays WITH strength (high-cardinality; medicationIngredients is the field to count by), all
// numeric/date fields (a value list is meaningless). Closed vocabularies are z.enum and
// need no entry. Typed as keys of the row so a field absent from the schema is a compile error.
export const ENCOUNTER_DOMAIN_FIELDS: readonly (keyof AdHocEncounterRow)[] = [
  // base categoricals
  'appointmentType',
  'serviceCategory',
  'visitStatus',
  'sex',
  'state',
  'region',
  'location',
  'source',
  'cancellationReason',
  'reasonForVisit',
  'room',
  'group',
  // codes / labels (codes layer)
  'icdCodes',
  'icdDisplays',
  'primaryIcd',
  'primaryIcdDisplay',
  'cptCodes',
  'cptDisplays',
  'emCode',
  'emDisplay',
  // clinical categoricals / name arrays (various layers)
  'aiType',
  'labOrders',
  'labTestNames',
  'labNames',
  'labResultComponents',
  'imagingOrders',
  // Value sampling only covers flat row fields, so the vaccine names inside the records get a flat list.
  'vaccineNames',
  'nursingOrders',
  'resultNames',
  'medicationIngredients',
  'followUpTypes',
  'transferReason',
  'transferSpecialty',
  'dispositionLabServices',
  'dispositionVirusTests',
  'asqScreen',
  'accidentType',
  'screeningQuestions',
  'workSchoolNotes',
  'patientScreeningQuestions',
  'followUpReason',
  'procedureTypes',
  'occupationalMedicineEmployer',
];

// Opt-in layers, declared once (metadata + Zod field schema). Row/response schema, endpoint input
// flags, UI checkboxes, and the prompt's availableLayers all derive from this map — a layer's id
// lives here and nowhere else.
export const ENCOUNTER_LAYERS = {
  codes: {
    label: 'Clinical codes (ICD / CPT / E&M)',
    description: 'Diagnoses and procedure codes charted on the visit.',
    schema: z.object({
      icdCodes: z.array(z.string()).describe('ICD-10 dx codes (primary first). HIERARCHICAL — prefix-match.'),
      icdDisplays: z.array(z.string()).describe('Dx descriptions, parallel to icdCodes.'),
      primaryIcd: z
        .string()
        .describe('Primary (rank-1) ICD-10 code, if marked. "" when no diagnosis is marked primary.'),
      primaryIcdDisplay: z.string().describe('Primary dx description. "" when none marked.'),
      cptCodes: z.array(z.string()).describe('CPT/HCPCS codes (excl. E&M). NOT hierarchical.'),
      cptDisplays: z.array(z.string()).describe('CPT/HCPCS descriptions, parallel to cptCodes.'),
      emCode: z.string().describe('E&M code, e.g. "99213". "" when unset.'),
      emDisplay: z.string().describe('E&M code description. "" when unset.'),
    }),
  },
  timing: {
    label: 'KPI timing',
    description: 'Per-visit arrival → provider → discharge durations and on-time flag.',
    schema: z.object({
      timeWithProviderMinutes: z.number().nullable().describe('Minutes in "provider" status.'),
      arrivedToProviderMinutes: z.number().nullable().describe('Arrival → first seen by provider.'),
      arrivedToIntakeMinutes: z.number().nullable().describe('Arrival → intake.'),
      intakeToProviderMinutes: z.number().nullable().describe('Intake → provider.'),
      providerToDischargedMinutes: z.number().nullable().describe('Provider → discharge.'),
      totalCycleMinutes: z.number().nullable().describe('Arrival → discharge (cycle time).'),
      onTime: z.boolean().nullable().describe('Pre-booked: arrived at/before scheduled start? Null otherwise.'),
    }),
  },
  ai: {
    label: 'AI assistance',
    description: 'Whether the visit used ambient scribe and/or the patient HPI chatbot.',
    schema: z.object({
      aiType: z.string().describe('AI on visit: "", "ambient scribe", "patient HPI chatbot", or both.'),
    }),
  },
  medications: {
    label: 'Medications',
    description: 'Drugs on the visit — eRx prescribed and in-house administered (all statuses).',
    schema: z.object({
      medications: z.array(z.string()).describe('All drugs (eRx + in-house), full display w/ strength.'),
      medicationIngredients: z
        .array(z.string())
        .describe('Drug display without strength/dose — group and count by THIS.'),
      medicationSources: z.array(z.enum(['eRx', 'in-house'])).describe('Parallel: source per entry.'),
      medicationCodes: z.array(z.string()).describe('Medispan dispensable-drug-id codes (eRx).'),
      medicationCount: z.number().describe('Total medications on the visit. 0 when none.'),
      drugs: z
        .array(
          z.object({
            name: z.string().describe('Drug display with strength, same value as in medications[].'),
            source: z.enum(['eRx', 'in-house']).describe('Prescribed (eRx) or given in the clinic (in-house).'),
            status: z
              .enum([
                'administered',
                'partially-administered',
                'not-administered',
                'pending',
                'cancelled',
                'prescribed',
              ])
              .describe(
                'In-house order status: administered / partially-administered = the drug was given; ' +
                  'not-administered, pending, cancelled = nothing was given. eRx rows are always "prescribed".'
              ),
            dose: z.number().nullable().describe('Amount given. Null for eRx.'),
            units: z.string().nullable().describe('Unit of dose, e.g. "mg"/"mL". Null for eRx.'),
            route: z.string().nullable().describe('Route code of administration. Null for eRx.'),
            ndc: z.string().nullable().describe('NDC code entered at administration. Null when not entered.'),
            lotNumber: z.string().nullable().describe('Lot number of the vial used. Null when not recorded.'),
            expirationDate: z
              .string()
              .nullable()
              .describe('Expiry of the vial used (yyyy-MM-dd). Null when not recorded.'),
            manufacturer: z
              .string()
              .nullable()
              .describe('Manufacturer entered at order or administration. Null when none.'),
            administeredAt: z
              .string()
              .nullable()
              .describe(
                'Full ISO instant the drug was given — NOT the visit date. Format via new Date(administeredAt); ' +
                  'do NOT slice the ISO string. Null for eRx and when nothing was given.'
              ),
            administeredBy: z
              .string()
              .nullable()
              .describe('Staff member who administered the drug (full name). Null for eRx / not given.'),
            orderedBy: z
              .string()
              .nullable()
              .describe('Ordering / prescribing provider (full name). Null when unknown.'),
            cptCodes: z
              .array(z.string())
              .describe('CPT/HCPCS codes billed for THIS drug (e.g. J-codes). Empty for eRx.'),
            icdCode: z.string().nullable().describe('ICD-10 diagnosis the drug was given for. Null when none linked.'),
            icdDisplay: z.string().nullable().describe('Description of icdCode. Null when none linked.'),
            instructions: z
              .string()
              .nullable()
              .describe('Instructions on the order (in-house) or for the patient (eRx). Null when none.'),
            orderedAt: z
              .string()
              .nullable()
              .describe('Full ISO instant an in-house order was placed. Null for eRx / unknown.'),
            notGivenReason: z
              .string()
              .nullable()
              .describe('Why an in-house drug was not (fully) given, as picked in the chart. Null otherwise.'),
            notGivenReasonOther: z
              .string()
              .nullable()
              .describe('Free-text reason typed when notGivenReason is "other". Null otherwise.'),
            administrationSite: z
              .string()
              .nullable()
              .describe('Body site the in-house drug was given at. Null for eRx / not recorded.'),
            drugInteractionSeverities: z
              .array(z.enum(DRUG_INTERACTION_SEVERITY_VALUES))
              .describe('Severity of each drug–drug interaction flagged for THIS drug at ordering. Empty when none.'),
            allergyInteractionCount: z
              .number()
              .describe('Number of drug–allergy interactions flagged for THIS drug at ordering.'),
            interactionOverridden: z
              .boolean()
              .describe('The provider overrode at least one flagged interaction (gave an override reason).'),
            erxStatus: z
              .enum(MEDICATION_REQUEST_STATUS_VALUES)
              .nullable()
              .describe('eRx only: prescription status (active, completed, cancelled, …). Null for in-house.'),
            isRenewal: z.boolean().nullable().describe('eRx only: the prescription is a renewal. Null for in-house.'),
          })
        )
        .describe(
          'One record per drug, with the detail a recall or an audit needs: status, lot number, NDC, manufacturer, ' +
            'expiry, dose, route, the time it was given, who gave it, who ordered it, and the CPT / ICD-10 tied to ' +
            'it. All of these are null for eRx. For in-house orders: lot number and expiry describe the vial and ' +
            'are null unless the drug was given (administered / partially-administered); NDC and manufacturer ' +
            'describe the product, are entered by staff and may be present on any status. Empty when no drugs on ' +
            'the visit.'
        ),
    }),
  },
  vitals: {
    label: 'Vital signs',
    description:
      'Temperature (°F and °C), heart rate, blood pressure, SpO₂, respiration, weight (kg and lbs), height (cm, ' +
      'inches, feet/inches), BMI, how each was taken (route / position / room air), weight refused, vision ' +
      '(visual acuity, DOT vision screening), last menstrual period, and who recorded the vitals and when.',
    schema: z.object({
      temperatureF: z
        .number()
        .nullable()
        .describe('Temperature °F, MOST RECENT reading only — for the initial one use temperatureFReadings[0].'),
      heartRate: z
        .number()
        .nullable()
        .describe('Heart rate bpm, MOST RECENT reading only — for the initial one use heartRateReadings[0].'),
      respirationRate: z
        .number()
        .nullable()
        .describe('Respiration /min, MOST RECENT only — for the initial one use respirationRateReadings[0].'),
      oxygenSaturation: z
        .number()
        .nullable()
        .describe('SpO₂ %, MOST RECENT only — for the initial one use oxygenSaturationReadings[0].'),
      systolicBP: z
        .number()
        .nullable()
        .describe('Systolic BP mmHg, MOST RECENT only — for the initial one use bloodPressureReadings[0].systolic.'),
      diastolicBP: z
        .number()
        .nullable()
        .describe('Diastolic BP mmHg, MOST RECENT only — for the initial one use bloodPressureReadings[0].diastolic.'),
      weightKg: z.number().nullable().describe('Weight kg (most recent, normalized). Null if not taken.'),
      heightCm: z.number().nullable().describe('Height cm (most recent, normalized). Null if not taken.'),
      bmi: z.number().nullable().describe('BMI from weightKg/heightCm when both present. Null otherwise.'),
      temperatureFReadings: z
        .array(z.number())
        .describe(
          'Temperature readings in °F, oldest first (charted in °C, converted here). ' +
            '[0] = initial screening. Empty if not taken.'
        ),
      heartRateReadings: z
        .array(z.number())
        .describe('Heart rate bpm readings, oldest first. [0] = initial screening. Empty if not taken.'),
      respirationRateReadings: z
        .array(z.number())
        .describe('Respiration /min readings, oldest first. [0] = initial screening. Empty if not taken.'),
      oxygenSaturationReadings: z
        .array(z.number())
        .describe('SpO₂ % readings, oldest first. [0] = initial screening. Empty if not taken.'),
      systolicBPReadings: z
        .array(z.number())
        .describe(
          'Systolic BP mmHg readings, oldest first. [0] = initial screening. The same index in ' +
            'diastolicBPReadings is the SAME reading. Empty if not taken.'
        ),
      diastolicBPReadings: z
        .array(z.number())
        .describe(
          'Diastolic BP mmHg readings, oldest first. [0] = initial screening. The same index in ' +
            'systolicBPReadings is the SAME reading. Empty if not taken.'
        ),
      abnormalVitals: z
        .array(z.string())
        .describe(
          'Vitals that were out of range on ANY reading of the visit, by the age-banded thresholds the ' +
            'practice has configured. Applied at charting time, so the age band is the age on the visit ' +
            'date. Includes the critical ones. Values: temperatureF, heartRate, respirationRate, ' +
            'oxygenSaturation, bloodPressure, weightKg, heightCm. Empty if all readings were in range. ' +
            'USE THIS instead of comparing readings to thresholds of your own.'
        ),
      criticalVitals: z
        .array(z.string())
        .describe('The subset of abnormalVitals that reached the CRITICAL level, not merely abnormal. Same values.'),
      // --- The same readings in the other units the chart shows (converted with the chart's own helpers) ---
      temperatureC: z
        .number()
        .nullable()
        .describe('Temperature °C, MOST RECENT reading only — same reading as temperatureF. Null if not taken.'),
      temperatureCReadings: z
        .array(z.number())
        .describe('Temperature readings in °C, oldest first, parallel to temperatureFReadings. Empty if not taken.'),
      weightLbs: z
        .number()
        .nullable()
        .describe('Weight lbs (most recent) — same reading as weightKg. Null if not taken.'),
      heightInches: z
        .number()
        .nullable()
        .describe('Height in total inches (most recent) — same reading as heightCm. Null if not taken.'),
      heightFeetInches: z
        .string()
        .describe('Height as feet and inches, e.g. 5\'7.5" (most recent) — same reading as heightCm. "" if not taken.'),
      // --- How the most recent reading was taken ---
      temperatureMethod: z
        .enum(TEMPERATURE_METHOD_VALUES)
        .nullable()
        .describe('How the most recent temperature was taken. Null when not recorded / not taken.'),
      heartRateMethod: z
        .enum(HEARTBEAT_METHOD_VALUES)
        .nullable()
        .describe('Patient position for the most recent heart rate. Null when not recorded / not taken.'),
      bloodPressureMethod: z
        .enum(BLOOD_PRESSURE_METHOD_VALUES)
        .nullable()
        .describe('Patient position for the most recent blood pressure. Null when not recorded / not taken.'),
      oxygenSaturationMethod: z
        .enum(OXYGEN_SAT_METHOD_VALUES)
        .nullable()
        .describe('Room air or supplemental O₂ for the most recent SpO₂. Null when not recorded / not taken.'),
      weightRefused: z
        .boolean()
        .describe('The most recent weight entry is "patient refused" (no value). False when weighed or not entered.'),
      // --- Vision and last menstrual period (most recent entry) ---
      visionLeftEye: z.string().describe('Left-eye visual acuity as charted, e.g. "20/20". "" if not taken.'),
      visionRightEye: z.string().describe('Right-eye visual acuity as charted. "" if not taken.'),
      visionBothEyes: z.string().describe('Both-eyes visual acuity as charted. "" if not taken.'),
      visionOptions: z
        .array(z.enum(VISION_OPTION_VALUES))
        .describe('Vision test conditions: with_glasses / without_glasses / child_too_young. Empty when none.'),
      lastMenstrualPeriod: z
        .string()
        .nullable()
        .describe('Last menstrual period date as charted (ISO). Null if not charted.'),
      lastMenstrualPeriodUnsure: z
        .boolean()
        .nullable()
        .describe('The patient was unsure of the last menstrual period date. Null if not charted.'),
      // --- DOT (FMCSA MCSA-5875) vision screening, most recent DOT entry ---
      dotHorizontalFieldLeftDegrees: z
        .number()
        .nullable()
        .describe('DOT screening: horizontal field of vision, left eye, degrees. Null if not screened.'),
      dotHorizontalFieldRightDegrees: z
        .number()
        .nullable()
        .describe('DOT screening: horizontal field of vision, right eye, degrees. Null if not screened.'),
      dotCanRecognizeColors: z
        .boolean()
        .nullable()
        .describe('DOT screening: can recognize red, green and amber. Null if not answered.'),
      dotMonocularVision: z
        .boolean()
        .nullable()
        .describe('DOT screening: monocular vision (false = binocular). Null if not answered.'),
      dotReferredToSpecialist: z
        .boolean()
        .nullable()
        .describe('DOT screening: referred to an ophthalmologist or optometrist. Null if not answered.'),
      dotReceivedReferralDocumentation: z
        .boolean()
        .nullable()
        .describe('DOT screening: documentation received from the specialist. Null if not answered.'),
      // --- Who recorded the vitals ---
      vitalsRecordedBy: z
        .array(z.string())
        .describe(
          'Staff who recorded vitals on the visit (full names, in order of their first reading). Empty if none.'
        ),
      vitalsFirstRecordedAt: z
        .string()
        .nullable()
        .describe('Full ISO instant of the first vital reading on the visit. Null if no vitals.'),
    }),
  },
  labs: {
    label: 'Lab orders',
    description:
      'Lab tests ordered on the visit (external and in-house): names, performing lab, order status, ordered / ' +
      'sent / resulted times, ordering provider, abnormal flags and in-house result values (e.g. positive / ' +
      'negative rapid tests). External result values are NOT available. The physical test kit / reagent is NOT recorded ' +
      'anywhere — no kit lot number, expiration, manufacturer or NDC; a drug lot in the medications layer is ' +
      'NOT a substitute.',
    schema: z.object({
      labOrders: z
        .array(z.string())
        .describe(
          'Lab orders on the visit (names; excl. cancelled), as tagged on the order. For per-test status, lab and ' +
            'results use labTests[] — it lists the orders the lab pages show, so its length can differ.'
        ),
      labOrderCount: z.number().describe('Number of entries in labOrders. 0 when none.'),
      labTestNames: z
        .array(z.string())
        .describe('Test name of each labTests[] record, same order — the values labTests[].name takes.'),
      labNames: z
        .array(z.string())
        .describe('Distinct performing labs on the visit (external lab names, "In-house" for in-house tests).'),
      labResultComponents: z
        .array(z.string())
        .describe(
          'Distinct in-house result component names on the visit — the values labTests[].resultComponents takes.'
        ),
      labTests: z
        .array(
          z.object({
            name: z.string().describe('Test name, as shown on the lab orders page.'),
            kind: z.enum(['external', 'in-house']).describe('Sent to an outside lab (external) or run in the clinic.'),
            lab: z.string().describe('Performing lab name for external tests; "In-house" for in-house tests.'),
            status: z
              .enum(LAB_TEST_STATUS_VALUES)
              .describe(
                'Order status as the lab orders page shows it. External: pending → ready → sent / sent manually → ' +
                  'prelim → received → reviewed (corrected, cancelled by lab, rejected abn are side paths). In-house: ' +
                  'ORDERED → COLLECTED → FINAL. A test with results has status received / reviewed / corrected ' +
                  '(external) or FINAL (in-house).'
              ),
            orderedAt: z.string().nullable().describe('Full ISO instant the test was ordered. Null when unknown.'),
            submittedAt: z
              .string()
              .nullable()
              .describe('Full ISO instant an external order was sent to the lab. Null for in-house / not sent.'),
            resultedAt: z
              .string()
              .nullable()
              .describe(
                'Full ISO instant the latest result arrived (external) or was entered (in-house). Null when no ' +
                  'result yet. Turnaround = resultedAt − orderedAt.'
              ),
            orderedBy: z.string().describe('Ordering provider (full name). "" when unknown.'),
            isPSC: z
              .boolean()
              .describe('External order sent to a patient service center for collection (not collected in clinic).'),
            icdCodes: z
              .array(z.string())
              .describe('ICD-10 codes the test was ordered for. HIERARCHICAL — prefix-match.'),
            nonNormalResults: z
              .array(z.enum(NON_NORMAL_RESULT_VALUES))
              .describe(
                'Flags the lab put on the results of THIS test (abnormal / inconclusive / neutral). Empty when the ' +
                  'results are normal or there are none yet — check status to tell them apart.'
              ),
            resultComponents: z
              .array(z.string())
              .describe('In-house only: result component names (e.g. "Strep A"). Empty for external / no result.'),
            resultValues: z
              .array(z.string())
              .describe(
                'In-house only, parallel to resultComponents: the entered value as a label (e.g. "Positive", ' +
                  '"Negative") or a number with its unit. "" for a component left blank.'
              ),
            resultInterpretations: z
              .array(z.enum(RESULT_INTERPRETATION_VALUES))
              .describe(
                'In-house only, parallel to resultComponents: A = abnormal (e.g. a POSITIVE rapid test), N = normal, ' +
                  'IND = indeterminate. Count A for a positivity rate.'
              ),
            collectedAt: z
              .string()
              .nullable()
              .describe('Full ISO instant the specimen was collected. Null when not recorded / sent to a PSC.'),
            collectedBy: z.string().describe('Who collected the specimen. "" when not recorded.'),
            reviewedAt: z
              .string()
              .nullable()
              .describe(
                'External only: full ISO instant the provider reviewed the (latest) result. Null until reviewed. ' +
                  'Result-to-review time = reviewedAt − resultedAt.'
              ),
            reviewedBy: z.string().describe('External only: provider who reviewed the result. "" until reviewed.'),
          })
        )
        .describe(
          'One record per lab test ordered on the visit (external and in-house; cancelled orders excluded), with ' +
            'status, timing, ordering provider and results. Empty when none.'
        ),
    }),
  },
  imaging: {
    label: 'Radiology orders',
    description:
      "Radiology studies ordered on the visit: names, counts, each order's status timeline (through the final read " +
      'and its review), CPT and laterality, STAT, external orders, ordering provider, diagnoses and safety flags.',
    schema: z.object({
      imagingOrders: z.array(z.string()).describe('Radiology studies ordered (excl. cancelled).'),
      imagingOrderCount: z.number().describe('Number of radiology studies ordered. 0 when none.'),
      imagingStudies: z
        .array(
          z.object({
            name: z
              .string()
              .describe('Study name, same value as the corresponding radiology order (including cancelled orders).'),
            status: z
              .enum(['pending', 'performed', 'preliminary', 'final', 'cancelled'])
              .describe(
                'Order progress, coarse: pending → performed → preliminary (read) → final (read). For the exact ' +
                  'status as the radiology page shows it (incl. pending final, reviewed) use orderStatus.'
              ),
            orderStatus: z
              .enum(RADIOLOGY_ORDER_STATUS_VALUES)
              .nullable()
              .describe(
                'Status as the radiology orders page shows it: pending → performed → preliminary → pending final ' +
                  '(sent for the final read) → final → reviewed (final read reviewed by the provider). External ' +
                  '(print-only) orders go ordered → reviewed (result uploaded). Null for cancelled orders.'
              ),
            orderedAt: z.string().nullable().describe('Full ISO instant the order was placed (status pending).'),
            performedAt: z.string().nullable().describe('Full ISO instant the study was performed. Null until then.'),
            preliminaryAt: z
              .string()
              .nullable()
              .describe('Full ISO instant the preliminary read was saved. Null until then.'),
            pendingFinalAt: z
              .string()
              .nullable()
              .describe('Full ISO instant the study was sent for the final read. Null until then / never sent.'),
            finalAt: z.string().nullable().describe('Full ISO instant the final read was issued. Null until then.'),
            reviewedAt: z
              .string()
              .nullable()
              .describe('Full ISO instant the final read (or an external result) was reviewed. Null until then.'),
            cptCode: z.string().describe('Base CPT code of the study (without the laterality modifier).'),
            laterality: z
              .enum(LATERALITY_VALUES)
              .nullable()
              .describe('CPT laterality modifier: LT = left, RT = right, 50 = bilateral. Null when none.'),
            stat: z.boolean().nullable().describe('Ordered STAT. Null for cancelled orders.'),
            external: z.boolean().describe('External (print-only) order performed outside the clinic.'),
            orderedBy: z
              .string()
              .describe("Ordering provider as the radiology page shows it (the visit's attending provider)."),
            icdCodes: z
              .array(z.string())
              .describe('ICD-10 codes the study was ordered for. HIERARCHICAL — prefix-match.'),
            performedBy: z.string().describe('Who performed the study. "" when not recorded.'),
            performingOrganization: z.string().describe('Organization performing an external study. "" when none.'),
            safetyFlags: z
              .array(z.enum(RADIOLOGY_SAFETY_FLAGS))
              .describe('Patient-safety flags on the order (implants, metal, pacemaker, pregnancy, contrast allergy).'),
            consentObtained: z
              .boolean()
              .nullable()
              .describe('Consent for the study was obtained. Null for cancelled orders.'),
          })
        )
        .describe('One record per radiology order with its status timestamps. Empty when no radiology on the visit.'),
    }),
  },
  immunizations: {
    label: 'Immunizations',
    description: 'Vaccines given or recorded on the visit, with VIS status.',
    schema: z.object({
      vaccines: z
        .array(
          z.object({
            name: z.string().describe('Vaccine name.'),
            status: z
              .enum(['administered', 'partially-administered', 'recorded'])
              .describe(
                'administered / partially-administered = given on THIS visit; ' +
                  'recorded = charted history, not given here.'
              ),
            visDate: z
              .string()
              .nullable()
              .describe(
                'VIS date (yyyy-MM-dd). A date means the VIS was given for this vaccine; null means it ' +
                  'was not. Always null for "recorded" history.'
              ),
            lotNumber: z
              .string()
              .nullable()
              .describe('Lot number of the vial used, for a recall. Null when not recorded or for history.'),
            expirationDate: z
              .string()
              .nullable()
              .describe('Expiry of the vial used (yyyy-MM-dd). Null when not recorded or for history.'),
            ndc: z.string().nullable().describe('NDC code of the vial used. Null when not recorded or for history.'),
            cvx: z.string().nullable().describe('CVX vaccine code. Null when not recorded or for history.'),
            manufacturer: z.string().nullable().describe('Manufacturer name. Null when not recorded or for history.'),
            dose: z.number().nullable().describe('Amount given. Null when not recorded or for history.'),
            units: z.string().nullable().describe('Unit of dose, e.g. "mL". Null when not recorded or for history.'),
            route: z
              .string()
              .nullable()
              .describe('Route code of administration. Null when not recorded or for history.'),
            administeredAt: z
              .string()
              .nullable()
              .describe(
                'Full ISO instant the vaccine was given. Format via new Date(administeredAt); do NOT slice the ' +
                  'ISO string. Null for history.'
              ),
            administeredBy: z
              .string()
              .nullable()
              .describe('Staff member who administered the vaccine (full name). Null when unknown or for history.'),
            orderedBy: z
              .string()
              .nullable()
              .describe('Ordering provider (full name). Null when unknown or for history.'),
            cptCodes: z.array(z.string()).describe('CPT codes billed for THIS vaccine. Empty for history.'),
            mvx: z.string().nullable().describe('MVX manufacturer code. Null when not recorded or for history.'),
            bodySite: z
              .string()
              .nullable()
              .describe('Body site the vaccine was given at. Null when not recorded / history.'),
            instructions: z.string().nullable().describe('Instructions on the order. Null when none / history.'),
            orderedAt: z.string().nullable().describe('Full ISO instant the vaccine was ordered. Null for history.'),
          })
        )
        .describe(
          'One record per vaccine on the visit with the detail a recall or an audit needs: lot, expiry, NDC, CVX, ' +
            'manufacturer, dose, time given, who gave it, who ordered it. Count vaccines GIVEN with ' +
            'status !== "recorded"; the VIS gap is status !== "recorded" && visDate === null. Empty when none. ' +
            'Vaccine orders that were NOT given are in vaccinesNotGiven, not here.'
        ),
      vaccineNames: z
        .array(z.string())
        .describe('Distinct names of the vaccines in vaccines[] and vaccinesNotGiven[] — the values their name takes.'),
      vaccinesNotGiven: z
        .array(
          z.object({
            name: z.string().describe('Vaccine name.'),
            status: z
              .enum(['pending', 'not-administered', 'cancelled'])
              .describe('pending = ordered, not given yet; not-administered = the order was declined / not given.'),
            reason: z.string().nullable().describe('Why it was not given, as charted. Null when none.'),
            orderedAt: z.string().nullable().describe('Full ISO instant the vaccine was ordered. Null when unknown.'),
            orderedBy: z.string().nullable().describe('Ordering provider (full name). Null when unknown.'),
          })
        )
        .describe(
          'Vaccine orders on the visit that were not given (pending, not administered, cancelled). Empty when none.'
        ),
    }),
  },
  employer: {
    label: 'Occupational medicine employer',
    description: 'The occupational-medicine employer of the visit, as printed on the visit details face sheet.',
    schema: z.object({
      occupationalMedicineEmployer: z
        .string()
        .describe(
          'Employer name: for pre-op visits the employer picked for THIS visit; otherwise the occupational-' +
            "medicine employer on the patient's account (it may be set on any visit — filter by serviceCategory " +
            'for occupational-medicine visits). "" when none.'
        ),
    }),
  },
  disposition: {
    label: 'Disposition / follow-up',
    description:
      'Discharge disposition (type, follow-up in N days, transfer reason / specialty, labs and virus tests to do) ' +
      'and the charted follow-up plan.',
    schema: z.object({
      followUpTypes: z.array(z.string()).describe('Charted follow-up plan types.'),
      followUpCount: z.number().describe('Number of follow-up plan items charted.'),
      dischargeDisposition: z
        .string()
        .describe(
          'Disposition note given to the patient — FREE TEXT (may be full instructions). "" when unset. For the ' +
            'kind of disposition use dispositionType.'
        ),
      dispositionType: z
        .enum(DISPOSITION_TYPE_VALUES)
        .nullable()
        .describe(
          'Kind of disposition — group and count by THIS: pcp / pcp-no-type = follow up with the primary care ' +
            'physician, ed = ED transfer, ip / ip-lab / ip-oth = in-person / lab / other in-person transfer, ' +
            'specialty = specialty transfer, another = transfer to another location. Null when not charted.'
        ),
      dispositionLabel: z.string().describe('dispositionType as the chart labels it. "" when not charted.'),
      followUpInDays: z.number().nullable().describe('Follow up in this many days (0 = as needed). Null when not set.'),
      transferReason: z.string().describe('Reason for the transfer. "" when not a transfer / not given.'),
      transferSpecialty: z
        .string()
        .describe('Specialty transferred to (for specialty transfers); "Other" means see transferSpecialtyOther.'),
      transferSpecialtyOther: z
        .string()
        .describe('Specialty typed in when transferSpecialty is "Other". "" otherwise.'),
      dispositionLabServices: z.array(z.string()).describe('Lab services requested with the disposition.'),
      dispositionVirusTests: z.array(z.string()).describe('Virus tests requested with the disposition.'),
      nothingToEatOrDrink: z.boolean().describe('The patient was told to have nothing to eat or drink.'),
      refusalOfEmsTransport: z.boolean().describe('The patient refused EMS transport.'),
    }),
  },
  examRos: {
    label: 'Exam & ROS findings',
    description: 'Structured review-of-systems (reports/denies) and physical-exam findings.',
    schema: z.object({
      rosFindings: z.array(z.string()).describe('ROS findings with state, e.g. "Reports Chills".'),
      examSystems: z.array(z.string()).describe('Physical-exam statements per system.'),
      examFindings: z.array(z.string()).describe('Specific physical-exam finding keys.'),
    }),
  },
  results: {
    label: 'Lab & imaging results',
    description: 'Resulted lab/imaging studies and abnormal-result counts.',
    schema: z.object({
      resultNames: z.array(z.string()).describe('Names of resulted lab/imaging studies.'),
      resultCount: z.number().describe('Number of resulted studies on the visit.'),
      abnormalResultCount: z.number().describe('Results flagged abnormal/inconclusive.'),
    }),
  },
  nursing: {
    label: 'Nursing orders',
    description: 'Nursing orders placed on the visit, with their status, ordering provider and order time.',
    schema: z.object({
      nursingOrders: z.array(z.string()).describe('Nursing orders placed on the visit (names).'),
      nursingOrderCount: z.number().describe('Number of nursing orders. 0 when none.'),
      nursingOrderDetails: z
        .array(
          z.object({
            order: z.string().describe('The order as written by the provider (free text).'),
            status: z.enum(NURSING_ORDER_STATUS_VALUES).describe('Current status of the order.'),
            orderedAt: z.string().nullable().describe('Full ISO instant the order was placed. Null when unknown.'),
            orderedBy: z.string().describe('Ordering provider (full name). "" when unknown.'),
          })
        )
        .describe('One record per nursing order (cancelled orders excluded). Empty when none.'),
    }),
  },
  procedures: {
    label: 'Procedures',
    description:
      'Procedures documented on the visit: type, CPT codes, performer, body site, technique, time spent, ' +
      'complications, consent.',
    schema: z.object({
      procedureTypes: z
        .array(z.string())
        .describe('Type of each procedures[] record, same order — the values procedures[].type takes.'),
      procedureCount: z.number().describe('Number of procedures documented. 0 when none.'),
      procedures: z
        .array(
          z.object({
            type: z.string().describe('Procedure type as picked in the chart (e.g. "Laceration repair").'),
            cptCodes: z.array(z.string()).describe('CPT codes billed for THIS procedure.'),
            icdCodes: z
              .array(z.string())
              .describe('ICD-10 codes linked to THIS procedure. HIERARCHICAL — prefix-match.'),
            performedAt: z
              .string()
              .nullable()
              .describe('Full ISO instant the procedure was performed. Null when unset.'),
            performerType: z
              .string()
              .describe('Who performed it, as picked in the chart (e.g. "Provider"). "" when unset.'),
            bodySite: z.string().describe('Body site. "" when unset.'),
            bodySide: z.string().describe('Body side (left / right / …). "" when unset.'),
            technique: z.array(z.string()).describe('Techniques used.'),
            medicationUsed: z.string().describe('Medication used (free text). "" when none.'),
            timeSpent: z.string().describe('Time spent, as picked in the chart (e.g. "< 5 min"). "" when unset.'),
            complications: z.string().describe('Complications as charted (e.g. "None"). "" when unset.'),
            patientResponse: z.string().describe('Patient response as charted. "" when unset.'),
            consentObtained: z.boolean().nullable().describe('Whether consent was obtained. Null when not charted.'),
            specimenSent: z.boolean().nullable().describe('Whether a specimen was sent. Null when not charted.'),
            documentedBy: z.string().describe('Who documented the procedure. "" when unset.'),
          })
        )
        .describe('One record per procedure documented on the visit. Empty when none.'),
    }),
  },
  signing: {
    label: 'Chart signing',
    description:
      'Whether and when the visit note was signed and by whom, supervisor approval (who / when, still pending), ' +
      'and whether the chart is locked.',
    schema: z.object({
      signed: z
        .boolean()
        .describe('The visit note is signed (the visit is completed, or awaiting supervisor approval).'),
      signedAt: z
        .string()
        .nullable()
        .describe(
          'Full ISO instant the note was (last) signed. Null when not signed. A chart unlocked and re-signed ' +
            'carries the latest signing.'
        ),
      signedBy: z
        .string()
        .nullable()
        .describe(
          'Provider who signed the note, as printed on the visit note (the attending provider unless a separate ' +
            'signer was recorded). Null when not signed.'
        ),
      dischargedToSignedMinutes: z
        .number()
        .nullable()
        .describe('Minutes from discharge to signing — charting lag. Null when either is missing.'),
      awaitingSupervisorApproval: z
        .boolean()
        .describe('Signed by the provider but still waiting for a supervising physician to approve.'),
      supervisorApprovedBy: z
        .string()
        .nullable()
        .describe('Supervising physician who approved the note. Null when no approval recorded.'),
      supervisorApprovedAt: z
        .string()
        .nullable()
        .describe('Full ISO instant the supervisor approved. Null when no approval recorded.'),
      locked: z.boolean().describe('The chart is locked for editing (signed and not unlocked since).'),
    }),
  },
  paperwork: {
    label: 'Paperwork status',
    description:
      'Whether the visit paperwork is complete, as the tracking board shows it: demographics, photo ID, ' +
      'insurance card, consent (signed or staff-attested).',
    schema: z.object({
      paperworkSubmittedAt: z
        .string()
        .nullable()
        .describe('Full ISO instant the patient submitted paperwork for this visit. Null when not submitted.'),
      demographicsComplete: z
        .boolean()
        .describe('Demographics are complete (paperwork submitted, or already on the patient record).'),
      photoIdOnFile: z
        .boolean()
        .describe("A photo ID is on file for the patient (the patient's current card, not per visit)."),
      insuranceCardOnFile: z
        .boolean()
        .describe("An insurance card is on file for the patient (the patient's current card, not per visit)."),
      consentComplete: z.boolean().describe('Consent is complete — signed in paperwork or attested by staff.'),
      consentMethod: z
        .enum(['paperwork', 'staff attestation'])
        .nullable()
        .describe('How consent was completed (paperwork signature wins when both). Null when consent is missing.'),
    }),
  },
  charting: {
    label: 'Chart notes',
    description:
      'Narrative chart content: chief complaint, HPI, mechanism of injury, ROS note, medical decision making ' +
      '(MDM), patient instructions, addendum, and whether a discharge summary / patient education was produced.',
    schema: z.object({
      chiefComplaint: z.string().describe('Chief complaint as charted (free text). "" when not charted.'),
      historyOfPresentIllness: z.string().describe('HPI (free text). "" when not charted.'),
      mechanismOfInjury: z.string().describe('Mechanism of injury (free text). "" when not charted.'),
      rosNote: z
        .string()
        .describe('Free-text ROS note (structured ROS findings are in the Exam & ROS layer). "" when none.'),
      medicalDecision: z.string().describe('Medical decision making (MDM) text. "" when not charted.'),
      patientInstructions: z.array(z.string()).describe('Patient instructions given on the visit (free text).'),
      addendumNote: z.string().describe('Addendum added to the note (free text). "" when none.'),
      dischargeSummaryCreated: z.boolean().describe('A discharge summary document was produced for the visit.'),
      patientEducationCount: z
        .number()
        .describe('Number of patient education documents given on the visit. 0 when none.'),
    }),
  },
  intake: {
    label: 'Intake & screenings',
    description:
      'ASQ screen, accident type, birth history, and the "Ask the patient" screening questions answered on the ' +
      'visit (e.g. pregnancy, breastfeeding, seen in the last 3 years, vaccination status, history obtained from).',
    schema: z.object({
      asqScreen: z.string().describe('ASQ screen: Negative/Positive/Declined/NotOffered/"".'),
      accidentType: z.string().describe('Accident type when accident-related, else "".'),
      birthHistory: z.array(z.string()).describe('Birth-history items (peds), when present.'),
      screeningQuestions: z
        .array(z.string())
        .describe(
          'Screening questions answered on this visit, by question text as shown to staff. A question absent ' +
            'here was not filled out on this visit.'
        ),
      screeningAnswers: z
        .array(
          z.object({
            question: z.string().describe('Question text, same value as in screeningQuestions[].'),
            answer: z.string().describe('Answer as a label ("Yes", "No", "Not applicable", …) or free text.'),
          })
        )
        .describe('One record per screening question answered on this visit. Empty when none.'),
      patientScreeningQuestions: z
        .array(z.string())
        .describe(
          'Screening questions the PATIENT answered in the intake paperwork (question text) — the values ' +
            'patientScreeningAnswers[].question takes.'
        ),
      patientScreeningAnswers: z
        .array(
          z.object({
            question: z.string().describe('Question text, same value as in patientScreeningQuestions[].'),
            answer: z.string().describe('The patient\'s answer as a label ("Yes", "No", …) or free text.'),
          })
        )
        .describe(
          "The patient's own answers in the intake paperwork, as the chart shows them next to the staff answers " +
            '(screeningAnswers). Empty when the patient answered none.'
        ),
    }),
  },
  followUp: {
    label: 'Follow-up notes',
    description:
      'Telephone / annotation follow-ups: on a follow-up row its reason, caller, who answered, message, provider ' +
      'and open / resolved status; on a visit row how many follow-up notes it has.',
    schema: z.object({
      followUpNoteCount: z
        .number()
        .describe('On a visit row: number of follow-up notes added to this visit. 0 on follow-up rows.'),
      followUpReason: z.string().describe('Follow-up row: reason picked (e.g. "Result - Lab"). "" otherwise.'),
      followUpReasonOther: z.string().describe('Follow-up row: free-text reason when "Other". "" otherwise.'),
      followUpCaller: z.string().describe('Follow-up row: who made the call. "" when not recorded.'),
      followUpAnswered: z.string().describe('Follow-up row: who answered. "" when not recorded.'),
      followUpProvider: z.string().describe('Follow-up row: provider on the follow-up. "" when none.'),
      followUpMessage: z.string().describe('Follow-up row: the note message (free text). "" when none.'),
      followUpStatus: z
        .enum(['OPEN', 'RESOLVED'])
        .nullable()
        .describe('Follow-up row: OPEN while in progress, RESOLVED once closed. Null on visit rows.'),
      followUpResolvedAt: z
        .string()
        .nullable()
        .describe('Follow-up row: full ISO instant it was resolved. Null while open and on visit rows.'),
    }),
  },
  documents: {
    label: 'Work / school notes',
    description: 'Work and school excuse notes issued on the visit.',
    schema: z.object({
      workSchoolNotes: z.array(z.string()).describe('Work/school excuse notes issued ("school"/"work").'),
      workSchoolNoteCount: z.number().describe('Number of work/school notes issued.'),
    }),
  },
} as const satisfies AdHocLayerMap;

export type EncounterLayerId = keyof typeof ENCOUNTER_LAYERS;

// Full row: base columns required, every layer column optional (present when its layer was
// requested); the schema the response is validated against. `datasetRowSchema` merges generically
// (loose static shape), so we tag it with the precise row type from the same layer map — validation
// stays runtime-exact and consumers get the precise type.
export type AdHocEncounterRow = z.infer<typeof EncounterBaseRowSchema> & LayerRowFields<typeof ENCOUNTER_LAYERS>;
export const AdHocEncounterRowSchema = datasetRowSchema(EncounterBaseRowSchema, ENCOUNTER_LAYERS).describe(
  'One row per encounter.'
) as unknown as z.ZodType<AdHocEncounterRow>;

// Endpoint input: the date window + one include<Layer> flag per layer, derived from the map.
export const AdHocEncountersInputSchema = datasetInputSchema(ENCOUNTER_LAYERS);
export type AdHocEncountersInput = DatasetInput<typeof ENCOUNTER_LAYERS>;

export const AdHocEncountersOutputSchema = z.object({
  encounters: z.array(AdHocEncounterRowSchema),
});
export type AdHocEncountersOutput = { encounters: AdHocEncounterRow[] };
