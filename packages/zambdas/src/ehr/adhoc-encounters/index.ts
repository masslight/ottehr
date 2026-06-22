import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
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
import {
  AdHocEncounterRow,
  AdHocEncountersOutput,
  appointmentTypeForAppointment,
  CREATED_BY_SYSTEM,
  DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO,
  DOCUMENT_REFERENCE_SUMMARY_FROM_CHAT,
  getAddressForIndividual,
  getAttendingPractitionerId,
  getEmailForIndividual,
  getEncounterVisitType,
  getInPersonVisitStatus,
  getMedicationFromMA,
  getMedicationName,
  getPatientFirstName,
  getPatientLastName,
  getPhoneNumberForIndividual,
  getVisitStatusHistory,
  isInPersonAppointment,
  isTelemedAppointment,
  mapGenderToLabel,
  MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  OTTEHR_MODULE,
  PATIENT_POINT_OF_DISCOVERY_URL,
  SERVICE_CATEGORY_SYSTEM,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { fetchScopedResources, resolveEncounterAppointment } from '../../shared/adhoc-report';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
// Registrar full names, keyed by lowercase staff login email. Built once per warm container from the
// IAM user list (email -> Practitioner profile -> name) — the same mapping the admin Employees page
// uses. Cached because it's stable and the lookup (user.list + Practitioner names) is not free.
let staffNameByEmail: Map<string, string> | undefined;

const ZAMBDA_NAME = 'adhoc-encounters';

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
  } catch (e) {
    console.warn('adhoc-encounters: registrar name resolution failed, falling back to email', e);
  }
  staffNameByEmail = map;
  return map;
}

const minutesBetween = (start?: string, end?: string): number | null => {
  if (!start || !end) return null;
  const m = Math.round(DateTime.fromISO(end).diff(DateTime.fromISO(start), 'minutes').minutes);
  return Number.isFinite(m) ? m : null;
};

// Normalize a prescribed-drug display to its base ingredient by dropping the strength/form tail
// (everything from the first digit on): "Amoxicillin 500 mg tablet" -> "Amoxicillin". Lets a report
// count "each drug" at ingredient grain instead of splitting one drug across strengths/forms.
const normalizeDrugName = (display: string): string => {
  const base = display
    .split(/\s+\d/)[0]
    .trim()
    .replace(/[\s,-]+$/, '');
  return base || display.trim();
};

const round1 = (n: number): number => Math.round(n * 10) / 10;
// Component codes used for blood-pressure (SNOMED + LOINC variants).
const SYSTOLIC_CODES = ['271649006', '8480-6'];
const DIASTOLIC_CODES = ['271650006', '8462-4'];

const isActiveOrder = (sr: ServiceRequest): boolean => sr.status !== 'revoked' && sr.status !== 'entered-in-error';
// A lab order: carries an Oystehr lab local code, or a lab order-type tag.
const isLabOrder = (sr: ServiceRequest): boolean =>
  Boolean(sr.code?.coding?.some((c) => c.system?.includes('oystehr-lab-local-codes'))) ||
  Boolean(sr.meta?.tag?.some((t) => t.code === 'generic-lab-order' || t.code === 'in-house-lab' || t.code === 'lab'));
