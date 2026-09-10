import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import {
  Appointment,
  Condition,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  FhirResource,
  Location,
  Medication,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Patient,
  Practitioner,
  Procedure,
  Resource,
  ServiceRequest,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { appointmentTypeForAppointment } from 'utils/lib/fhir/appointments';
import { DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO, DOCUMENT_REFERENCE_SUMMARY_FROM_CHAT } from 'utils/lib/fhir/constants';
import { dispositionCheckboxOptions } from 'utils/lib/fhir/disposition';
import {
  getDosageUnitsAndRouteOfMedication,
  getMedicationFromMA,
  getMedicationName,
  getNdcCodeFromMedication,
} from 'utils/lib/fhir/medication-administration';
import {
  getEmailForIndividual,
  getPatientFirstName,
  getPatientLastName,
  getPhoneNumberForIndividual,
  mapGenderToLabel,
} from 'utils/lib/fhir/patient';
import { isInHouseLabServiceRequest } from 'utils/lib/helpers/in-house-labs';
import { getVitalDTOCriticalityFromObservation } from 'utils/lib/helpers/vitals/utils';
import { celsiusToFahrenheit, roundTemperatureValue } from 'utils/lib/helpers/vitals/vitals-temperature.helper';
import { AdHocEncounterRow, AdHocEncountersInput } from 'utils/lib/types/adhoc/datasets/encounters';
import { VitalAlertCriticality, VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import {
  MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL,
} from 'utils/lib/types/api/medication-administration.constants';
import { CREATED_BY_SYSTEM } from 'utils/lib/types/common';
import { PATIENT_POINT_OF_DISCOVERY_URL } from 'utils/lib/types/constants';
import { getTimezone } from 'utils/lib/utils/scheduleUtils';
import { getVisitStatusHistory } from 'utils/lib/utils/visitUtils';
import {
  buildEncounterRowContext,
  fetchAppointmentReportResources,
  fetchScopedResources,
  resolveEncounterAppointment,
} from '../adhoc-report';
import { followUpTypeFromPerformerType } from '../chart-data';

let staffNameByEmail: Map<string, string> | undefined;

async function getStaffNameByEmail(oystehr: Oystehr): Promise<Map<string, string>> {
  if (staffNameByEmail) return staffNameByEmail;
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
    staffNameByEmail = map;
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

// Medication.batch.expirationDate is a FHIR dateTime and the app writes a full instant with the
// entry device's offset. An expiry is a calendar date, so take the date AS WRITTEN — converting the
// zone would move "2026-07-29T00:00:00.000+04:00" back to the 28th and report a wrong expiry.
const expiryDate = (value?: string): string | null => value?.slice(0, 10) ?? null;
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

const isActiveOrder = (sr: ServiceRequest): boolean => sr.status !== 'revoked' && sr.status !== 'entered-in-error';

const isLabOrder = (sr: ServiceRequest): boolean =>
  Boolean(sr.code?.coding?.some((c) => c.system?.includes('oystehr-lab-local-codes'))) ||
  isInHouseLabServiceRequest(sr) ||
  Boolean(sr.meta?.tag?.some((t) => t.code === 'generic-lab-order' || t.code === 'in-house-lab' || t.code === 'lab'));

const isImagingOrder = (sr: ServiceRequest): boolean => Boolean(sr.meta?.tag?.some((t) => t.code === 'radiology'));
const orderDisplay = (sr: ServiceRequest): string =>
  sr.code?.text || sr.code?.coding?.find((c) => c.display)?.display || sr.code?.coding?.[0]?.code || '';

export async function fetchAdHocEncounterRows(
  oystehr: Oystehr,
  params: AdHocEncountersInput
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
    includeIntake,
    includeDocuments,
  } = params;

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
  const observationsByEncounterId = new Map<string, Observation[]>();
  const serviceRequestsByEncounterId = new Map<string, ServiceRequest[]>();
  const resultsByEncounterId = new Map<string, DiagnosticReport[]>();
  const encounterConditionsByEncounterId = new Map<string, Condition[]>();
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
    if (includeCodes) {
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
    if (includeAi || includeDocuments) {
      indexByEncounter(
        await fetchScoped<DocumentReference>('DocumentReference', 'encounter', encRefs, [
          { name: '_elements', value: 'type,description,meta,context' },
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
      indexByEncounter(
        await fetchScoped<MedicationAdministration>('MedicationAdministration', 'context', encRefs),
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
    if (includeVitals || includeExamRos || includeIntake) {
      indexByEncounter(
        await fetchScoped<Observation>('Observation', 'encounter', encRefs),
        (o) => stripEnc(o.encounter?.reference),
        observationsByEncounterId
      );
    }
    if (includeLabs || includeImaging || includeDisposition || includeNursing) {
      indexByEncounter(
        await fetchScoped<ServiceRequest>('ServiceRequest', 'encounter', encRefs),
        (s) => stripEnc(s.encounter?.reference),
        serviceRequestsByEncounterId
      );
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
    if (includeIntake) {
      indexByEncounter(
        await fetchScoped<Condition>('Condition', 'encounter', encRefs),
        (c) => stripEnc(c.encounter?.reference),
        encounterConditionsByEncounterId
      );
    }
  }

  const hasChartTag = (resource: Resource, code: string): boolean =>
    Boolean(resource.meta?.tag?.some((tag) => tag.code === code));

  const resolveAppointment = (encounter: Encounter): Appointment | undefined =>
    resolveEncounterAppointment(encounter, appointmentMap, encounterById);

  const staffNames = await getStaffNameByEmail(oystehr);
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
  const rows: AdHocEncounterRow[] = [];

  for (const encounter of encounterById.values()) {
    const appointment = resolveAppointment(encounter);
    if (!appointment) continue;

    const {
      encounterType,
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

    let clinicOpenHours: number | null = null;

    const weekday =
      start && location
        ? DateTime.fromISO(start).setZone(timezoneForLocation(location)).toFormat('ccc').toLowerCase()
        : '';

    for (const h of location?.hoursOfOperation ?? []) {
      if (!weekday || !h.daysOfWeek?.includes(weekday as never) || !h.openingTime || !h.closingTime) continue;
      const hrs = DateTime.fromFormat(h.closingTime, 'HH:mm:ss').diff(
        DateTime.fromFormat(h.openingTime, 'HH:mm:ss'),
        'hours'
      ).hours;
      if (Number.isFinite(hrs) && hrs > 0) clinicOpenHours = (clinicOpenHours ?? 0) + hrs;
    }

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
      statusHistory: getVisitStatusHistory(encounter).map((entry) => ({
        status: entry.status,
        start: entry.period.start ?? null,
        end: entry.period.end ?? null,
      })),
      encounterType,
      reason: encounter.reasonCode?.[0]?.text || appointment.appointmentType?.text || '',
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
      registrationChannel,
      registeredBy,
      registeredByName,
    };

    if (includeCodes) {
      const icdCodes: string[] = [];
      const icdDisplays: string[] = [];
      const dxEntries = [...(encounter.diagnosis ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
      for (const dx of dxEntries) {
        const conditionId = dx.condition?.reference?.replace('Condition/', '');
        const condition = conditionId ? conditionById.get(conditionId) : undefined;
        const codings = condition?.code?.coding ?? [];
        const icdCoding = codings.find((c) => c.system?.toLowerCase().includes('icd-10')) ?? codings[0];
        const code = icdCoding?.code;
        if (code && !icdCodes.includes(code)) {
          icdCodes.push(code);
          icdDisplays.push(icdCoding?.display ?? condition?.code?.text ?? code);
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
      row.primaryIcd = icdCodes[0];
      row.primaryIcdDisplay = icdDisplays[0];
      row.cptCodes = cptCodes;
      row.cptDisplays = cptDisplays;
      row.emCode = emCode;
      row.emDisplay = emDisplay;
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
      const medications: string[] = [];
      const medicationIngredients: string[] = [];
      const medicationSources: ('eRx' | 'in-house')[] = [];
      const medicationCodes: string[] = [];
      const drugs: NonNullable<AdHocEncounterRow['drugs']> = [];
      const addMed = (
        display: string,
        source: 'eRx' | 'in-house',
        code?: string,
        detail?: Omit<NonNullable<AdHocEncounterRow['drugs']>[number], 'name' | 'source'>
      ): void => {
        if (!display) return;
        medications.push(display);
        medicationIngredients.push(normalizeDrugName(display));
        medicationSources.push(source);
        if (code) medicationCodes.push(code);
        drugs.push({
          name: display,
          source,
          dose: detail?.dose ?? null,
          units: detail?.units ?? null,
          route: detail?.route ?? null,
          ndc: detail?.ndc ?? null,
          lotNumber: detail?.lotNumber ?? null,
          expirationDate: detail?.expirationDate ?? null,
          manufacturer: detail?.manufacturer ?? null,
          administeredAt: detail?.administeredAt ?? null,
        });
      };

      for (const req of encounter.id ? medRequestsByEncounterId.get(encounter.id) ?? [] : []) {
        if (req.status === 'entered-in-error') continue;
        const coding = (req.medicationCodeableConcept?.coding ?? []).find(
          (c) => c.system === MEDICATION_DISPENSABLE_DRUG_ID
        );
        addMed(coding?.display || req.medicationCodeableConcept?.text || '', 'eRx', coding?.code);
      }

      for (const ma of encounter.id ? medAdminsByEncounterId.get(encounter.id) ?? [] : []) {
        if (ma.status === 'entered-in-error') continue;
        if (!hasChartTag(ma, MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE)) continue;
        const medication = getMedicationFromMA(ma);
        const name =
          getMedicationName(medication) ||
          ma.medicationCodeableConcept?.coding?.[0]?.display ||
          ma.medicationCodeableConcept?.text ||
          '';
        const dosage = getDosageUnitsAndRouteOfMedication(ma);
        addMed(name, 'in-house', undefined, {
          dose: dosage.dose ?? null,
          units: dosage.units ?? null,
          route: dosage.route ?? null,
          ndc: (medication ? getNdcCodeFromMedication(medication) : undefined) ?? null,
          lotNumber: medication?.batch?.lotNumber ?? null,
          expirationDate: expiryDate(medication?.batch?.expirationDate),
          manufacturer: medication?.manufacturer?.display ?? null,
          administeredAt: ma.effectiveDateTime ?? null,
        });
      }
      row.medications = medications;
      row.medicationIngredients = medicationIngredients;
      row.medicationSources = medicationSources;
      row.medicationCodes = medicationCodes;
      row.medicationCount = medications.length;
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

      // Reports what was flagged at the time of care. The chart re-derives from the current
      // thresholds instead, so the two can differ after a threshold change.
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
      row.weightKg =
        weightVal == null ? null : weightUnit.startsWith('lb') ? round1(weightVal * 0.453592) : round1(weightVal);

      const heightObs = latest('vital-height');
      const heightVal = qty(heightObs);
      const heightUnit = (heightObs?.valueQuantity?.unit || '').toLowerCase();
      row.heightCm =
        heightVal == null ? null : heightUnit.startsWith('in') ? round1(heightVal * 2.54) : round1(heightVal);

      row.bmi =
        row.weightKg && row.heightCm && row.heightCm > 0 ? round1(row.weightKg / (row.heightCm / 100) ** 2) : null;
    }

    if (includeLabs || includeImaging || includeDisposition || includeNursing) {
      const srs = (encounter.id ? serviceRequestsByEncounterId.get(encounter.id) ?? [] : []).filter(isActiveOrder);
      if (includeLabs) {
        const labOrders = srs.filter(isLabOrder).map(orderDisplay).filter(Boolean);
        row.labOrders = labOrders;
        row.labOrderCount = labOrders.length;
      }
      if (includeImaging) {
        const imagingOrders = srs.filter(isImagingOrder).map(orderDisplay).filter(Boolean);
        row.imagingOrders = imagingOrders;
        row.imagingOrderCount = imagingOrders.length;
      }
      if (includeNursing) {
        const nursingOrders = srs
          .filter((sr) => sr.meta?.tag?.some((t) => t.code?.includes('nursing')))
          .map(orderDisplay)
          .filter(Boolean);
        row.nursingOrders = nursingOrders;
        row.nursingOrderCount = nursingOrders.length;
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
      }
    }

    if (includeImmunizations) {
      type VaccineRecord = {
        name: string;
        status: 'administered' | 'partially-administered' | 'recorded';
        visDate: string | null;
        lotNumber: string | null;
        expirationDate: string | null;
      };

      const vaccines: VaccineRecord[] = [];

      for (const ma of encounter.id ? medAdminsByEncounterId.get(encounter.id) ?? [] : []) {
        if (!hasChartTag(ma, 'immunization')) continue;

        const status =
          ma.status === 'completed' ? 'administered' : ma.status === 'on-hold' ? 'partially-administered' : undefined;

        if (!status) continue;

        const medication = getMedicationFromMA(ma);

        const name =
          getMedicationName(medication) ||
          ma.medicationCodeableConcept?.coding?.[0]?.display ||
          ma.medicationCodeableConcept?.text ||
          '';
        if (!name) continue;

        const visDate = medication?.extension?.find((e) => e.url === VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL)
          ?.valueDate;

        vaccines.push({
          name,
          status,
          visDate: visDate ?? null,
          lotNumber: medication?.batch?.lotNumber ?? null,
          expirationDate: expiryDate(medication?.batch?.expirationDate),
        });
      }
      for (const ms of encounter.id ? medStatementsByEncounterId.get(encounter.id) ?? [] : []) {
        if (ms.status === 'entered-in-error' || !hasChartTag(ms, 'immunization')) continue;
        const containedMed = ms.contained?.find((c): c is Medication => c.resourceType === 'Medication');
        const name =
          ms.medicationCodeableConcept?.coding?.[0]?.display ||
          ms.medicationCodeableConcept?.text ||
          getMedicationName(containedMed) ||
          '';
        // Charted history, not an administration on this visit: no VIS and no vial of ours.
        if (name) vaccines.push({ name, status: 'recorded', visDate: null, lotNumber: null, expirationDate: null });
      }
      row.vaccines = vaccines;
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

    rows.push(row);
  }

  return rows;
}
