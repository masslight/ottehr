import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Appointment, Encounter, List } from 'fhir/r4b';
import { createFilesDocumentReferences, getAppointmentResourceById, OTTEHR_MODULE } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'upload-dot-vision-document';

// LOINC "Eye Clinic Note" — referral documentation from an ophthalmologist/optometrist for DOT screening.
const DOT_VISION_DOCUMENT_CODE = '64296-4';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, appointmentID, z3URL, title } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const appointment: Appointment | undefined = await getAppointmentResourceById(appointmentID, oystehr);
  if (!appointment) {
    return { statusCode: 404, body: JSON.stringify({ message: `Appointment ${appointmentID} not found` }) };
  }

  const patientReference = appointment.participant.find((p) => p.actor?.reference?.startsWith('Patient/'))?.actor
    ?.reference;
  if (!patientReference) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Appointment has no patient' }) };
  }
  const patientID = patientReference.replace('Patient/', '');

  const encounter = (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [{ name: 'appointment', value: `Appointment/${appointmentID}` }],
    })
  )
    .unbundle()
    .find((enc) => enc.id);
  if (!encounter?.id) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: `No encounter found for appointment ${appointmentID}` }),
    };
  }
  const encounterReference = `Encounter/${encounter.id}`;

  const lists = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: 'subject', value: `Patient/${patientID}` }],
    })
  ).unbundle();

  const fileTitle = title || z3URL.split('/').pop() || 'dot-vision-document';
  const dateCreated = new Date().toISOString();

  const { docRefs } = await createFilesDocumentReferences({
    files: [{ url: z3URL, title: fileTitle }],
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: DOT_VISION_DOCUMENT_CODE,
          display: 'DOT vision referral documentation',
        },
      ],
      text: 'DOT vision referral documentation',
    },
    dateCreated,
    references: {
      subject: { reference: `Patient/${patientID}` },
      context: { encounter: [{ reference: encounterReference }], related: [{ reference: encounterReference }] },
    },
    searchParams: [
      { name: 'subject', value: `Patient/${patientID}` },
      { name: 'type', value: DOT_VISION_DOCUMENT_CODE },
      { name: 'related', value: encounterReference },
    ],
    oystehr,
    generateUUID: randomUUID,
    listResources: lists,
    meta: {
      tag: [{ code: OTTEHR_MODULE.IP }, { code: OTTEHR_MODULE.TM }],
    },
  });

  const docRef = docRefs[0];
  return {
    statusCode: 200,
    body: JSON.stringify({
      documentRefId: docRef?.id,
      url: z3URL,
      title: fileTitle,
    }),
  };
});
