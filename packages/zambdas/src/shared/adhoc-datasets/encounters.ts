import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import {
  Appointment,
  ClinicalImpression,
  Communication,
  Condition,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  FhirResource,
  HealthcareService,
  Location,
  Medication,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  Provenance,
  QuestionnaireResponse,
  Resource,
  Schedule,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  appointmentTypeForAppointment,
  getAppointmentRoom,
  getCancellationReasonDisplay,
  getReasonForVisitAndAdditionalDetailsFromAppointment,
  getServiceCategoryCodeFromAppointment,
} from 'utils/lib/fhir/appointments';
import { DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO, DOCUMENT_REFERENCE_SUMMARY_FROM_CHAT } from 'utils/lib/fhir/constants';
import { dispositionCheckboxOptions, mapDispositionTypeToLabel } from 'utils/lib/fhir/disposition';
import { getPaymentVariantFromEncounter, PaymentVariant } from 'utils/lib/fhir/encounter';
import {
  extractExtensionValue,
  findExtensionIndex,
  getProviderNameWithProfession,
  isAppointmentLocked,
  isEncounterLocked,
} from 'utils/lib/fhir/helpers';
import {
  getCurrentOrderedByProviderId,
  getMedicationName,
  getPractitionerIdThatOrderedMedication,
  getProviderIdAndDateMedicationWasAdministered,
} from 'utils/lib/fhir/medication-administration';
import {
  getEmailForIndividual,
  getFullName,
  getPatientFirstName,
  getPatientLastName,
  getPhoneNumberForIndividual,
  mapGenderToLabel,
} from 'utils/lib/fhir/patient';
import { getAdmitterPractitionerId } from 'utils/lib/fhir/practitioners';
import { isIntakePaperworkQuestionnaireResponse } from 'utils/lib/fhir/questionnaires';
import { ORDER_TYPE_CODE_SYSTEM } from 'utils/lib/fhir/radiology';
import { makeVitalsObservationDTO } from 'utils/lib/fhir/vitals';
import { getProviderType } from 'utils/lib/helpers/helpers';
import { isInHouseLabServiceRequest } from 'utils/lib/helpers/in-house-labs';
import { formatScreeningQuestionValue } from 'utils/lib/helpers/screening-questions/screening-questions-formatting.helper';
import { getVitalDTOCriticalityFromObservation } from 'utils/lib/helpers/vitals/utils';
import { HeightMeasurement } from 'utils/lib/helpers/vitals/vitals-height.helper';
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  roundTemperatureValue,
} from 'utils/lib/helpers/vitals/vitals-temperature.helper';
import { isDotVisionScreeningEntry } from 'utils/lib/helpers/vitals/vitals-vision.helper';
import { kgToLbs } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { patientScreeningQuestionsConfig } from 'utils/lib/ottehr-config/screening-questions';
import { AdHocEncounterRow, AdHocEncountersInput } from 'utils/lib/types/adhoc/datasets/encounters';
import {
  VitalAlertCriticality,
  VitalBloodPressureObservationMethod,
  VitalFieldNames,
  VitalHeartbeatObservationMethod,
  VitalsOxygenSatObservationMethod,
  VitalTemperatureObservationMethod,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import {
  DispositionType,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  REFUSAL_OF_EMS_TRANSPORT_FIELD,
  VitalsObservationDTO,
  VitalsVisionObservationDTO,
} from 'utils/lib/types/api/chart-data/chart-data.types';
import { MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE } from 'utils/lib/types/api/medication-administration.constants';
import { PROVIDER_TYPE_VALUES } from 'utils/lib/types/api/practitioner.types';
import { ClosureType, CREATED_BY_SYSTEM, OVERRIDE_DATE_FORMAT } from 'utils/lib/types/common';
import { PATIENT_POINT_OF_DISCOVERY_URL } from 'utils/lib/types/constants';
import { PatientAccountAndCoverageResources } from 'utils/lib/types/data/account';
import {
  DISCHARGE_SUMMARY_CODE,
  INSURANCE_CARD_CODE,
  PATIENT_EDUCATION_DOC_TYPE_CODE,
  PHOTO_ID_CARD_CODE,
} from 'utils/lib/types/data/paperwork/paperwork.constants';
import { applyOverridesToDailySchedule, DOW, getScheduleExtension, getTimezone } from 'utils/lib/utils/scheduleUtils';
import { getVisitStatusHistory } from 'utils/lib/utils/visitUtils';
import {
  buildEncounterRowContext,
  fetchAppointmentReportResources,
  fetchScopedResources,
  resolveEncounterAppointment,
} from '../adhoc-report';
import {
  chartDataResourceHasMetaTagByCode,
  followUpTypeFromPerformerType,
  makeDispositionDTOFromFhirResources,
  makeProceduresDTOFromFhirResources,
} from '../chart-data';
import { mapChartResources } from '../chart-sections/map';
import { getOccupationalMedicineEmployerName, getVisitEmployerOrganizationId } from '../occupational-medicine-employer';
import { getPaperworkCompleteness } from '../paperwork-completeness';
import { resolveEncounterSignatures } from '../pdf/get-encounter-signatures';
import {
  erxDrugRecord,
  inHouseDrugRecord,
  radiologyStudyRecords,
  vaccineOrderRecord,
} from './encounter-clinical-orders';
import { EncounterOrderRecords, fetchEncounterOrders } from './encounter-orders';
import { fetchPatientAccounts } from './patient-accounts';

async function getStaffNameByEmail(oystehr: Oystehr): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const users = await oystehr.user.list();
    const pidByEmail = new Map<string, string>();
    const ids: string[] = [];
    for (const u of users) {
      const email = (u.email || '').toLowerCase().trim();
      const pid = u.profile?.startsWith('Practitioner/') ? u.profile.split('/')[1] : undefined;
      if (email && pid) {
        pidByEmail.set(email, pid);
        ids.push(pid);
      }
    }
    const nameById = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 80) {
      const bundle = await oystehr.fhir.search<Practitioner>({
        resourceType: 'Practitioner',
        params: [
          { name: '_id', value: ids.slice(i, i + 80).join(',') },
          { name: '_elements', value: 'id,name' },
          { name: '_count', value: '1000' },
        ],
      });
      for (const p of bundle.unbundle()) {
        const nm = `${p.name?.[0]?.given?.[0] || ''} ${p.name?.[0]?.family || ''}`.trim();
        if (p.id && nm) nameById.set(p.id, nm);
      }
    }
    for (const [email, pid] of pidByEmail) {
      const nm = nameById.get(pid);
      if (nm) map.set(email, nm);
    }
  } catch (e) {
    console.warn('adhoc-encounters: registrar name resolution failed, falling back to email', e);
    captureException(e);
  }
  return map;
}

const minutesBetween = (start?: string, end?: string): number | null => {
  if (!start || !end) return null;
  const m = Math.round(DateTime.fromISO(end).diff(DateTime.fromISO(start), 'minutes').minutes);
  return Number.isFinite(m) ? m : null;
};

