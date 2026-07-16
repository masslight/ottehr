import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Communication, Patient, Practitioner, Provenance } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  FAX_LOGS_DISPLAY_WINDOW_DAYS,
  FAX_SENT_PROVENANCE_ACTIVITY_CODING,
  FaxLogEntry,
  FaxLogStatus,
  GetFaxLogsInputValidated,
  GetFaxLogsOutput,
  getFormattedPatientFullName,
  getFullName,
  OYSTEHR_FAX_COMMUNICATION_IDENTIFIER_SYSTEM,
  OYSTEHR_OUTBOUND_FAX_STATUS_CODES,
  OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-fax-logs';

// Per-request caps that keep search URLs bounded; batches iterate so no results are dropped.
const COMMUNICATION_ID_BATCH_SIZE = 100;
const REFERENCE_CHUNK_SIZE = 50;
const SEARCH_PAGE_SIZE = 1000;

const FAX_INCLUDE_PARAMS: SearchParam[] = [
  { name: '_include', value: 'Communication:subject' },
  { name: '_revinclude', value: 'Provenance:target' },
  // pulls in the Appointments the fax Provenances point at
  { name: '_include:iterate', value: 'Provenance:target' },
];

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  console.groupEnd();
  const { secrets, ...loggableParameters } = validatedParameters;
  console.debug('validateRequestParameters success', JSON.stringify(loggableParameters));

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  console.group('performEffect');
  const output = await performEffect(validatedParameters, oystehr);
  console.groupEnd();
  console.debug('performEffect success', `returned ${output.logs.length} of ${output.totalCount} logs`);

  return {
    statusCode: 200,
    body: JSON.stringify(output),
  };
});

const performEffect = async (input: GetFaxLogsInputValidated, oystehr: Oystehr): Promise<GetFaxLogsOutput> => {
  const { patientId, patientName, visitId, visitDate, pageIndex, itemsPerPage } = input;
  const filterParams = buildFaxFilterParams(patientId, patientName);

  // The fax Communication carries no appointment link — that lives on the Provenance created by
  // send-fax — so visit filters are resolved to Communication ids first and paged in memory.
  if (visitId || visitDate) {
    const communicationIds = await findFaxCommunicationIdsForVisits(oystehr, visitId, visitDate);
    if (communicationIds.length === 0) {
      return { logs: [], totalCount: 0 };
    }
    return getFaxLogsPageByIds(oystehr, communicationIds, filterParams, pageIndex, itemsPerPage);
  }

  const params: SearchParam[] = [
    ...filterParams,
    { name: '_total', value: 'accurate' },
    { name: '_count', value: itemsPerPage.toString() },
    { name: '_offset', value: (pageIndex * itemsPerPage).toString() },
    // _id tiebreaker keeps pagination stable when faxes share the same sent timestamp
    { name: '_sort', value: '-sent,-_id' },
    ...FAX_INCLUDE_PARAMS,
  ];
  if (!patientName) {
    // Older faxes are stored but not displayed by default; any search reaches them.
    const displayWindowStart = DateTime.now().minus({ days: FAX_LOGS_DISPLAY_WINDOW_DAYS }).toUTC().toISO();
    params.push({ name: 'sent', value: `ge${displayWindowStart}` });
  }

  const bundle = await oystehr.fhir.search<Appointment | Communication | Patient | Provenance>({
    resourceType: 'Communication',
    params,
  });
  const logs = composeFaxLogEntries(bundle.unbundle());

  return { logs, totalCount: bundle.total ?? 0 };
};

const buildFaxFilterParams = (patientId: string | undefined, patientName: string | undefined): SearchParam[] => {
  const params: SearchParam[] = [{ name: 'identifier', value: `${OYSTEHR_FAX_COMMUNICATION_IDENTIFIER_SYSTEM}|` }];
  if (patientId) {
    params.push({ name: 'subject', value: `Patient/${patientId}` });
  }
  if (patientName) {
    params.push({ name: 'subject:Patient.name', value: patientName });
  }
  return params;
};