// A radiology/imaging order: tagged radiology.
const isImagingOrder = (sr: ServiceRequest): boolean => Boolean(sr.meta?.tag?.some((t) => t.code === 'radiology'));
const orderDisplay = (sr: ServiceRequest): string =>
  sr.code?.text || sr.code?.coding?.find((c) => c.display)?.display || sr.code?.coding?.[0]?.code || '';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
    secrets,
  } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  // The main search returns only this bounded set; opt-in layer resources come from fetchScoped below.
  type ReportResource = Appointment | Encounter | Patient | Location | Practitioner;
  let allResources: ReportResource[] = [];
  let offset = 0;
  const pageSize = 1000;

  // The main search stays LIGHT — only the bounded per-appointment resources (patient, location,
  // encounter, practitioner) ride along, so a 1000-row page never approaches the FHIR response-size
  // cap (~6MB). Every opt-in layer's heavier resources (Observations above all) are pulled afterward
  // in separate, chunked queries keyed by encounter id (fetchScoped below) — the same approach the
  // codebase uses elsewhere for large Observation pulls.
  const baseSearchParams = [
    { name: 'date', value: `ge${dateRange.start}` },
    { name: 'date', value: `le${dateRange.end}` },
    // Full set (incl. cancelled / no-show) so a report can include or exclude them explicitly.
    { name: 'status', value: 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist,cancelled,noshow' },
    { name: '_tag', value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}` },
    { name: '_include', value: 'Appointment:patient' },
    { name: '_include', value: 'Appointment:location' },
    { name: '_revinclude', value: 'Encounter:appointment' },
    { name: '_include:iterate', value: 'Encounter:participant:Practitioner' },
    { name: '_revinclude:iterate', value: 'Encounter:part-of' },
    { name: '_sort', value: 'date' },
    { name: '_count', value: pageSize.toString() },
  ];

  let searchBundle = await oystehr.fhir.search<ReportResource>({
    resourceType: 'Appointment',
    params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
  });
  allResources = allResources.concat(searchBundle.unbundle());

  let pageCount = 1;
  while (searchBundle.link?.find((link) => link.relation === 'next')) {
    offset += pageSize;
    pageCount++;
    if (pageCount > 100) {
      console.warn('Reached maximum pagination limit (100 pages). Stopping search.');
      break;
    }
    searchBundle = await oystehr.fhir.search<ReportResource>({
      resourceType: 'Appointment',
      params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
    });
    allResources = allResources.concat(searchBundle.unbundle());
  }

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

  // ---- Secondary, chunked fetches for the opt-in layers --------------------------------------
  // Each enabled layer's resources are pulled here (NOT as includes on the main search), scoped to
  // the encounter ids from the main pass and chunked so no single response approaches the size cap.
  const encIds = Array.from(encounterById.keys());
  const encRefs = encIds.map((id) => `Encounter/${id}`);
  // Per-encounter layer resources are fetched via the shared scoped/paginated/chunked helper.
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
      // Trim the attachment payload — we only need type/description/tag/context, never the file bytes.
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
  const rows: AdHocEncounterRow[] = [];
  for (const encounter of encounters) {
    const appointment = resolveAppointment(encounter);
    if (!appointment) continue;

    const encounterType = getEncounterVisitType(encounter) ?? 'main';
    const isFollowUpRow = encounterType === 'follow-up' || encounterType === 'scheduled-follow-up';
    const parentEncounter = encounter.partOf?.reference
      ? encounterById.get(encounter.partOf.reference.replace('Encounter/', ''))
      : undefined;
    const patientRef = encounter.subject?.reference ?? parentEncounter?.subject?.reference;
    const patient = patientRef ? patientMap.get(patientRef) : undefined;

    const locationRef = appointment.participant?.find((p) => p.actor?.reference?.startsWith('Location/'))?.actor
      ?.reference;
    const location = locationRef ? locationMap.get(locationRef) : undefined;

    const attendingId = getAttendingPractitionerId(encounter);
    const attendingPractitioner = attendingId ? practitionerMap.get(attendingId) : undefined;
    const attendingProvider = attendingPractitioner
      ? `${attendingPractitioner.name?.[0]?.given?.[0] || ''} ${attendingPractitioner.name?.[0]?.family || ''}`.trim()
      : 'Unknown';

    const visitType = isTelemedAppointment(appointment)
      ? 'Telemed'
      : isInPersonAppointment(appointment)
      ? 'In-Person'
      : 'Unknown';

    const visitStatus = isFollowUpRow
      ? encounter.status === 'finished'
        ? 'completed'
        : encounter.status
      : getInPersonVisitStatus(appointment, encounter, true);

    const svcCoding = (appointment.serviceCategory ?? [])
      .flatMap((sc) => sc.coding ?? [])
      .find((c) => c.system === SERVICE_CATEGORY_SYSTEM);
    const serviceCategory = svcCoding?.display || svcCoding?.code || '';

    const address = patient ? getAddressForIndividual(patient) : undefined;
    const start = (isFollowUpRow ? encounter.period?.start : appointment.start) || '';

    // Hours the clinic is open on this visit's weekday (Location.hoursOfOperation).
    let clinicOpenHours: number | null = null;
    const weekday = start ? DateTime.fromISO(start).toFormat('ccc').toLowerCase() : '';
    for (const h of location?.hoursOfOperation ?? []) {
      if (!weekday || !h.daysOfWeek?.includes(weekday as never) || !h.openingTime || !h.closingTime) continue;
      const hrs = DateTime.fromFormat(h.closingTime, 'HH:mm:ss').diff(
        DateTime.fromFormat(h.openingTime, 'HH:mm:ss'),
        'hours'
      ).hours;
      // Skip malformed/overnight spans (close before open) so they don't corrupt the sum.
      if (Number.isFinite(hrs) && hrs > 0) clinicOpenHours = (clinicOpenHours ?? 0) + hrs;
    }

    // Registration channel + registrar from the appointment's created-by tag.
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

    const row: AdHocEncounterRow = {
      appointmentId: appointment.id || '',
      encounterId: encounter.id,
      date: start ? DateTime.fromISO(start).toFormat('yyyy-MM-dd') : '',
      visitType,
      appointmentType: appointmentTypeForAppointment(appointment),
      serviceCategory,
      visitStatus,
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
      locationId: locationRef ? locationRef.replace('Location/', '') : undefined,
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
      // On-time only meaningful for pre-booked visits: arrived at/ before the scheduled start.
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
      const medicationSources: string[] = [];
      const medicationCodes: string[] = [];
      const addMed = (display: string, source: string, code?: string): void => {
        if (!display) return;
        medications.push(display);
        medicationIngredients.push(normalizeDrugName(display));
        medicationSources.push(source);
        if (code) medicationCodes.push(code);
      };
      // eRx prescriptions (MedicationRequest, drug on medicationCodeableConcept). All statuses except
      // entered-in-error (FHIR's "this record was a mistake" tombstone).
      for (const req of encounter.id ? medRequestsByEncounterId.get(encounter.id) ?? [] : []) {
        if (req.status === 'entered-in-error') continue;
        const coding = (req.medicationCodeableConcept?.coding ?? []).find(
          (c) => c.system === MEDICATION_DISPENSABLE_DRUG_ID
        );
        addMed(coding?.display || req.medicationCodeableConcept?.text || '', 'eRx', coding?.code);
      }
      // In-house administered meds (MedicationAdministration / MAR; drug on a contained Medication).
      // Only the in-house-medication tag — vaccines (immunization tag) belong to the immunizations layer.
      for (const ma of encounter.id ? medAdminsByEncounterId.get(encounter.id) ?? [] : []) {
        if (ma.status === 'entered-in-error') continue;
        if (!hasChartTag(ma, MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE)) continue;
        const name =
          getMedicationName(getMedicationFromMA(ma)) ||
          ma.medicationCodeableConcept?.coding?.[0]?.display ||
          ma.medicationCodeableConcept?.text ||
          '';
        addMed(name, 'in-house');
      }
      row.medications = medications;
      row.medicationIngredients = medicationIngredients;
      row.medicationSources = medicationSources;
      row.medicationCodes = medicationCodes;
      row.medicationCount = medications.length;
    }

    if (includeVitals) {
      const obs = encounter.id ? observationsByEncounterId.get(encounter.id) ?? [] : [];
      // Last charted value wins per vital field.
      const fieldCode = (o: Observation): string => o.meta?.tag?.find((t) => t.code?.startsWith('vital-'))?.code ?? '';
      const latest = (field: string): Observation | undefined => obs.filter((o) => fieldCode(o) === field).at(-1);
      const qty = (o?: Observation): number | null =>
        typeof o?.valueQuantity?.value === 'number' ? o.valueQuantity.value : null;

      const tempObs = latest('vital-temperature');
      const tempVal = qty(tempObs);
      const tempUnit = (tempObs?.valueQuantity?.unit || tempObs?.valueQuantity?.code || '').toUpperCase();
      row.temperatureF =
        tempVal == null ? null : tempUnit.startsWith('F') ? round1(tempVal) : round1((tempVal * 9) / 5 + 32);

      row.heartRate = qty(latest('vital-heartbeat'));
      row.respirationRate = qty(latest('vital-respiration-rate'));
      row.oxygenSaturation = qty(latest('vital-oxygen-sat'));

      const bp = latest('vital-blood-pressure');
      const bpComp = (codes: string[]): number | null => {
        const c = bp?.component?.find((cm) => cm.code?.coding?.some((cd) => cd.code && codes.includes(cd.code)));
        return typeof c?.valueQuantity?.value === 'number' ? c.valueQuantity.value : null;
      };
      row.systolicBP = bpComp(SYSTOLIC_CODES);
      row.diastolicBP = bpComp(DIASTOLIC_CODES);

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
          .filter((sr) => hasChartTag(sr, 'disposition-follow-up'))
          .map(orderDisplay)
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
      const immunizations: string[] = [];
      for (const ma of encounter.id ? medAdminsByEncounterId.get(encounter.id) ?? [] : []) {
        if (ma.status === 'entered-in-error' || !hasChartTag(ma, 'immunization')) continue;
        const name =
          getMedicationName(getMedicationFromMA(ma)) ||
          ma.medicationCodeableConcept?.coding?.[0]?.display ||
          ma.medicationCodeableConcept?.text ||
          '';
        if (name) immunizations.push(name);
      }
      for (const ms of encounter.id ? medStatementsByEncounterId.get(encounter.id) ?? [] : []) {
        if (ms.status === 'entered-in-error' || !hasChartTag(ms, 'immunization')) continue;
        const containedMed = ms.contained?.find((c): c is Medication => c.resourceType === 'Medication');
        const name =
          ms.medicationCodeableConcept?.coding?.[0]?.display ||
          ms.medicationCodeableConcept?.text ||
          getMedicationName(containedMed) ||
          '';
        if (name) immunizations.push(name);
      }
      row.immunizations = immunizations;
      row.immunizationCount = immunizations.length;
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
        if (tagOf(o, 'exam-observation-field')) {
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

  const output: AdHocEncountersOutput = { encounters: rows };
  return { statusCode: 200, body: JSON.stringify(output) };
});