const normalizeDrugName = (display: string): string => {
  const base = display
    .split(/\s+\d/)[0]
    .trim()
    .replace(/[\s,-]+$/, '');
  return base || display.trim();
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

const hasChartTag = (resource: Resource, code: string): boolean =>
  Boolean(resource.meta?.tag?.some((tag) => tag.code === code));

const practitionerDisplayName = (p?: Practitioner): string | null => {
  const nm = `${p?.name?.[0]?.given?.[0] || ''} ${p?.name?.[0]?.family || ''}`.trim();
  return nm || null;
};

const practitionerIdFromRef = (ref?: string): string | undefined =>
  ref?.startsWith('Practitioner/') ? ref.replace('Practitioner/', '') : undefined;

const conditionIdFromRef = (ref?: string): string | undefined =>
  ref?.startsWith('Condition/') ? ref.replace('Condition/', '') : undefined;

const SYSTOLIC_CODES = ['271649006', '8480-6'];
const DIASTOLIC_CODES = ['271650006', '8462-4'];

const VITAL_ALERT_FIELDS: Record<string, string> = {
  [VitalFieldNames.VitalTemperature]: 'temperatureF',
  [VitalFieldNames.VitalHeartbeat]: 'heartRate',
  [VitalFieldNames.VitalRespirationRate]: 'respirationRate',
  [VitalFieldNames.VitalOxygenSaturation]: 'oxygenSaturation',
  [VitalFieldNames.VitalBloodPressure]: 'bloodPressure',
  [VitalFieldNames.VitalWeight]: 'weightKg',
  [VitalFieldNames.VitalHeight]: 'heightCm',
};

// "Ask the patient" screening answers are chart-data Observations (makeObservationResource): code.text
// is the config field's fhirField; radio/select/text answers are valueString (the option's fhirValue
// or free text), yes/no answers valueBoolean, date answers valueDateTime, date ranges effectivePeriod.
const SCREENING_FIELD_BY_CODE = new Map(patientScreeningQuestionsConfig.fields.map((f) => [f.fhirField, f]));

const screeningAnswer = (o: Observation): { question: string; answer: string } | undefined => {
  const field = o.code?.text ? SCREENING_FIELD_BY_CODE.get(o.code.text) : undefined;

  if (!field) return undefined;

  // A date answer stays the ISO date as charted.
  if (o.valueDateTime) return { question: field.question, answer: o.valueDateTime };

  const raw =
    o.valueString ??
    o.valueBoolean ??
    (o.effectivePeriod ? [o.effectivePeriod.start ?? '', o.effectivePeriod.end ?? ''] : undefined);

  if (raw === undefined || raw === '') return undefined;

  // The chart's own formatter: option label, Yes / No, date range.
  const answer = formatScreeningQuestionValue(field.fhirField, raw);

  return answer ? { question: field.question, answer } : undefined;
};

const isActiveOrder = (sr: ServiceRequest): boolean => sr.status !== 'revoked' && sr.status !== 'entered-in-error';

const isLabOrder = (sr: ServiceRequest): boolean =>
  Boolean(sr.code?.coding?.some((c) => c.system?.includes('oystehr-lab-local-codes'))) ||
  isInHouseLabServiceRequest(sr) ||
  Boolean(sr.meta?.tag?.some((t) => t.code === 'generic-lab-order' || t.code === 'in-house-lab' || t.code === 'lab'));

const isImagingOrder = (sr: ServiceRequest): boolean => Boolean(sr.meta?.tag?.some((t) => t.code === 'radiology'));
const orderDisplay = (sr: ServiceRequest): string =>
  sr.code?.text || sr.code?.coding?.find((c) => c.display)?.display || sr.code?.coding?.[0]?.code || '';

const SIGNED_VISIT_STATUSES = ['completed', 'awaiting supervisor approval'];

const lastSignedAt = (history: ReturnType<typeof getVisitStatusHistory>): string | null => {
  let start: string | null = null;
  for (const entry of history) {
    if (SIGNED_VISIT_STATUSES.includes(entry.status)) start ??= entry.period.start ?? null;
    else start = null;
  }
  return start;
};

const knownValueOrNull = <T extends string>(allowed: readonly T[], value: string | undefined): T | null =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : null;

/**
 * Hours the clinic was open on the day `start` falls on, from a Schedule extension (closures and the day's
 * override applied, as slot generation applies them). 0 on a closed day; null when no schedule is set.
 */
const openHoursOnDay = (owner: Schedule | Location, start: string, timezone: string): number | null => {
  const scheduleExtension = getScheduleExtension(owner);

  if (!scheduleExtension?.schedule) return null;

  const day = DateTime.fromISO(start).setZone(timezone);

  if (!day.isValid) return null;

  const dayKey = day.toFormat(OVERRIDE_DATE_FORMAT);

  for (const closure of scheduleExtension.closures ?? []) {
    if (closure.type === ClosureType.OneDay && closure.start === dayKey) return 0;

    if (closure.type === ClosureType.Period) {
      const from = DateTime.fromFormat(closure.start, OVERRIDE_DATE_FORMAT, { zone: timezone }).startOf('day');
      const to = DateTime.fromFormat(closure.end, OVERRIDE_DATE_FORMAT, { zone: timezone }).endOf('day');

      if (day >= from && day <= to) return 0;
    }
  }

  const { dailySchedule } = applyOverridesToDailySchedule({
    from: day,
    scheduleOverrides: scheduleExtension.scheduleOverrides ?? {},
    dailySchedule: scheduleExtension.schedule,
    timezone,
  });

  const scheduleDay = dailySchedule[day.toFormat('cccc').toLowerCase() as DOW];

  if (!scheduleDay) return null;

  if (!scheduleDay.workingDay) return 0;

  // As slot generation reads it: a close of 0 after a later opening means midnight.
  const close = scheduleDay.close === 0 && scheduleDay.open !== 0 ? 24 : scheduleDay.close;

  return Math.max(0, close - scheduleDay.open);
};

const groupIdOf = (appointment: Appointment): string | undefined =>
  appointment.participant
    ?.find((p) => p.actor?.reference?.startsWith('HealthcareService/'))
    ?.actor?.reference?.replace('HealthcareService/', '');

const hasDocRefTypeCode = (docRef: DocumentReference, code: string): boolean =>
  docRef.status === 'current' && Boolean(docRef.type?.coding?.some((c) => c.code === code));

export async function fetchAdHocEncounterRows(
  oystehr: Oystehr,
  params: AdHocEncountersInput,
  options: { environment?: string } = {}
): Promise<AdHocEncounterRow[]> {
  const {
    dateRange,
    includeCodes,
    includeTiming,
    includeAi,
    includeMedications,
    includeVitals,
    includeLabs,
    includeImaging,
    includeImmunizations,
    includeDisposition,
    includeExamRos,
    includeResults,
    includeNursing,
    includeProcedures,
    includeSigning,
    includePaperwork,
    includeCharting,
    includeIntake,
    includeDocuments,
    includeEmployer,
  } = params;
  const environment = options.environment ?? '';

  // The main search stays LIGHT — only the bounded per-appointment resources (patient, location,
  // encounter, practitioner) ride along; every opt-in layer's heavier resources (Observations above
  // all) are pulled afterward in separate queries keyed by encounter id (fetchScoped below). Both the
  // main search and the layer searches run as async-bulk FHIR jobs, so neither is bounded by the
  // response-size cap. The Encounters dataset also walks Encounter:part-of so a follow-up encounter
  // resolves to its parent's appointment.
  type ReportResource = Appointment | Encounter | Patient | Location | Practitioner;
  const allResources = await fetchAppointmentReportResources<ReportResource>(oystehr, {
    dateRange,
    extraParams: [{ name: '_revinclude:iterate', value: 'Encounter:part-of' }],
  });

  const encounters = allResources.filter((r): r is Encounter => r.resourceType === 'Encounter');
  const appointmentMap = new Map<string, Appointment>();
  const patientMap = new Map<string, Patient>();
  const locationMap = new Map<string, Location>();
  const practitionerMap = new Map<string, Practitioner>();
  const conditionById = new Map<string, Condition>();
  const proceduresByEncounterId = new Map<string, Procedure[]>();
  const docRefsByEncounterId = new Map<string, DocumentReference[]>();
  const medRequestsByEncounterId = new Map<string, MedicationRequest[]>();
  const medAdminsByEncounterId = new Map<string, MedicationAdministration[]>();
  const medStatementsByEncounterId = new Map<string, MedicationStatement[]>();
  const medicationOrderResources: FhirResource[] = [];
  const observationsByEncounterId = new Map<string, Observation[]>();
  const serviceRequestsByEncounterId = new Map<string, ServiceRequest[]>();
  const radiologyRequestsByEncounterId = new Map<string, ServiceRequest[]>();

  const radiologyPool = {
    tasks: [] as Task[],
    diagnosticReports: [] as DiagnosticReport[],
    documentReferences: [] as DocumentReference[],
  };

  const resultsByEncounterId = new Map<string, DiagnosticReport[]>();
  const encounterConditionsByEncounterId = new Map<string, Condition[]>();
  const clinicalImpressionsByEncounterId = new Map<string, ClinicalImpression[]>();
  const instructionsByEncounterId = new Map<string, Communication[]>();
  const signatureProvenancesByEncounterId = new Map<string, Provenance[]>();
  const signerById = new Map<string, Practitioner>();
  const paperworkQrByEncounterId = new Map<string, QuestionnaireResponse>();
  const identityDocRefsByPatient = new Map<string, DocumentReference[]>();
  let ordersByEncounterId = new Map<string, EncounterOrderRecords>();
  let accountsByPatient = new Map<string, PatientAccountAndCoverageResources>();
  const visitEmployerOrgById = new Map<string, Organization>();
  const encounterById = new Map<string, Encounter>();

  for (const r of allResources) {
    switch (r.resourceType) {
      case 'Appointment':
        if (r.id) appointmentMap.set(`Appointment/${r.id}`, r);
        break;
      case 'Patient':
        if (r.id) patientMap.set(`Patient/${r.id}`, r);
        break;
      case 'Location':
        if (r.id) locationMap.set(`Location/${r.id}`, r);
        break;
      case 'Practitioner':
        if (r.id) practitionerMap.set(r.id, r);
        break;
      case 'Encounter':
        if (r.id) encounterById.set(r.id, r);
        break;
    }
  }

  // ---- Secondary fetches for the opt-in layers -----------------------------------------------
  // Each enabled layer's resources are pulled here (NOT as includes on the main search), scoped to
  // the encounter ids from the main pass, each as its own async-bulk job (no response-size cap).
  const encIds = Array.from(encounterById.keys());
  const encRefs = encIds.map((id) => `Encounter/${id}`);

  const fetchScoped = <T extends FhirResource>(
    resourceType: T['resourceType'],
    paramName: string,
    values: string[],
    extraParams: { name: string; value: string }[] = []
  ): Promise<T[]> => fetchScopedResources<T>(oystehr, resourceType, paramName, values, extraParams);

  const indexByEncounter = <T>(items: T[], encOf: (item: T) => string | undefined, map: Map<string, T[]>): void => {
    for (const item of items) {
      const encId = encOf(item);
      if (encId) map.set(encId, [...(map.get(encId) ?? []), item]);
    }
  };
  const stripEnc = (ref?: string): string | undefined => ref?.replace('Encounter/', '');

  if (encRefs.length) {
    // Procedures link their CPT codes (Procedure) and diagnoses (Condition) the same way the codes layer does.
    if (includeCodes || includeProcedures) {
      const dxIds = Array.from(
        new Set(
          encounters.flatMap((e) =>
            (e.diagnosis ?? []).map((d) => d.condition?.reference?.replace('Condition/', '')).filter(Boolean)
          )
        )
      ) as string[];
      const dxConditions = dxIds.length ? await fetchScoped<Condition>('Condition', '_id', dxIds) : [];
      for (const c of dxConditions) if (c.id) conditionById.set(c.id, c);
      indexByEncounter(
        await fetchScoped<Procedure>('Procedure', 'encounter', encRefs),
        (p) => stripEnc(p.encounter?.reference),
        proceduresByEncounterId
      );
    }
    if (includeAi || includeDocuments || includeCharting) {
      indexByEncounter(
        await fetchScoped<DocumentReference>('DocumentReference', 'encounter', encRefs, [
          { name: '_elements', value: 'type,description,meta,context,status' },
        ]),
        (d) => stripEnc(d.context?.encounter?.[0]?.reference),
        docRefsByEncounterId
      );
    }
    if (includeMedications) {
      indexByEncounter(
        await fetchScoped<MedicationRequest>('MedicationRequest', 'encounter', encRefs),
        (m) => stripEnc(m.encounter?.reference),
        medRequestsByEncounterId
      );
    }
    if (includeMedications || includeImmunizations) {
      // The in-house administration MedicationStatement has no encounter context — only partOf → MA —
      // so it rides along the MA search as a revinclude (the same way get-medication-orders reads it).
      // As get-medication-orders searches: the order's performers (who ordered / gave it) and its
      // MedicationRequest (the interactions checked at ordering) ride along.
      const maAndStatements = await fetchScoped<
        MedicationAdministration | MedicationStatement | MedicationRequest | Practitioner
      >(
        'MedicationAdministration',
        'context',
        encRefs,
        includeMedications
          ? [
              { name: '_revinclude', value: 'MedicationStatement:part-of' },
              { name: '_include', value: 'MedicationAdministration:performer' },
              { name: '_include', value: 'MedicationAdministration:request' },
            ]
          : []
      );

      medicationOrderResources.push(...maAndStatements);

      for (const r of maAndStatements) if (r.resourceType === 'Practitioner' && r.id) practitionerMap.set(r.id, r);

      indexByEncounter(
        maAndStatements.filter((r): r is MedicationAdministration => r.resourceType === 'MedicationAdministration'),
        (m) => stripEnc(m.context?.reference),
        medAdminsByEncounterId
      );
    }

    if (includeImmunizations) {
      indexByEncounter(
        await fetchScoped<MedicationStatement>('MedicationStatement', 'context', encRefs),
        (m) => stripEnc(m.context?.reference),
        medStatementsByEncounterId
      );
    }

    if (includeMedications || includeImmunizations) {
      // Names of the staff who ordered / administered, and the diagnosis each drug was given for.
      const practitionerIds = new Set<string>();
      const drugConditionIds = new Set<string>();

      for (const mas of medAdminsByEncounterId.values()) {
        for (const ma of mas) {
          for (const id of [
            getProviderIdAndDateMedicationWasAdministered(ma)?.administeredProviderId,
            getCurrentOrderedByProviderId(ma),
            getPractitionerIdThatOrderedMedication(ma),
          ]) {
            if (id) practitionerIds.add(id);
          }

          const dxId = conditionIdFromRef(ma.reasonReference?.[0]?.reference);

          if (dxId) drugConditionIds.add(dxId);
        }
      }

      for (const reqs of medRequestsByEncounterId.values()) {
        for (const req of reqs) {
          const id = practitionerIdFromRef(req.requester?.reference);
          if (id) practitionerIds.add(id);
        }
      }

      const missingPractitionerIds = Array.from(practitionerIds).filter((id) => !practitionerMap.has(id));

      for (const p of await fetchScoped<Practitioner>('Practitioner', '_id', missingPractitionerIds, [
        { name: '_elements', value: 'id,name' },
      ])) {
        if (p.id) practitionerMap.set(p.id, p);
      }

      const missingConditionIds = Array.from(drugConditionIds).filter((id) => !conditionById.has(id));

      for (const c of await fetchScoped<Condition>('Condition', '_id', missingConditionIds)) {
        if (c.id) conditionById.set(c.id, c);
      }

      // buildOrderPackage looks the order's patient and practitioners up among these.
      medicationOrderResources.push(...patientMap.values(), ...practitionerMap.values());
    }

    if (includeVitals || includeExamRos || includeIntake) {
      indexByEncounter(
        await fetchScoped<Observation>('Observation', 'encounter', encRefs),
        (o) => stripEnc(o.encounter?.reference),
        observationsByEncounterId
      );
    }
    if (includeVitals) {
      // Names of the staff who recorded vitals: each reading's performer.
      const authorIds = new Set<string>();

      for (const observations of observationsByEncounterId.values()) {
        for (const o of observations) {
          if (!o.meta?.tag?.some((t) => t.code?.startsWith('vital-'))) continue;
          const id = makeVitalsObservationDTO(o)?.authorId;
          if (id && !practitionerMap.has(id)) authorIds.add(id);
        }
      }

      for (const p of await fetchScoped<Practitioner>('Practitioner', '_id', Array.from(authorIds), [
        { name: '_elements', value: 'id,name' },
      ])) {
        if (p.id) practitionerMap.set(p.id, p);
      }
    }
    if (includeLabs || includeImaging || includeDisposition || includeNursing || includeProcedures) {
      indexByEncounter(
        await fetchScoped<ServiceRequest>('ServiceRequest', 'encounter', encRefs),
        (s) => stripEnc(s.encounter?.reference),
        serviceRequestsByEncounterId
      );
    }
    if (includeImaging) {
      // The radiology orders page's search (getRadiologyOrders), keyed by encounter. Cancelled (revoked)
      // orders are kept: the dataset lists them, the page does not.
      const radiology = await fetchScoped<ServiceRequest | Task | DiagnosticReport | DocumentReference | Practitioner>(
        'ServiceRequest',
        'encounter',
        encRefs,
        [
          { name: '_tag', value: `${ORDER_TYPE_CODE_SYSTEM}|radiology` },
          { name: '_revinclude', value: 'Task:based-on' },
          { name: '_revinclude', value: 'DiagnosticReport:based-on' },
          { name: '_revinclude', value: 'DocumentReference:related' },
          { name: '_include', value: 'ServiceRequest:requester' },
        ]
      );

      for (const r of radiology) {
        switch (r.resourceType) {
          case 'ServiceRequest':
            indexByEncounter([r], (sr) => stripEnc(sr.encounter?.reference), radiologyRequestsByEncounterId);
            break;
          case 'Task':
            radiologyPool.tasks.push(r);
            break;
          case 'DiagnosticReport':
            if (r.status !== 'entered-in-error') radiologyPool.diagnosticReports.push(r);
            break;
          case 'DocumentReference':
            radiologyPool.documentReferences.push(r);
            break;
          case 'Practitioner':
            if (r.id && !practitionerMap.has(r.id)) practitionerMap.set(r.id, r);
            break;
        }
      }
    }

    if (includeResults) {
      indexByEncounter(
        await fetchScoped<DiagnosticReport>('DiagnosticReport', 'encounter', encRefs, [
          { name: '_elements', value: 'code,status,meta,encounter' },
        ]),
        (d) => stripEnc(d.encounter?.reference),
        resultsByEncounterId
      );
    }

    if (includeIntake || includeCharting) {
      indexByEncounter(
        await fetchScoped<Condition>('Condition', 'encounter', encRefs),
        (c) => stripEnc(c.encounter?.reference),
        encounterConditionsByEncounterId
      );
    }

    if (includeCharting) {
      const [clinicalImpressions, instructions] = await Promise.all([
        fetchScoped<ClinicalImpression>('ClinicalImpression', 'encounter', encRefs),
        fetchScoped<Communication>('Communication', 'encounter', encRefs, [
          { name: '_tag', value: 'patient-instruction' },
        ]),
      ]);
      indexByEncounter(clinicalImpressions, (c) => stripEnc(c.encounter?.reference), clinicalImpressionsByEncounterId);
      indexByEncounter(instructions, (c) => stripEnc(c.encounter?.reference), instructionsByEncounterId);
    }

    if (includeSigning) {
      // The author (provider signed) and verifier (supervisor approved) Provenances getEncounterSignatures reads.
      const provenancesAndAgents = await fetchScoped<Provenance | Practitioner>('Provenance', 'target', encRefs, [
        { name: 'agent-role', value: 'author,verifier' },
        { name: '_include', value: 'Provenance:agent' },
      ]);
      for (const r of provenancesAndAgents) {
        if (r.resourceType === 'Practitioner') {
          if (r.id) signerById.set(r.id, r);
          continue;
        }
        for (const target of r.target ?? []) {
          const encId = target.reference?.startsWith('Encounter/') ? stripEnc(target.reference) : undefined;
          if (encId)
            signatureProvenancesByEncounterId.set(encId, [...(signatureProvenancesByEncounterId.get(encId) ?? []), r]);
        }
      }
    }

    if (includePaperwork) {
      // The tracking board's paperwork inputs: the visit's intake QuestionnaireResponse and the patient's
      // current Photo ID / insurance card DocumentReferences.
      const patientRefs = Array.from(patientMap.keys());

      const [questionnaireResponses, docRefs] = await Promise.all([
        fetchScoped<QuestionnaireResponse>('QuestionnaireResponse', 'encounter', encRefs),
        fetchScoped<DocumentReference>('DocumentReference', 'related', patientRefs, [
          { name: 'status', value: 'current' },
          { name: 'type', value: `${INSURANCE_CARD_CODE},${PHOTO_ID_CARD_CODE}` },
        ]),
      ]);

      for (const qr of questionnaireResponses) {
        const encId = stripEnc(qr.encounter?.reference);
        if (encId && isIntakePaperworkQuestionnaireResponse(qr)) paperworkQrByEncounterId.set(encId, qr);
      }

      for (const docRef of docRefs) {
        for (const related of docRef.context?.related ?? []) {
          const ref = related.reference;

          if (ref?.startsWith('Patient/'))
            identityDocRefsByPatient.set(ref, [...(identityDocRefsByPatient.get(ref) ?? []), docRef]);
        }
      }
    }

    if (includeEmployer) {
      // The visit details face sheet's inputs: the patient's account picture and, for pre-op visits, the
      // Organization the visit's employer selection points at.
      const visitEmployerOrgIds = Array.from(
        new Set(
          Array.from(encounterById.values())
            .map((encounter) => getVisitEmployerOrganizationId(encounter))
            .filter((id): id is string => !!id)
        )
      );

      const [accounts, visitEmployerOrgs] = await Promise.all([
        fetchPatientAccounts(oystehr, Array.from(patientMap.values())),
        fetchScoped<Organization>('Organization', '_id', visitEmployerOrgIds),
      ]);

      accountsByPatient = accounts;

      for (const org of visitEmployerOrgs) if (org.id) visitEmployerOrgById.set(org.id, org);
    }

    if (includeLabs || includeNursing) {
      ordersByEncounterId = await fetchEncounterOrders(oystehr, {
        encounters: Array.from(encounterById.values()),
        practitioners: Array.from(practitionerMap.values()),
        environment,
        includeLabs: !!includeLabs,
        includeNursing: !!includeNursing,
      });
    }
  }

  const resolveAppointment = (encounter: Encounter): Appointment | undefined =>
    resolveEncounterAppointment(encounter, appointmentMap, encounterById);

  const staffNames = await getStaffNameByEmail(oystehr);

  // Each location's Schedule, for the operating hours on the visit day.
  const scheduleByLocationId = new Map<string, Schedule>();

  for (const schedule of await fetchScoped<Schedule>(
    'Schedule',
    'actor',
    Array.from(locationMap.values())
      .filter((loc) => loc.id)
      .map((loc) => `Location/${loc.id}`)
  )) {
    const locationId = schedule.actor?.find((a) => a.reference?.startsWith('Location/'))?.reference?.split('/')[1];

    if (locationId && !scheduleByLocationId.has(locationId) && getScheduleExtension(schedule)) {
      scheduleByLocationId.set(locationId, schedule);
    }
  }

  // Visits booked through a provider group carry the group (HealthcareService) as a participant.
  const groupIds = Array.from(
    new Set(
      Array.from(appointmentMap.values())
        .map(groupIdOf)
        .filter((id): id is string => !!id)
    )
  );

  const groupNameById = new Map<string, string>();

  for (const group of await fetchScoped<HealthcareService>('HealthcareService', '_id', groupIds, [
    { name: '_elements', value: 'id,name' },
  ])) {
    if (group.id && group.name) groupNameById.set(group.id, group.name);
  }

  const tzByLocationId = new Map<string, string>();

  const timezoneForLocation = (loc: Location): string => {
    const key = loc.id ?? '';
    let tz = tzByLocationId.get(key);
    if (!tz) {
      tz = getTimezone(loc);
      tzByLocationId.set(key, tz);
    }
    return tz;
  };

  // Built once: the per-row mappers look related resources up in these.
  const allPractitioners = Array.from(practitionerMap.values());
  const allEncounters = Array.from(encounterById.values());

  // Only what buildOrderPackage reads for one order: its patient, its practitioners, its MedicationRequest and
  // its administration MedicationStatement — so mapping an order never scans every resource of the report.
  const medicationResourceByRef = new Map(medicationOrderResources.map((r) => [`${r.resourceType}/${r.id}`, r]));

  const statementByMaRef = new Map<string, MedicationStatement>();

  for (const r of medicationOrderResources) {
    if (r.resourceType !== 'MedicationStatement') continue;

    for (const part of r.partOf ?? []) if (part.reference) statementByMaRef.set(part.reference, r);
  }

  const orderResourcesOf = (ma: MedicationAdministration): FhirResource[] => {
    const refs = [
      ma.subject?.reference,
      ma.request?.reference,
      ...(ma.performer ?? []).map((p) => p.actor?.reference),
    ].filter((ref): ref is string => !!ref);
    const statement = statementByMaRef.get(`MedicationAdministration/${ma.id}`);
    return [
      ...refs.map((ref) => medicationResourceByRef.get(ref)).filter((r): r is FhirResource => !!r),
      ...(statement ? [statement] : []),
    ];
  };

  const rows: AdHocEncounterRow[] = [];

  for (const encounter of encounterById.values()) {
    const appointment = resolveAppointment(encounter);

    if (!appointment) continue;

    const {
      encounterType,
      isFollowUpRow,
      patient,
      locationRef,
      location,
      attendingId,
      attendingProvider,
      visitType,
      visitStatus,
      serviceCategory,
      address,
      start,
    } = buildEncounterRowContext(encounter, appointment, { encounterById, patientMap, locationMap, practitionerMap });

    // Operating hours live in the location's Schedule extension (the Schedule tab), not in
    // Location.hoursOfOperation, which nothing in the app reads.
    const clinicOpenHours =
      start && location
        ? openHoursOnDay(
            (location.id ? scheduleByLocationId.get(location.id) : undefined) ?? location,
            start,
            // The clinic's own timezone, as for the visit day everywhere else in the row.
            timezoneForLocation(location)
          )
        : null;

    const createdBy = appointment.meta?.tag?.find((t) => t.system === CREATED_BY_SYSTEM)?.display ?? '';

    const registrationChannel = createdBy.startsWith('Staff')
      ? 'Staff'
      : createdBy.startsWith('QR - Patient')
      ? 'Walk-in'
      : createdBy.startsWith('Patient')
      ? 'Self-scheduled'
      : 'Unknown';

    const registeredBy = createdBy.startsWith('Staff') ? createdBy.replace(/^Staff\s*/, '').trim() : 'Patient';

    const regEmail = registeredBy.includes('@')
      ? registeredBy
          .replace(/ via QRS$/, '')
          .trim()
          .toLowerCase()
      : '';

    const registeredByName = (regEmail && staffNames.get(regEmail)) || registeredBy;
    const locationId = locationRef ? locationRef.replace('Location/', '') : undefined;
    const statusHistory = getVisitStatusHistory(encounter);
    const currentStatusSince = statusHistory.at(-1)?.period.start ?? null;
    const intakePerformerId = getAdmitterPractitionerId(encounter);
    const reasonParts = getReasonForVisitAndAdditionalDetailsFromAppointment(appointment);
    const groupId = groupIdOf(appointment);
    const attendingPractitioner = attendingId ? practitionerMap.get(attendingId) : undefined;

    const row: AdHocEncounterRow = {
      appointmentId: appointment.id || '',
      encounterId: encounter.id,
      // RAW ISO instant — the server never zone-formats dates. The client dataset derives the
      // viewer-local yyyy-MM-dd day (and the tracking-board href) in the browser.
      date: start || null,
      startTime: start || '',
      visitType,
      appointmentType: appointmentTypeForAppointment(appointment),
      serviceCategory,
      visitStatus,
      statusHistory: statusHistory.map((entry) => ({
        status: entry.status,
        start: entry.period.start ?? null,
        end: entry.period.end ?? null,
      })),
      encounterType,
      // Reason for visit is the booking's free text (Appointment.description); appointmentType.text
      // is the booking KIND (walk-in / pre-book) and must never stand in for it.
      reason: appointment.description?.trim() || encounter.reasonCode?.[0]?.text || '',
      reasonForVisit: reasonParts.reasonForVisit ?? '',
      reasonDetails: reasonParts.additionalDetails ?? '',
      bookedAt: appointment.created ?? null,
      room: getAppointmentRoom(appointment) ?? '',
      group: groupId ? groupNameById.get(groupId) ?? '' : '',
      visitStatusSince: currentStatusSince,
      scheduledSlotMinutes: minutesBetween(appointment.start, appointment.end),
      patientId: patient?.id || '',
      firstName: patient ? getPatientFirstName(patient) || '' : '',
      lastName: patient ? getPatientLastName(patient) || '' : '',
      patientName: patient ? `${getPatientFirstName(patient)} ${getPatientLastName(patient)}`.trim() : '',
      dateOfBirth: patient?.birthDate || null,
      sex: patient?.gender ? mapGenderToLabel[patient.gender] ?? '' : '',
      city: address?.city || '',
      state: address?.state || '',
      zip: address?.postalCode || '',
      phone: (patient ? getPhoneNumberForIndividual(patient) : '') || '',
      email: (patient ? getEmailForIndividual(patient) : '') || '',
      source: patient?.extension?.find((e) => e.url === PATIENT_POINT_OF_DISCOVERY_URL)?.valueString || '',
      location: location?.name || 'Unknown',
      locationId,
      region: location?.address?.state || '',
      clinicOpenHours,
      attendingProvider,
      attendingProviderId: attendingId,
      attendingProviderType: knownValueOrNull(PROVIDER_TYPE_VALUES, getProviderType(attendingPractitioner)),
      intakePerformer:
        practitionerDisplayName(intakePerformerId ? practitionerMap.get(intakePerformerId) : undefined) ?? '',
      intakePerformerId,
      cancellationReason: appointment.cancelationReason?.coding?.[0]?.display ?? '',
      cancellationReasonDisplay: getCancellationReasonDisplay(appointment) ?? '',
      paymentVariant: knownValueOrNull(Object.values(PaymentVariant), getPaymentVariantFromEncounter(encounter)),
      registrationChannel,
      registeredBy,
      registeredByName,
    };

    if (includeCodes) {
      const icdCodes: string[] = [];
      const icdDisplays: string[] = [];
      let primaryIcd = '';
      let primaryIcdDisplay = '';
      const dxEntries = [...(encounter.diagnosis ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
      for (const dx of dxEntries) {
        const conditionId = dx.condition?.reference?.replace('Condition/', '');
        const condition = conditionId ? conditionById.get(conditionId) : undefined;
        const codings = condition?.code?.coding ?? [];
        const icdCoding = codings.find((c) => c.system?.toLowerCase().includes('icd-10')) ?? codings[0];
        const code = icdCoding?.code;
        const display = icdCoding?.display ?? condition?.code?.text ?? code;

        if (code && !icdCodes.includes(code)) {
          icdCodes.push(code);
          icdDisplays.push(display ?? code);
        }

        // The chart marks the primary diagnosis with rank 1 (DiagnosisDTO.isPrimary).
        if (code && dx.rank === 1 && !primaryIcd) {
          primaryIcd = code;
          primaryIcdDisplay = display ?? code;
        }
      }
      const cptCodes: string[] = [];
      const cptDisplays: string[] = [];
      let emCode: string | undefined;
      let emDisplay: string | undefined;
      for (const procedure of encounter.id ? proceduresByEncounterId.get(encounter.id) ?? [] : []) {
        const coding = procedure.code?.coding?.[0];
        const code = coding?.code;
        if (!code) continue;
        const display = coding?.display ?? procedure.code?.text ?? code;
        if (hasChartTag(procedure, 'em-code')) {
          if (!emCode) {
            emCode = code;
            emDisplay = display;
          }
        } else if (hasChartTag(procedure, 'cpt-code') && !cptCodes.includes(code)) {
          cptCodes.push(code);
          cptDisplays.push(display);
        }
      }
      row.icdCodes = icdCodes;
      row.icdDisplays = icdDisplays;
      row.primaryIcd = primaryIcd;
      row.primaryIcdDisplay = primaryIcdDisplay;
      row.cptCodes = cptCodes;
      row.cptDisplays = cptDisplays;
      row.emCode = emCode ?? '';
      row.emDisplay = emDisplay ?? '';
    }

    if (includeTiming) {
      const history = getVisitStatusHistory(encounter);

      const firstStart = (status: string): string | undefined =>
        history.find((e) => e.status === status)?.period?.start;

      const arrived = firstStart('arrived') ?? firstStart('ready');
      const intake = firstStart('intake');
      const provider = firstStart('provider');
      const discharged = firstStart('discharged') ?? firstStart('completed') ?? encounter.period?.end;

      let timeWithProviderMinutes: number | null = null;

      for (const entry of history) {
        if (entry.status !== 'provider' || !entry.period.start || !entry.period.end) continue;
        const mins = minutesBetween(entry.period.start, entry.period.end);
        if (mins != null && mins >= 0) timeWithProviderMinutes = (timeWithProviderMinutes ?? 0) + mins;
      }

      row.timeWithProviderMinutes = timeWithProviderMinutes;
      row.arrivedToProviderMinutes = minutesBetween(arrived, provider);
      row.arrivedToIntakeMinutes = minutesBetween(arrived, intake);
      row.intakeToProviderMinutes = minutesBetween(intake, provider);
      row.providerToDischargedMinutes = minutesBetween(provider, discharged);
      row.totalCycleMinutes = minutesBetween(arrived, discharged);

      row.onTime =
        appointmentTypeForAppointment(appointment) === 'pre-booked' && arrived && appointment.start
          ? DateTime.fromISO(arrived) <= DateTime.fromISO(appointment.start)
          : null;
    }

    if (includeAi) {
      const descriptions = (encounter.id ? docRefsByEncounterId.get(encounter.id) ?? [] : []).map((d) => d.description);
      const hasAudio = descriptions.includes(DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO);
      const hasChat = descriptions.includes(DOCUMENT_REFERENCE_SUMMARY_FROM_CHAT);

      row.aiType =
        hasAudio && hasChat
          ? 'ambient scribe & patient HPI chatbot'
          : hasAudio
          ? 'ambient scribe'
          : hasChat
          ? 'patient HPI chatbot'
          : '';
    }

    if (includeMedications) {
      const drugs: NonNullable<AdHocEncounterRow['drugs']> = [];
      const medicationCodes: string[] = [];

      for (const req of encounter.id ? medRequestsByEncounterId.get(encounter.id) ?? [] : []) {
        if (req.status === 'entered-in-error') continue;

        const erx = erxDrugRecord(req, practitionerMap);

        if (!erx) continue;

        drugs.push(erx.record);

        if (erx.code) medicationCodes.push(erx.code);
      }

      for (const ma of encounter.id ? medAdminsByEncounterId.get(encounter.id) ?? [] : []) {
        if (ma.status === 'entered-in-error') continue;

        if (!hasChartTag(ma, MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE)) continue;

        const record = inHouseDrugRecord(ma, orderResourcesOf(ma), conditionById);

        if (record) drugs.push(record);
      }
      row.medications = drugs.map((d) => d.name);
      row.medicationIngredients = drugs.map((d) => normalizeDrugName(d.name));
      row.medicationSources = drugs.map((d) => d.source);
      row.medicationCodes = medicationCodes;
      row.medicationCount = drugs.length;
      row.drugs = drugs;
    }

    if (includeVitals) {
      const obs = encounter.id ? observationsByEncounterId.get(encounter.id) ?? [] : [];
      const fieldCode = (o: Observation): string => o.meta?.tag?.find((t) => t.code?.startsWith('vital-'))?.code ?? '';

      const effectiveMillis = (o: Observation): number => {
        const ms = o.effectiveDateTime ? DateTime.fromISO(o.effectiveDateTime).toMillis() : NaN;
        return Number.isFinite(ms) ? ms : 0;
      };

      const chronological = (field: string): Observation[] =>
        obs.filter((o) => fieldCode(o) === field).sort((a, b) => effectiveMillis(a) - effectiveMillis(b));

      const latest = (field: string): Observation | undefined => chronological(field).at(-1);

      const qty = (o?: Observation): number | null =>
        typeof o?.valueQuantity?.value === 'number' ? o.valueQuantity.value : null;

      const toF = (o?: Observation): number | null => {
        const val = qty(o);
        if (val == null) return null;
        const unit = (o?.valueQuantity?.unit || o?.valueQuantity?.code || '').toUpperCase();
        return roundTemperatureValue(unit.startsWith('F') ? val : celsiusToFahrenheit(val));
      };

      row.temperatureF = toF(latest('vital-temperature'));

      // The chart stores °C, kg and cm; a reading charted in °F, lbs or inches is normalized first, so every
      // unit below is the same reading as the field it mirrors. The other units come from the chart's helpers.
      const celsiusOf = (o?: Observation): number | null => {
        const val = qty(o);
        if (val == null) return null;
        const unit = (o?.valueQuantity?.unit || o?.valueQuantity?.code || '').toUpperCase();
        return unit.startsWith('F') ? fahrenheitToCelsius(val) : val;
      };

      const roundedCelsius = (o?: Observation): number | null => {
        const celsius = celsiusOf(o);
        return celsius == null ? null : roundTemperatureValue(celsius);
      };

      row.temperatureC = roundedCelsius(latest('vital-temperature'));

      row.heartRate = qty(latest('vital-heartbeat'));
      row.respirationRate = qty(latest('vital-respiration-rate'));
      row.oxygenSaturation = qty(latest('vital-oxygen-sat'));

      const bpComp = (bpObs: Observation | undefined, codes: string[]): number | null => {
        const c = bpObs?.component?.find((cm) => cm.code?.coding?.some((cd) => cd.code && codes.includes(cd.code)));
        return typeof c?.valueQuantity?.value === 'number' ? c.valueQuantity.value : null;
      };

      const bp = latest('vital-blood-pressure');
      row.systolicBP = bpComp(bp, SYSTOLIC_CODES);
      row.diastolicBP = bpComp(bp, DIASTOLIC_CODES);

      const numbers = (values: (number | null)[]): number[] => values.filter((v): v is number => v != null);
      row.temperatureFReadings = numbers(chronological('vital-temperature').map(toF));
      row.temperatureCReadings = numbers(chronological('vital-temperature').map(roundedCelsius));
      row.heartRateReadings = numbers(chronological('vital-heartbeat').map(qty));
      row.respirationRateReadings = numbers(chronological('vital-respiration-rate').map(qty));
      row.oxygenSaturationReadings = numbers(chronological('vital-oxygen-sat').map(qty));

      const bpPairs = chronological('vital-blood-pressure')
        .map((o) => ({ systolic: bpComp(o, SYSTOLIC_CODES), diastolic: bpComp(o, DIASTOLIC_CODES) }))
        .filter((pair): pair is { systolic: number; diastolic: number } => {
          return pair.systolic != null && pair.diastolic != null;
        });

      row.systolicBPReadings = bpPairs.map((pair) => pair.systolic);
      row.diastolicBPReadings = bpPairs.map((pair) => pair.diastolic);

      const abnormalVitals: string[] = [];
      const criticalVitals: string[] = [];

      for (const [field, name] of Object.entries(VITAL_ALERT_FIELDS)) {
        const levels = chronological(field).map((o) => getVitalDTOCriticalityFromObservation(o));
        if (levels.some((level) => level != null)) abnormalVitals.push(name);
        if (levels.includes(VitalAlertCriticality.Critical)) criticalVitals.push(name);
      }

      row.abnormalVitals = abnormalVitals;
      row.criticalVitals = criticalVitals;

      const weightObs = latest('vital-weight');
      const weightVal = qty(weightObs);
      const weightUnit = (weightObs?.valueQuantity?.unit || '').toLowerCase();

      const weightInKg = weightVal == null ? null : weightUnit.startsWith('lb') ? weightVal * 0.453592 : weightVal;
      row.weightKg = weightInKg == null ? null : round1(weightInKg);
      row.weightLbs = weightInKg == null ? null : kgToLbs(weightInKg);

      const heightObs = latest('vital-height');
      const heightVal = qty(heightObs);
      const heightUnit = (heightObs?.valueQuantity?.unit || '').toLowerCase();

      const heightInCm = heightVal == null ? null : heightUnit.startsWith('in') ? heightVal * 2.54 : heightVal;
      row.heightCm = heightInCm == null ? null : round1(heightInCm);
      const height = heightInCm == null ? undefined : HeightMeasurement.fromCm(heightInCm);
      row.heightInches = height ? height.getInches() : null;
      row.heightFeetInches = height ? height.getFeetInchesLabel() : '';

      // How each reading was taken, vision and LMP — read with the chart's vitals DTO builder.
      const latestDto = (field: VitalFieldNames): VitalsObservationDTO | undefined => {
        const o = latest(field);
        return o ? makeVitalsObservationDTO(o) : undefined;
      };

      const methodOf = (dto: VitalsObservationDTO | undefined): string | undefined =>
        dto && 'observationMethod' in dto ? dto.observationMethod : undefined;

      row.temperatureMethod = knownValueOrNull(
        Object.values(VitalTemperatureObservationMethod),
        methodOf(latestDto(VitalFieldNames.VitalTemperature))
      );

      row.heartRateMethod = knownValueOrNull(
        Object.values(VitalHeartbeatObservationMethod),
        methodOf(latestDto(VitalFieldNames.VitalHeartbeat))
      );

      row.bloodPressureMethod = knownValueOrNull(
        Object.values(VitalBloodPressureObservationMethod),
        methodOf(latestDto(VitalFieldNames.VitalBloodPressure))
      );

      row.oxygenSaturationMethod = knownValueOrNull(
        Object.values(VitalsOxygenSatObservationMethod),
        methodOf(latestDto(VitalFieldNames.VitalOxygenSaturation))
      );

      const weightDto = latestDto(VitalFieldNames.VitalWeight);

      row.weightRefused =
        weightDto?.field === VitalFieldNames.VitalWeight && !!weightDto.extraWeightOptions?.includes('patient_refused');

      // A DOT vision screening is a separate entry on the same vital; the acuity reading is the latest other one.
      const vision = chronological(VitalFieldNames.VitalVision)
        .map((o) => makeVitalsObservationDTO(o))
        .filter(
          (dto): dto is VitalsVisionObservationDTO =>
            dto?.field === VitalFieldNames.VitalVision && !isDotVisionScreeningEntry(dto.dotVisionScreening)
        )
        .at(-1);

      row.visionLeftEye = vision?.leftEyeVisionText ?? '';
      row.visionRightEye = vision?.rightEyeVisionText ?? '';
      row.visionBothEyes = vision?.bothEyesVisionText ?? '';
      row.visionOptions = vision?.extraVisionOptions ?? [];

      const lmp = latestDto(VitalFieldNames.VitalLastMenstrualPeriod);
      const lmpDto = lmp?.field === VitalFieldNames.VitalLastMenstrualPeriod ? lmp : undefined;
      row.lastMenstrualPeriod = lmpDto?.value || null;
      row.lastMenstrualPeriodUnsure = lmpDto ? !!lmpDto.isUnsure : null;

      const dot = chronological(VitalFieldNames.VitalVision)
        .map((o) => makeVitalsObservationDTO(o))
        .filter(
          (dto): dto is VitalsVisionObservationDTO =>
            dto?.field === VitalFieldNames.VitalVision && isDotVisionScreeningEntry(dto.dotVisionScreening)
        )
        .at(-1)?.dotVisionScreening;
      row.dotHorizontalFieldLeftDegrees = dot?.horizontalFieldLeftDegrees ?? null;
      row.dotHorizontalFieldRightDegrees = dot?.horizontalFieldRightDegrees ?? null;
      row.dotCanRecognizeColors = dot?.canRecognizeColors ?? null;
      row.dotMonocularVision = dot?.hasMonocularVision ?? null;
      row.dotReferredToSpecialist = dot?.referredToSpecialist ?? null;
      row.dotReceivedReferralDocumentation = dot?.receivedDocumentation ?? null;

      // The vitals history names each reading's author as the chart does (getFullName of the performer).
      const vitalReadings = obs
        .filter((o) => fieldCode(o).length > 0)
        .sort((a, b) => effectiveMillis(a) - effectiveMillis(b));

      const recordedBy: string[] = [];

      for (const reading of vitalReadings) {
        const authorId = makeVitalsObservationDTO(reading)?.authorId;
        const author = authorId ? practitionerMap.get(authorId) : undefined;
        const name = author ? getFullName(author).trim() : '';
        if (name && !recordedBy.includes(name)) recordedBy.push(name);
      }

      row.vitalsRecordedBy = recordedBy;
      row.vitalsFirstRecordedAt = vitalReadings[0]?.effectiveDateTime ?? null;

      row.bmi =
        row.weightKg && row.heightCm && row.heightCm > 0 ? round1(row.weightKg / (row.heightCm / 100) ** 2) : null;
    }

    if (includeLabs || includeImaging || includeDisposition || includeNursing || includeProcedures) {
      const srs = (encounter.id ? serviceRequestsByEncounterId.get(encounter.id) ?? [] : []).filter(isActiveOrder);

      if (includeLabs) {
        const labOrders = srs.filter(isLabOrder).map(orderDisplay).filter(Boolean);
        row.labOrders = labOrders;
        row.labOrderCount = labOrders.length;
        const labTests = (encounter.id ? ordersByEncounterId.get(encounter.id)?.labTests : undefined) ?? [];
        row.labTests = labTests;
        row.labTestNames = labTests.map((test) => test.name);
        row.labNames = Array.from(new Set(labTests.map((test) => test.lab).filter(Boolean)));
        row.labResultComponents = Array.from(new Set(labTests.flatMap((test) => test.resultComponents)));
      }

      if (includeImaging) {
        const imagingOrders = srs.filter(isImagingOrder).map(orderDisplay).filter(Boolean);
        row.imagingOrders = imagingOrders;
        row.imagingOrderCount = imagingOrders.length;
        row.imagingStudies = radiologyStudyRecords({
          serviceRequests: encounter.id ? radiologyRequestsByEncounterId.get(encounter.id) ?? [] : [],
          tasks: radiologyPool.tasks,
          diagnosticReports: radiologyPool.diagnosticReports,
          documentReferences: radiologyPool.documentReferences,
          practitioners: allPractitioners,
          encounters: allEncounters,
          nameOf: orderDisplay,
        });
      }

      if (includeNursing) {
        const nursingOrders = srs
          .filter((sr) => sr.meta?.tag?.some((t) => t.code?.includes('nursing')))
          .map(orderDisplay)
          .filter(Boolean);
        row.nursingOrders = nursingOrders;
        row.nursingOrderCount = nursingOrders.length;
        row.nursingOrderDetails =
          (encounter.id ? ordersByEncounterId.get(encounter.id)?.nursingOrders : undefined) ?? [];
      }

      if (includeProcedures) {
        // As the tracking board and the chart's procedures section: completed procedure ServiceRequests,
        // mapped with the chart's DTO builder (CPT codes via supportingInfo, diagnoses via reasonReference).
        const procedureRequests = srs.filter(
          (sr) => sr.status === 'completed' && chartDataResourceHasMetaTagByCode(sr, 'procedure')
        );

        const procedures = procedureRequests.length
          ? makeProceduresDTOFromFhirResources(encounter, [
              ...procedureRequests,
              ...(encounter.id ? proceduresByEncounterId.get(encounter.id) ?? [] : []),
              ...Array.from(conditionById.values()),
            ]) ?? []
          : [];

        row.procedures = procedures.map((p) => ({
          type: p.procedureType ?? '',
          cptCodes: (p.cptCodes ?? []).map((c) => c.code).filter(Boolean),
          icdCodes: (p.diagnoses ?? []).map((d) => d.code).filter(Boolean),
          performedAt: p.procedureDateTime ?? null,
          performerType: p.performerType ?? '',
          bodySite: p.bodySite ?? '',
          bodySide: p.bodySide ?? '',
          technique: p.technique ?? [],
          medicationUsed: p.medicationUsed ?? '',
          timeSpent: p.timeSpent ?? '',
          complications: p.complications ?? '',
          patientResponse: p.patientResponse ?? '',
          consentObtained: p.consentObtained ?? null,
          specimenSent: p.specimenSent ?? null,
          documentedBy: p.documentedBy ?? '',
        }));

        row.procedureTypes = row.procedures.map((p) => p.type);
        row.procedureCount = row.procedures.length;
      }

      if (includeDisposition) {
        const followUpTypes = srs
          .filter((sr) => hasChartTag(sr, 'sub-follow-up'))
          .map((sr) => {
            const type = followUpTypeFromPerformerType(sr.performerType);
            if (!type) return '';
            return dispositionCheckboxOptions.find((o) => o.name === type)?.label ?? type;
          })
          .filter(Boolean);
        row.followUpTypes = followUpTypes;
        row.followUpCount = followUpTypes.length;
        row.dischargeDisposition =
          encounter.hospitalization?.dischargeDisposition?.coding?.[0]?.display ||
          encounter.hospitalization?.dischargeDisposition?.text ||
          '';

        // The chart's disposition, read with the chart's own DTO builder (Encounter.hospitalization + the
        // disposition-follow-up ServiceRequest).
        const disposition = makeDispositionDTOFromFhirResources(
          encounter,
          encounter.id ? serviceRequestsByEncounterId.get(encounter.id) ?? [] : []
        );

        const dispositionType = knownValueOrNull(
          Object.keys(mapDispositionTypeToLabel) as DispositionType[],
          disposition?.type
        );

        row.dispositionType = dispositionType;
        row.dispositionLabel = dispositionType ? mapDispositionTypeToLabel[dispositionType] : '';
        row.followUpInDays = disposition?.followUpIn ?? null;
        row.transferReason = disposition?.reason ?? '';
        row.transferSpecialty = disposition?.specialty ?? '';
        row.transferSpecialtyOther = disposition?.specialtyOther ?? '';
        row.dispositionLabServices = disposition?.labService ?? [];
        row.dispositionVirusTests = disposition?.virusTest ?? [];
        row.nothingToEatOrDrink = disposition?.[NOTHING_TO_EAT_OR_DRINK_FIELD] ?? false;
        row.refusalOfEmsTransport = disposition?.[REFUSAL_OF_EMS_TRANSPORT_FIELD] ?? false;
      }
    }

    if (includeImmunizations) {
      type VaccineRecord = NonNullable<AdHocEncounterRow['vaccines']>[number];

      const emptyVaccineDetail = {
        visDate: null,
        lotNumber: null,
        expirationDate: null,
        ndc: null,
        cvx: null,
        mvx: null,
        manufacturer: null,
        dose: null,
        units: null,
        route: null,
        bodySite: null,
        instructions: null,
        administeredAt: null,
        administeredBy: null,
        orderedAt: null,
        orderedBy: null,
        cptCodes: [] as string[],
      };

      const vaccines: VaccineRecord[] = [];
      const vaccinesNotGiven: NonNullable<AdHocEncounterRow['vaccinesNotGiven']> = [];

      for (const ma of encounter.id ? medAdminsByEncounterId.get(encounter.id) ?? [] : []) {
        if (ma.status === 'entered-in-error' || !hasChartTag(ma, 'immunization')) continue;

        const record = vaccineOrderRecord(ma);

        if (record && 'given' in record) {
          vaccines.push(record.given);
        } else if (record) {
          vaccinesNotGiven.push(record.notGiven);
        }
      }

      for (const ms of encounter.id ? medStatementsByEncounterId.get(encounter.id) ?? [] : []) {
        if (ms.status === 'entered-in-error' || !hasChartTag(ms, 'immunization')) continue;

        // An administration echo (partOf → MedicationAdministration) is already counted above.
        if (ms.partOf?.some((r) => r.reference?.startsWith('MedicationAdministration/'))) continue;

        const containedMed = ms.contained?.find((c): c is Medication => c.resourceType === 'Medication');

        const name =
          ms.medicationCodeableConcept?.coding?.[0]?.display ||
          ms.medicationCodeableConcept?.text ||
          getMedicationName(containedMed) ||
          '';

        // Charted history, not an administration on this visit: no VIS and no vial of ours.
        if (name) vaccines.push({ name, status: 'recorded', ...emptyVaccineDetail });
      }
      row.vaccines = vaccines;
      row.vaccinesNotGiven = vaccinesNotGiven;
      row.vaccineNames = Array.from(new Set([...vaccines, ...vaccinesNotGiven].map((v) => v.name)));
    }

    if (includeExamRos) {
      const obs = encounter.id ? observationsByEncounterId.get(encounter.id) ?? [] : [];

      const tagOf = (o: Observation, sys: string): string | undefined =>
        o.meta?.tag?.find((t) => t.system?.includes(sys))?.code;

      const rosFindings: string[] = [];
      const examSystems: string[] = [];
      const examFindings: string[] = [];

      for (const o of obs) {
        const rosTag = tagOf(o, 'ros-observation-field');
        if (rosTag && o.valueBoolean) {
          const state = rosTag.endsWith('-denies') ? 'Denies' : rosTag.endsWith('-reports') ? 'Reports' : '';
          const name = o.code?.text || o.code?.coding?.[0]?.display || rosTag;
          rosFindings.push(`${state} ${name}`.trim());
          continue;
        }
        // Mirror the ROS guard: a negated top-level exam statement (valueBoolean: false) is not a
        // charted finding and must not count. Observations without a top-level valueBoolean (the
        // component-carrying ones — makeExamObservationResource only sets it when the DTO value is
        // a boolean) still pass; their components are already filtered to positives at write time.
        if (tagOf(o, 'exam-observation-field') && o.valueBoolean !== false) {
          if (o.code?.text) examSystems.push(o.code.text);

          for (const c of o.component ?? []) {
            const code = c.code?.coding?.[0]?.code || c.code?.text;
            if (code) examFindings.push(code);
          }
        }
      }
      row.rosFindings = rosFindings;
      row.examSystems = Array.from(new Set(examSystems));
      row.examFindings = examFindings;
    }

    if (includeResults) {
      const drs = encounter.id ? resultsByEncounterId.get(encounter.id) ?? [] : [];
      const resultNames: string[] = [];
      let abnormalResultCount = 0;

      for (const dr of drs) {
        if (dr.status === 'entered-in-error' || dr.status === 'cancelled') continue;

        const name = dr.code?.coding?.find((c) => c.display)?.display || dr.code?.text || '';

        if (name) resultNames.push(name);

        if (dr.meta?.tag?.some((t) => t.code === 'abnormal' || t.code === 'inconclusive')) abnormalResultCount++;
      }

      row.resultNames = resultNames;
      row.resultCount = resultNames.length;
      row.abnormalResultCount = abnormalResultCount;
    }

    if (includeIntake) {
      const obs = encounter.id ? observationsByEncounterId.get(encounter.id) ?? [] : [];
      const asqObs = obs.find((o) => o.meta?.tag?.some((t) => t.code === 'asq'));
      row.asqScreen = asqObs?.valueString || asqObs?.valueCodeableConcept?.coding?.[0]?.code || '';
      const birthHistory: string[] = [];

      for (const o of obs) {
        if (!o.meta?.tag?.some((t) => t.code?.includes('birth'))) continue;
        const label = o.code?.text || o.code?.coding?.[0]?.display;
        if (label) birthHistory.push(label);
      }

      row.birthHistory = birthHistory;
      const screeningAnswers: { question: string; answer: string }[] = [];

      // Newest first, so a re-answered question keeps its latest answer.
      const byNewest = [...obs].sort((a, b) =>
        (b.effectiveDateTime ?? b.meta?.lastUpdated ?? '').localeCompare(
          a.effectiveDateTime ?? a.meta?.lastUpdated ?? ''
        )
      );

      for (const o of byNewest) {
        if (o.status === 'entered-in-error') continue;
        const entry = screeningAnswer(o);
        if (entry && !screeningAnswers.some((e) => e.question === entry.question)) screeningAnswers.push(entry);
      }
      row.screeningAnswers = screeningAnswers;
      row.screeningQuestions = screeningAnswers.map((e) => e.question);

      const accidentCond = (encounter.id ? encounterConditionsByEncounterId.get(encounter.id) ?? [] : []).find(
        (c) => c.meta?.tag?.some((t) => t.code === 'accident')
      );

      row.accidentType = accidentCond
        ? accidentCond.code?.coding?.[0]?.display ||
          accidentCond.code?.coding?.[0]?.code ||
          accidentCond.code?.text ||
          ''
        : '';
    }

    if (includeDocuments) {
      const docs = encounter.id ? docRefsByEncounterId.get(encounter.id) ?? [] : [];
      const workSchoolNotes: string[] = [];

      for (const d of docs) {
        const isSchoolWork =
          d.type?.coding?.some((c) => c.code === '47420-5') ||
          d.meta?.tag?.some((t) => t.system?.includes('school-work-note'));

        if (!isSchoolWork) continue;
        const typeTag = d.meta?.tag?.find((t) => t.system?.includes('school-work-note'))?.code;
        workSchoolNotes.push(typeTag || 'note');
      }

      row.workSchoolNotes = workSchoolNotes;
      row.workSchoolNoteCount = workSchoolNotes.length;
    }

    if (includeEmployer) {
      const account = patient?.id ? accountsByPatient.get(`Patient/${patient.id}`) : undefined;
      const visitEmployerOrgId = getVisitEmployerOrganizationId(encounter);

      row.occupationalMedicineEmployer =
        getOccupationalMedicineEmployerName({
          encounter,
          appointmentServiceCategory: getServiceCategoryCodeFromAppointment(appointment),
          occupationalMedicineEmployerOrganization: account?.occupationalMedicineEmployerOrganization,
          occupationalMedicineAccount: account?.occupationalMedicineAccount,
          visitEmployerOrganization: visitEmployerOrgId ? visitEmployerOrgById.get(visitEmployerOrgId) : undefined,
        }) ?? '';
    }

    if (includeSigning) {
      const signatures = resolveEncounterSignatures(
        encounter.id ? signatureProvenancesByEncounterId.get(encounter.id) ?? [] : [],
        signerById
      );

      const signed = SIGNED_VISIT_STATUSES.includes(visitStatus);
      const signedAt = signed ? signatures.signedBy?.dateTimeISO ?? lastSignedAt(statusHistory) : null;

      // The visit note prints the author Provenance's signer and falls back to the provider of the visit —
      // written the same way the Provenance signer is, so one provider is one value.
      const fallbackSigner = attendingPractitioner
        ? getProviderNameWithProfession(attendingPractitioner) || null
        : null;

      const dischargedAt = statusHistory.filter((entry) => entry.status === 'discharged').at(-1)?.period.start;
      const awaitingIndex = findExtensionIndex(encounter.extension ?? [], 'awaiting-supervisor-approval');
      row.signed = signed;
      row.signedAt = signedAt;
      row.signedBy = signed ? signatures.signedBy?.name || fallbackSigner : null;
      row.dischargedToSignedMinutes = signedAt ? minutesBetween(dischargedAt, signedAt) : null;
      row.awaitingSupervisorApproval =
        awaitingIndex >= 0 && extractExtensionValue(encounter.extension?.[awaitingIndex]) === true;
      row.supervisorApprovedBy = signatures.approvedBy?.name || null;
      row.supervisorApprovedAt = signatures.approvedBy?.dateTimeISO ?? null;

      // Follow-up encounters have no Appointment of their own, so their lock lives on the Encounter.
      row.locked = isFollowUpRow ? isEncounterLocked(encounter) : isAppointmentLocked(appointment);
    }

    if (includePaperwork) {
      const questionnaireResponse = encounter.id ? paperworkQrByEncounterId.get(encounter.id) : undefined;

      const paperwork = getPaperworkCompleteness({
        patient,
        encounter,
        questionnaireResponse,
        docRefs: patient?.id ? identityDocRefsByPatient.get(`Patient/${patient.id}`) ?? [] : [],
      });

      row.paperworkSubmittedAt = questionnaireResponse?.authored ?? null;
      row.demographicsComplete = paperwork.demographics;
      row.photoIdOnFile = paperwork.photoID;
      row.insuranceCardOnFile = paperwork.insuranceCard;
      row.consentComplete = paperwork.consent;

      row.consentMethod = paperwork.consentByPaperworkSignatures
        ? 'paperwork'
        : paperwork.consentByStaffAttestation
        ? 'staff attestation'
        : null;
    }

    if (includeCharting && encounter.id) {
      const chart = mapChartResources(
        encounter,
        [
          ...(encounterConditionsByEncounterId.get(encounter.id) ?? []),
          ...(clinicalImpressionsByEncounterId.get(encounter.id) ?? []),
          ...(instructionsByEncounterId.get(encounter.id) ?? []),
        ],
        encounter.id,
        { instructions: [] }
      );

      const docs = docRefsByEncounterId.get(encounter.id) ?? [];
      row.chiefComplaint = chart.chiefComplaint?.text ?? '';
      row.historyOfPresentIllness = chart.historyOfPresentIllness?.text ?? '';
      row.mechanismOfInjury = chart.mechanismOfInjury?.text ?? '';
      row.rosNote = chart.ros?.text ?? '';
      row.medicalDecision = chart.medicalDecision?.text ?? '';
      row.patientInstructions = (chart.instructions ?? []).map((i) => i.text ?? '').filter(Boolean);
      row.addendumNote = chart.addendumNote?.text ?? '';
      row.dischargeSummaryCreated = docs.some((d) => hasDocRefTypeCode(d, DISCHARGE_SUMMARY_CODE));
      row.patientEducationCount = docs.filter((d) => hasDocRefTypeCode(d, PATIENT_EDUCATION_DOC_TYPE_CODE)).length;
    }

    rows.push(row);
  }

  return rows;
}
