import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Condition, Encounter, Location, Patient, Practitioner, Procedure, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getAttendingPractitionerId,
  getEncounterVisitType,
  getInPersonVisitStatus,
  getPatientFirstName,
  getPatientLastName,
  getVisitStatusHistory,
  IncompleteEncountersReportZambdaInput,
  IncompleteEncountersReportZambdaOutputSchema,
  isFollowupEncounter,
  isInPersonAppointment,
  isTelemedAppointment,
  OTTEHR_MODULE,
  Secrets,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { resolveEncounterAppointment } from '../../shared/adhoc-report';
import { validateOutputWithSchema } from '../../shared/validate-zod';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'incomplete-encounters-report';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters: IncompleteEncountersReportZambdaInput & { secrets: Secrets } =
    validateRequestParameters(input);
  const { dateRange, encounterStatus = 'incomplete', includeCodes = false, secrets } = validatedParameters;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // TODO: Once billable follow-up visits are available (with their own Appointment and full visit workflow),
  // ensure this report includes them as independent visits on their follow-up date.
  // Currently, follow-up encounters without their own Appointment are excluded from reports.

  console.log('Searching for appointments in date range:', dateRange);

  type ReportResource = Appointment | Encounter | Patient | Location | Practitioner | Condition | Procedure;
  let allResources: ReportResource[] = [];
  let offset = 0;
  const pageSize = 1000;

  const baseSearchParams = [
    {
      name: 'date',
      value: `ge${dateRange.start}`,
    },
    {
      name: 'date',
      value: `le${dateRange.end}`,
    },
    {
      // 'all' (ad-hoc reporting) also fetches cancelled/no-show visits so reports can see and
      // explicitly include or exclude them; the report pages keep the narrower set.
      name: 'status',
      value:
        encounterStatus === 'all'
          ? 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist,cancelled,noshow'
          : 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist',
    },
    {
      name: '_tag',
      value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}`,
    },
    {
      name: '_include',
      value: 'Appointment:patient',
    },
    {
      name: '_include',
      value: 'Appointment:location',
    },
    {
      name: '_revinclude',
      value: 'Encounter:appointment',
    },
    {
      name: '_include:iterate',
      value: 'Encounter:participant:Practitioner',
    },
    {
      name: '_sort',
      value: 'date',
    },
    {
      name: '_count',
      value: pageSize.toString(),
    },
  ];

  if (includeCodes) {
    // Join each encounter's charted codes: Encounter.diagnosis → Condition (ICD-10), and the
    // chart-data Procedure resources carrying the visit's CPT and E&M codes.
    baseSearchParams.push(
      { name: '_include:iterate', value: 'Encounter:diagnosis' },
      { name: '_revinclude:iterate', value: 'Procedure:encounter' }
    );
  }

  if (encounterStatus === 'all') {
    // Follow-up encounters (SNOMED 390906007) hang off the parent visit's encounter via partOf —
    // older ones carry no appointment reference at all, so they only come back via part-of.
    baseSearchParams.push({ name: '_revinclude:iterate', value: 'Encounter:part-of' });
  }

  let searchBundle = await oystehr.fhir.search<ReportResource>({
    resourceType: 'Appointment',
    params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
  });

  let pageCount = 1;
  console.log(`Fetching page ${pageCount} of incomplete encounters...`);

  let pageResources = searchBundle.unbundle();
  allResources = allResources.concat(pageResources);
  const pageAppointments = pageResources.filter(
    (resource): resource is Appointment => resource.resourceType === 'Appointment'
  );
  console.log(
    `Page ${pageCount}: Found ${pageResources.length} total resources (${pageAppointments.length} appointments)`
  );

  while (searchBundle.link?.find((link) => link.relation === 'next')) {
    offset += pageSize;
    pageCount++;
    console.log(`Fetching page ${pageCount} of incomplete encounters...`);

    searchBundle = await oystehr.fhir.search<ReportResource>({
      resourceType: 'Appointment',
      params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
    });

    pageResources = searchBundle.unbundle();
    allResources = allResources.concat(pageResources);
    const pageAppointmentsCount = pageResources.filter(
      (resource): resource is Appointment => resource.resourceType === 'Appointment'
    ).length;

    console.log(
      `Page ${pageCount}: Found ${pageResources.length} total resources (${pageAppointmentsCount} appointments)`
    );

    if (pageCount > 100) {
      console.warn('Reached maximum pagination limit (100 pages). Stopping search.');
      break;
    }
  }

  console.log(`Found ${allResources.length} total resources across ${pageCount} pages`);

  const encounters = allResources.filter((resource): resource is Encounter => resource.resourceType === 'Encounter');
  const appointments = allResources.filter(
    (resource): resource is Appointment => resource.resourceType === 'Appointment'
  );
  const patients = allResources.filter((resource): resource is Patient => resource.resourceType === 'Patient');
  const locations = allResources.filter((resource): resource is Location => resource.resourceType === 'Location');
  const practitioners = allResources.filter(
    (resource): resource is Practitioner => resource.resourceType === 'Practitioner'
  );

  console.log(
    `Encounters: ${encounters.length}, Appointments: ${appointments.length}, Patients: ${patients.length}, Locations: ${locations.length}, Practitioners: ${practitioners.length}`
  );

  const appointmentMap = new Map<string, Appointment>();
  appointments.forEach((apt) => {
    if (apt.id) {
      appointmentMap.set(`Appointment/${apt.id}`, apt);
    }
  });

  const patientMap = new Map<string, Patient>();
  patients.forEach((patient) => {
    if (patient.id) {
      patientMap.set(`Patient/${patient.id}`, patient);
    }
  });

  const locationMap = new Map<string, Location>();
  locations.forEach((location) => {
    if (location.id) {
      locationMap.set(`Location/${location.id}`, location);
    }
  });

  const practitionerMap = new Map<string, Practitioner>();
  practitioners.forEach((practitioner) => {
    if (practitioner.id) {
      practitionerMap.set(practitioner.id, practitioner);
    }
  });

  // Charted-code lookups (populated only when includeCodes was requested).
  const conditionById = new Map<string, Condition>();
  const proceduresByEncounterId = new Map<string, Procedure[]>();
  if (includeCodes) {
    for (const resource of allResources) {
      if (resource.resourceType === 'Condition' && resource.id) {
        conditionById.set(resource.id, resource);
      } else if (resource.resourceType === 'Procedure') {
        const encounterId = resource.encounter?.reference?.replace('Encounter/', '');
        if (!encounterId) continue;
        const list = proceduresByEncounterId.get(encounterId) ?? [];
        list.push(resource);
        proceduresByEncounterId.set(encounterId, list);
      }
    }
  }
  const hasChartTag = (resource: Resource, code: string): boolean =>
    Boolean(resource.meta?.tag?.some((tag) => tag.code === code));

  const encounterById = new Map<string, Encounter>();
  encounters.forEach((e) => {
    if (e.id) encounterById.set(e.id, e);
  });

  const resolveAppointment = (encounter: Encounter): Appointment | undefined =>
    resolveEncounterAppointment(encounter, appointmentMap, encounterById);

  const filteredEncounters = encounters.filter((encounter) => {
    // Follow-up encounters are separate rows in 'all' mode only; the report pages count visits,
    // not follow-ups (previously follow-ups that carried an appointment reference could leak in
    // as phantom rows).
    if (encounterStatus !== 'all' && isFollowupEncounter(encounter)) {
      return false;
    }

    const appointment = resolveAppointment(encounter);

    if (!appointment) {
      console.log(`No appointment found for encounter ${encounter.id}`);
      return false;
    }

    // 'all' → every encounter that has an appointment in range, regardless of visit status
    // (used by ad-hoc reporting, which wants the full dataset to slice however the user asks).
    if (encounterStatus === 'all') {
      return true;
    }

    const visitStatus = getInPersonVisitStatus(appointment, encounter, true);

    if (encounterStatus === 'complete') {
      return visitStatus === 'completed';
    }

    // Default: incomplete - exclude terminal states
    const terminalStates = ['completed', 'cancelled', 'no-show'];
    return !terminalStates.includes(visitStatus);
  });

  console.log(`Found ${filteredEncounters.length} ${encounterStatus} encounters`);

  const encounterItems = filteredEncounters.map((encounter) => {
    const appointment = resolveAppointment(encounter);
    const encounterType = encounterStatus === 'all' ? getEncounterVisitType(encounter) : undefined;
    const isFollowUpRow = encounterType === 'follow-up' || encounterType === 'scheduled-follow-up';
    // Some follow-up encounters carry no subject of their own — fall back to the parent's.
    const parentEncounter = encounter.partOf?.reference
      ? encounterById.get(encounter.partOf.reference.replace('Encounter/', ''))
      : undefined;
    const patientRef = encounter.subject?.reference ?? parentEncounter?.subject?.reference;
    const patient = patientRef ? patientMap.get(patientRef) : undefined;

    const locationRef = appointment?.participant?.find((p) => p.actor?.reference?.startsWith('Location/'))?.actor
      ?.reference;
    const location = locationRef ? locationMap.get(locationRef) : undefined;
    const locationName = location?.name || 'Unknown';
    const locationId = locationRef ? locationRef.replace('Location/', '') : undefined;

    const attendingPractitionerId = getAttendingPractitionerId(encounter);
    const attendingPractitioner = attendingPractitionerId ? practitionerMap.get(attendingPractitionerId) : undefined;
    const attendingProviderName = attendingPractitioner
      ? `${attendingPractitioner.name?.[0]?.given?.[0] || ''} ${attendingPractitioner.name?.[0]?.family || ''}`.trim()
      : 'Unknown';

    const visitType = isTelemedAppointment(appointment)
      ? 'Telemed'
      : isInPersonAppointment(appointment)
      ? 'In-Person'
      : 'Unknown';

    // Follow-up rows report their own encounter status — the parent appointment's visit-status
    // machinery doesn't apply to them.
    const visitStatus = isFollowUpRow
      ? encounter.status === 'finished'
        ? 'completed'
        : encounter.status
      : appointment
      ? getInPersonVisitStatus(appointment, encounter, true)
      : 'unknown';

    // Charted codes: ICD-10 diagnoses (primary first via Encounter.diagnosis rank), CPT codes,
    // and the E&M code from the chart-data Procedure resources.
    let icdCodes: string[] | undefined;
    let cptCodes: string[] | undefined;
    let emCode: string | undefined;
    if (includeCodes) {
      icdCodes = [];
      const dxEntries = [...(encounter.diagnosis ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
      for (const dx of dxEntries) {
        const conditionId = dx.condition?.reference?.replace('Condition/', '');
        const condition = conditionId ? conditionById.get(conditionId) : undefined;
        const codings = condition?.code?.coding ?? [];
        const code = codings.find((c) => c.system?.toLowerCase().includes('icd-10'))?.code ?? codings[0]?.code;
        if (code && !icdCodes.includes(code)) icdCodes.push(code);
      }
      cptCodes = [];
      for (const procedure of encounter.id ? proceduresByEncounterId.get(encounter.id) ?? [] : []) {
        const code = procedure.code?.coding?.[0]?.code;
        if (!code) continue;
        if (hasChartTag(procedure, 'em-code')) {
          emCode = emCode ?? code;
        } else if (hasChartTag(procedure, 'cpt-code') && !cptCodes.includes(code)) {
          cptCodes.push(code);
        }
      }
    }

    // Time actually spent with the provider: sum of CLOSED "provider" status periods from the
    // visit-status history. Open periods are excluded — an encounter that was never properly
    // closed out would otherwise report days-long "provider time".
    let timeWithProviderMinutes: number | undefined;
    for (const entry of getVisitStatusHistory(encounter)) {
      if (entry.status !== 'provider' || !entry.period.start || !entry.period.end) continue;
      const mins = Math.floor(
        DateTime.fromISO(entry.period.end).diff(DateTime.fromISO(entry.period.start), 'minutes').minutes
      );
      if (Number.isFinite(mins) && mins >= 0) {
        timeWithProviderMinutes = (timeWithProviderMinutes ?? 0) + mins;
      }
    }

    return {
      appointmentId: appointment?.id || '',
      encounterId: encounter.id,
      ...(encounterType ? { encounterType } : {}),
      patientId: patient?.id || '',
      patientName: patient ? `${getPatientFirstName(patient)} ${getPatientLastName(patient)}`.trim() : 'Unknown',
      dateOfBirth: patient?.birthDate || '',
      visitStatus,
      // Follow-up rows carry their OWN dates (the follow-up happened later than the parent visit).
      appointmentStart: (isFollowUpRow ? encounter.period?.start : appointment?.start) || '',
      appointmentEnd: (isFollowUpRow ? encounter.period?.end : appointment?.end) || '',
      location: locationName || 'Unknown',
      locationId,
      attendingProvider: attendingProviderName,
      visitType,
      reason: encounter.reasonCode?.[0]?.text || appointment?.appointmentType?.text || '',
      timeWithProviderMinutes,
      ...(includeCodes ? { icdCodes, cptCodes, emCode } : {}),
    };
  });

  // Validate the response against the endpoint's schema before it ships — a mapper drift fails loud
  // here (server-side log) instead of as a client-side parse error, and extra fields are stripped.
  const response = validateOutputWithSchema(
    IncompleteEncountersReportZambdaOutputSchema,
    {
      message: `Found ${encounterItems.length} ${encounterStatus} encounters`,
      encounters: encounterItems,
    },
    ZAMBDA_NAME
  );

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
