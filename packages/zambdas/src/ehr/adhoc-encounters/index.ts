import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  Condition,
  DocumentReference,
  Encounter,
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
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'adhoc-encounters';

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
    secrets,
  } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  type ReportResource =
    | Appointment
    | Encounter
    | Patient
    | Location
    | Practitioner
    | Condition
    | Procedure
    | DocumentReference
    | MedicationRequest
    | MedicationAdministration
    | MedicationStatement
    | Observation
    | ServiceRequest;
  let allResources: ReportResource[] = [];
  let offset = 0;
  const pageSize = 1000;

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

  if (includeCodes) {
    baseSearchParams.push(
      { name: '_include:iterate', value: 'Encounter:diagnosis' },
      { name: '_revinclude:iterate', value: 'Procedure:encounter' }
    );
  }
  if (includeAi) {
    baseSearchParams.push({ name: '_revinclude:iterate', value: 'DocumentReference:encounter' });
  }
  if (includeMedications) {
    // eRx prescriptions link via MedicationRequest.encounter.
    baseSearchParams.push({ name: '_revinclude:iterate', value: 'MedicationRequest:encounter' });
  }
  if (includeMedications || includeImmunizations) {
    // In-house administered meds AND immunizations are MedicationAdministrations linked via .context
    // (drug/vaccine name on a contained Medication); distinguished by meta tag when mapping.
    baseSearchParams.push({ name: '_revinclude:iterate', value: 'MedicationAdministration:context' });
  }
  if (includeImmunizations) {
    // Immunization history can also be charted as MedicationStatement (immunization tag) via .context.
    baseSearchParams.push({ name: '_revinclude:iterate', value: 'MedicationStatement:context' });
  }
  if (includeVitals) {
    // Pulls all encounter Observations; we filter to the vitals ones (vital-* tag) when mapping.
    baseSearchParams.push({ name: '_revinclude:iterate', value: 'Observation:encounter' });
  }
  if (includeLabs || includeImaging || includeDisposition) {
    // One revinclude covers labs, radiology, and disposition — all ServiceRequests, classified by tag/code.
    baseSearchParams.push({ name: '_revinclude:iterate', value: 'ServiceRequest:encounter' });
  }

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
  const vitalsByEncounterId = new Map<string, Observation[]>();
  const serviceRequestsByEncounterId = new Map<string, ServiceRequest[]>();
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
      case 'Condition':
        if (includeCodes && r.id) conditionById.set(r.id, r);
        break;
      case 'Procedure': {
        if (!includeCodes) break;
        const encId = r.encounter?.reference?.replace('Encounter/', '');
        if (encId) proceduresByEncounterId.set(encId, [...(proceduresByEncounterId.get(encId) ?? []), r]);
        break;
      }
      case 'DocumentReference': {
        if (!includeAi) break;
        const encId = r.context?.encounter?.[0]?.reference?.replace('Encounter/', '');
        if (encId) docRefsByEncounterId.set(encId, [...(docRefsByEncounterId.get(encId) ?? []), r]);
        break;
      }
      case 'MedicationRequest': {
        if (!includeMedications) break;
        const encId = r.encounter?.reference?.replace('Encounter/', '');
        if (encId) medRequestsByEncounterId.set(encId, [...(medRequestsByEncounterId.get(encId) ?? []), r]);
        break;
      }
      case 'MedicationAdministration': {
        if (!includeMedications && !includeImmunizations) break;
        const encId = r.context?.reference?.replace('Encounter/', '');
        if (encId) medAdminsByEncounterId.set(encId, [...(medAdminsByEncounterId.get(encId) ?? []), r]);
        break;
      }
      case 'MedicationStatement': {
        if (!includeImmunizations) break;
        const encId = r.context?.reference?.replace('Encounter/', '');
        if (encId) medStatementsByEncounterId.set(encId, [...(medStatementsByEncounterId.get(encId) ?? []), r]);
        break;
      }
      case 'Observation': {
        // Keep only vitals Observations (vital-* meta tag); ros/exam/ai observations are ignored here.
        if (!includeVitals || !r.meta?.tag?.some((t) => t.code?.startsWith('vital-'))) break;
        const encId = r.encounter?.reference?.replace('Encounter/', '');
        if (encId) vitalsByEncounterId.set(encId, [...(vitalsByEncounterId.get(encId) ?? []), r]);
        break;
      }
      case 'ServiceRequest': {
        if (!includeLabs && !includeImaging && !includeDisposition) break;
        const encId = r.encounter?.reference?.replace('Encounter/', '');
        if (encId) serviceRequestsByEncounterId.set(encId, [...(serviceRequestsByEncounterId.get(encId) ?? []), r]);
        break;
      }
    }
  }

  const hasChartTag = (resource: Resource, code: string): boolean =>
    Boolean(resource.meta?.tag?.some((tag) => tag.code === code));

  const resolveAppointment = (encounter: Encounter): Appointment | undefined => {
    const ownRef = encounter.appointment?.[0]?.reference;
    const own = ownRef ? appointmentMap.get(ownRef) : undefined;
    if (own) return own;
    const parentId = encounter.partOf?.reference?.replace('Encounter/', '');
    const parentRef = parentId ? encounterById.get(parentId)?.appointment?.[0]?.reference : undefined;
    return parentRef ? appointmentMap.get(parentRef) : undefined;
  };

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
    };

    if (includeCodes) {
      const icdCodes: string[] = [];
      const dxEntries = [...(encounter.diagnosis ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
      for (const dx of dxEntries) {
        const conditionId = dx.condition?.reference?.replace('Condition/', '');
        const condition = conditionId ? conditionById.get(conditionId) : undefined;
        const codings = condition?.code?.coding ?? [];
        const code = codings.find((c) => c.system?.toLowerCase().includes('icd-10'))?.code ?? codings[0]?.code;
        if (code && !icdCodes.includes(code)) icdCodes.push(code);
      }
      const cptCodes: string[] = [];
      let emCode: string | undefined;
      for (const procedure of encounter.id ? proceduresByEncounterId.get(encounter.id) ?? [] : []) {
        const code = procedure.code?.coding?.[0]?.code;
        if (!code) continue;
        if (hasChartTag(procedure, 'em-code')) emCode = emCode ?? code;
        else if (hasChartTag(procedure, 'cpt-code') && !cptCodes.includes(code)) cptCodes.push(code);
      }
      row.icdCodes = icdCodes;
      row.primaryIcd = icdCodes[0];
      row.cptCodes = cptCodes;
      row.emCode = emCode;
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
      const obs = encounter.id ? vitalsByEncounterId.get(encounter.id) ?? [] : [];
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

    if (includeLabs || includeImaging || includeDisposition) {
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

    rows.push(row);
  }

  const output: AdHocEncountersOutput = { encounters: rows };
  return { statusCode: 200, body: JSON.stringify(output) };
});