/** Resolves visit filters to the ids of fax Communications recorded for the matching appointments. */
const findFaxCommunicationIdsForVisits = async (
  oystehr: Oystehr,
  visitId: string | undefined,
  visitDate: string | undefined
): Promise<string[]> => {
  let appointmentIds: string[];
  if (visitId && !visitDate) {
    appointmentIds = [visitId];
  } else {
    appointmentIds = [];
    for (let offset = 0; ; offset += SEARCH_PAGE_SIZE) {
      const params: SearchParam[] = [
        { name: '_count', value: SEARCH_PAGE_SIZE.toString() },
        { name: '_offset', value: offset.toString() },
      ];
      if (visitId) params.push({ name: '_id', value: visitId });
      if (visitDate) params.push({ name: 'date', value: visitDate });
      const page = (await oystehr.fhir.search<Appointment>({ resourceType: 'Appointment', params })).unbundle();
      appointmentIds.push(...page.map((appointment) => appointment.id).filter((id): id is string => Boolean(id)));
      if (page.length < SEARCH_PAGE_SIZE) break;
    }
  }

  const communicationIds = new Set<string>();
  for (let i = 0; i < appointmentIds.length; i += REFERENCE_CHUNK_SIZE) {
    const chunk = appointmentIds.slice(i, i + REFERENCE_CHUNK_SIZE);
    const provenances = (
      await oystehr.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [
          { name: 'target', value: chunk.map((id) => `Appointment/${id}`).join(',') },
          { name: '_count', value: SEARCH_PAGE_SIZE.toString() },
        ],
      })
    ).unbundle();
    provenances.filter(isFaxSentProvenance).forEach((provenance) => {
      const communicationId = findTargetId(provenance, 'Communication');
      if (communicationId) communicationIds.add(communicationId);
    });
  }
  return [...communicationIds];
};

/**
 * Pages through an arbitrarily long id list: filters/sorts the matching Communications in id-sized
 * batches (server-side pagination can't be combined with an unbounded _id list), then fetches only
 * the requested page with its includes.
 */
const getFaxLogsPageByIds = async (
  oystehr: Oystehr,
  communicationIds: string[],
  filterParams: SearchParam[],
  pageIndex: number,
  itemsPerPage: number
): Promise<GetFaxLogsOutput> => {
  const matching: Communication[] = [];
  for (let i = 0; i < communicationIds.length; i += COMMUNICATION_ID_BATCH_SIZE) {
    const chunk = communicationIds.slice(i, i + COMMUNICATION_ID_BATCH_SIZE);
    const batch = (
      await oystehr.fhir.search<Communication>({
        resourceType: 'Communication',
        params: [
          ...filterParams,
          { name: '_id', value: chunk.join(',') },
          { name: '_count', value: COMMUNICATION_ID_BATCH_SIZE.toString() },
        ],
      })
    ).unbundle();
    matching.push(...batch.filter(isFaxCommunication));
  }
  // newest first with id tiebreaker, mirroring the '-sent,-_id' sort of the single-query path
  matching.sort((a, b) => (b.sent ?? '').localeCompare(a.sent ?? '') || (b.id ?? '').localeCompare(a.id ?? ''));

  const pageCommunications = matching.slice(pageIndex * itemsPerPage, (pageIndex + 1) * itemsPerPage);
  if (pageCommunications.length === 0) {
    return { logs: [], totalCount: matching.length };
  }

  const bundle = await oystehr.fhir.search<Appointment | Communication | Patient | Provenance>({
    resourceType: 'Communication',
    params: [
      { name: '_id', value: pageCommunications.map((communication) => communication.id).join(',') },
      { name: '_count', value: itemsPerPage.toString() },
      ...FAX_INCLUDE_PARAMS,
    ],
  });
  const logs = composeFaxLogEntries(bundle.unbundle());
  // bundle order is not guaranteed — restore the sorted page order
  const order = new Map(pageCommunications.map((communication, index) => [communication.id, index]));
  logs.sort((a, b) => (order.get(a.communicationId) ?? 0) - (order.get(b.communicationId) ?? 0));

  return { logs, totalCount: matching.length };
};

