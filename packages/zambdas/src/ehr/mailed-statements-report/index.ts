import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Communication, Encounter, Patient } from 'fhir/r4b';
import { getPatientFirstName, getPatientLastName, MailedStatementItem, Secrets } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  MAIL_VENDOR_EXTENSION_URL,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'mailed-statements-report';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  const { dateRange, secrets }: { dateRange: { start: string; end: string }; secrets: Secrets } = validatedParameters;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  console.log('Searching for mailed statement Communications in date range:', dateRange);

  // Search for Communication resources with medium MAILWRIT in the date range
  let allCommunications: Communication[] = [];
  let offset = 0;
  const pageSize = 200;

  let searchBundle = await oystehr.fhir.search<Communication>({
    resourceType: 'Communication',
    params: [
      { name: 'medium', value: 'MAILWRIT' },
      { name: 'sent', value: `ge${dateRange.start}` },
      { name: 'sent', value: `le${dateRange.end}` },
      { name: '_sort', value: '-sent' },
      { name: '_count', value: pageSize.toString() },
      { name: '_offset', value: offset.toString() },
    ],
  });

  let pageCount = 1;
  let pageCommunications = searchBundle.unbundle();
  allCommunications = allCommunications.concat(pageCommunications);

  while (searchBundle.link?.find((link) => link.relation === 'next')) {
    offset += pageSize;
    pageCount++;

    searchBundle = await oystehr.fhir.search<Communication>({
      resourceType: 'Communication',
      params: [
        { name: 'medium', value: 'MAILWRIT' },
        { name: 'sent', value: `ge${dateRange.start}` },
        { name: 'sent', value: `le${dateRange.end}` },
        { name: '_sort', value: '-sent' },
        { name: '_count', value: pageSize.toString() },
        { name: '_offset', value: offset.toString() },
      ],
    });

    pageCommunications = searchBundle.unbundle();
    allCommunications = allCommunications.concat(pageCommunications);

    if (pageCount > 50) {
      console.warn('Reached maximum pagination limit (50 pages). Stopping search.');
      break;
    }
  }

  console.log(`Found ${allCommunications.length} mailed statement Communications across ${pageCount} pages`);

  // Collect unique patient IDs and encounter IDs
  const patientIds = new Set<string>();
  const encounterIds = new Set<string>();
  for (const comm of allCommunications) {
    const patientId = comm.subject?.reference?.split('/')[1];
    if (patientId) {
      patientIds.add(patientId);
    }
    const encounterId = comm.encounter?.reference?.split('/')[1];
    if (encounterId) {
      encounterIds.add(encounterId);
    }
  }

  // Fetch patient details in batches
  const patientMap = new Map<string, Patient>();
  const patientIdArray = Array.from(patientIds);
  const PATIENT_BATCH_SIZE = 50;

  for (let i = 0; i < patientIdArray.length; i += PATIENT_BATCH_SIZE) {
    const batch = patientIdArray.slice(i, i + PATIENT_BATCH_SIZE);
    const patientBundle = await oystehr.fhir.search<Patient>({
      resourceType: 'Patient',
      params: [{ name: '_id', value: batch.join(',') }],
    });
    for (const patient of patientBundle.unbundle()) {
      if (patient.id) {
        patientMap.set(patient.id, patient);
      }
    }
  }

  // Fetch encounters with their appointments in a single query per batch using _include
  const encounterAppointmentData = new Map<string, { appointmentDate: string; appointmentId: string }>();
  const encounterIdArray = Array.from(encounterIds);
  const ENCOUNTER_BATCH_SIZE = 50;

  for (let i = 0; i < encounterIdArray.length; i += ENCOUNTER_BATCH_SIZE) {
    const batch = encounterIdArray.slice(i, i + ENCOUNTER_BATCH_SIZE);
    const encounterBundle = await oystehr.fhir.search<Encounter | Appointment>({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: batch.join(',') },
        { name: '_include', value: 'Encounter:appointment' },
      ],
    });

    const appointments = new Map<string, Appointment>();
    const encounters: Encounter[] = [];

    for (const resource of encounterBundle.unbundle()) {
      if (resource.resourceType === 'Appointment' && resource.id) {
        appointments.set(resource.id, resource as Appointment);
      } else if (resource.resourceType === 'Encounter') {
        encounters.push(resource as Encounter);
      }
    }

    for (const encounter of encounters) {
      if (!encounter.id) continue;
      const appointmentRef = encounter.appointment?.[0]?.reference?.split('/')[1];
      const appointment = appointmentRef ? appointments.get(appointmentRef) : undefined;
      encounterAppointmentData.set(encounter.id, {
        appointmentDate: appointment?.start ?? encounter.period?.start ?? '',
        appointmentId: appointmentRef ?? '',
      });
    }
  }

  // Map Communications to report items
  const statements: MailedStatementItem[] = allCommunications.map((comm) => {
    const patientId = comm.subject?.reference?.split('/')[1] ?? '';
    const patient = patientMap.get(patientId);
    const patientName = patient ? `${getPatientLastName(patient)}, ${getPatientFirstName(patient)}` : 'Unknown';

    const encounterId = comm.encounter?.reference?.split('/')[1] ?? '';
    const apptData = encounterAppointmentData.get(encounterId);
    const appointmentDate = apptData?.appointmentDate ?? '';
    const appointmentId = apptData?.appointmentId ?? '';
    const recipientName = comm.recipient?.[0]?.display ?? '';
    const sentDate = comm.sent ?? '';
    const description = comm.payload?.[0]?.contentString ?? '';

    // Extract HTML content from payload attachment
    const htmlAttachment = comm.payload?.find(
      (p) => p.contentAttachment?.contentType === 'text/html' && p.contentAttachment?.data
    );
    const htmlContent = htmlAttachment?.contentAttachment?.data
      ? Buffer.from(htmlAttachment.contentAttachment.data, 'base64').toString('utf-8')
      : '';

    // Extract PostGrid vendor info from extensions
    const mailVendorExt = comm.extension?.find((ext) => ext.url === MAIL_VENDOR_EXTENSION_URL);
    const vendorLetterId = mailVendorExt?.extension?.find((ext) => ext.url === 'vendor-letter-id')?.valueString ?? '';
    const vendorLetterStatus =
      mailVendorExt?.extension?.find((ext) => ext.url === 'vendor-letter-status')?.valueString ?? '';
    const vendorSendDate = mailVendorExt?.extension?.find((ext) => ext.url === 'vendor-send-date')?.valueString ?? '';
    const vendorLetterUrl = mailVendorExt?.extension?.find((ext) => ext.url === 'vendor-letter-url')?.valueString ?? '';
    const vendorMailingClass =
      mailVendorExt?.extension?.find((ext) => ext.url === 'vendor-mailing-class')?.valueString ?? '';
    const vendorPageCount =
      Number(mailVendorExt?.extension?.find((ext) => ext.url === 'vendor-page-count')?.valueString) || 0;
    const vendorEnvelopeType =
      mailVendorExt?.extension?.find((ext) => ext.url === 'vendor-envelope-type')?.valueString ?? '';
    const vendorStatusSyncedAt =
      mailVendorExt?.extension?.find((ext) => ext.url === 'vendor-status-synced-at')?.valueString ?? '';

    return {
      communicationId: comm.id ?? '',
      patientId,
      patientName,
      encounterId,
      recipientName,
      sentDate,
      appointmentDate,
      appointmentId,
      vendorLetterId,
      vendorLetterStatus,
      vendorSendDate,
      vendorLetterUrl,
      vendorMailingClass,
      vendorPageCount,
      vendorEnvelopeType,
      vendorStatusSyncedAt,
      description,
      htmlContent,
    };
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Found ${statements.length} mailed statements`,
      statements,
    }),
  };
});