const composeFaxLogEntries = (resources: (Appointment | Communication | Patient | Provenance)[]): FaxLogEntry[] => {
  const communications = resources.filter(
    (resource): resource is Communication => resource.resourceType === 'Communication' && isFaxCommunication(resource)
  );
  const patients = resources.filter((resource): resource is Patient => resource.resourceType === 'Patient');
  const appointments = resources.filter((resource): resource is Appointment => resource.resourceType === 'Appointment');
  const faxProvenances = resources.filter(isFaxSentProvenance);

  return communications.map((communication) => {
    const patientId = communication.subject?.reference?.split('/')[1];
    const patient = patients.find((candidate) => candidate.id === patientId);
    const faxNumber = getFaxNumberFromCommunication(communication);

    const provenance = faxProvenances.find(
      (candidate) =>
        communication.id !== undefined &&
        candidate.target.some((target) => referenceMatches(target.reference, 'Communication', communication.id!))
    );
    const appointmentId = provenance && findTargetId(provenance, 'Appointment');
    const appointment = appointments.find((candidate) => candidate.id === appointmentId);

    return {
      communicationId: communication.id!,
      status: getFaxStatus(communication),
      sentAt: communication.sent,
      faxNumber,
      patientId,
      patientName: patient && getFormattedPatientFullName(patient, { skipNickname: true }),
      recipientName: patient && faxNumber ? findRecipientNameByFaxNumber(patient, faxNumber) : undefined,
      appointmentId,
      visitDate: appointment?.start,
    };
  });
};

const getFaxStatus = (communication: Communication): FaxLogStatus => {
  const statusCode = communication.extension
    ?.find((extension) => extension.url === OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL)
    ?.valueCodeableConcept?.coding?.[0]?.code?.toUpperCase();
  if (statusCode === OYSTEHR_OUTBOUND_FAX_STATUS_CODES.delivered) return 'sent';
  if (statusCode === OYSTEHR_OUTBOUND_FAX_STATUS_CODES.stopped) return 'failed';
  if (!statusCode && communication.status === 'completed') return 'sent';
  return 'pending';
};

/** send-fax sends by recipientNumber, so the fax service stores the recipient as a contained Practitioner. */
const getFaxNumberFromCommunication = (communication: Communication): string | undefined => {
  const recipientReference = communication.recipient?.[0]?.reference;
  if (!recipientReference?.startsWith('#')) return undefined;
  const contained = communication.contained?.find((resource) => resource.id === recipientReference.slice(1));
  if (contained?.resourceType !== 'Practitioner') return undefined;
  return contained.telecom?.find((telecom) => telecom.system === 'fax')?.value;
};

/**
 * The send flow captures only a fax number, so the recipient name is resolved best-effort: when the
 * number matches a practitioner contained on the Patient (i.e. their PCP), use that name.
 */
const findRecipientNameByFaxNumber = (patient: Patient, faxNumber: string): string | undefined => {
  const faxDigits = normalizeFaxNumber(faxNumber);
  if (!faxDigits) return undefined;
  const match = patient.contained?.find(
    (resource): resource is Practitioner =>
      resource.resourceType === 'Practitioner' &&
      Boolean(resource.telecom?.some((telecom) => normalizeFaxNumber(telecom.value) === faxDigits))
  );
  return match?.name?.length ? getFullName(match) : undefined;
};

const normalizeFaxNumber = (value: string | undefined): string | undefined => {
  const digits = value?.replace(/\D/g, '');
  return digits ? digits.slice(-10) : undefined;
};

const isFaxCommunication = (communication: Communication): boolean =>
  Boolean(communication.identifier?.some((id) => id.system === OYSTEHR_FAX_COMMUNICATION_IDENTIFIER_SYSTEM));

const isFaxSentProvenance = (resource: { resourceType: string } | Provenance): resource is Provenance =>
  resource.resourceType === 'Provenance' &&
  Boolean(
    (resource as Provenance).activity?.coding?.some(
      (coding) =>
        coding.code === FAX_SENT_PROVENANCE_ACTIVITY_CODING.code &&
        coding.system === FAX_SENT_PROVENANCE_ACTIVITY_CODING.system
    )
  );

const findTargetId = (provenance: Provenance, resourceType: 'Communication' | 'Appointment'): string | undefined => {
  const target = provenance.target.find((candidate) => candidate.reference?.startsWith(`${resourceType}/`));
  return target?.reference?.split('/')[1];
};

/** Matches both plain and versioned ("ResourceType/id/_history/x") references. */
const referenceMatches = (reference: string | undefined, resourceType: string, id: string): boolean =>
  reference?.split('/')[0] === resourceType && reference?.split('/')[1] === id;
