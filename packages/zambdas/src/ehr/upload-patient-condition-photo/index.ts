import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Appointment, List } from 'fhir/r4b';
import { createFilesDocumentReferences, getAppointmentResourceById, OTTEHR_MODULE, PATIENT_PHOTO_CODE } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'upload-patient-condition-photo';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, appointmentID, z3URL, title } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

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

  const lists = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: 'subject', value: `Patient/${patientID}` }],
    })
  ).unbundle();

  const fileTitle = title || z3URL.split('/').pop() || 'patient-photo';
  const dateCreated = new Date().toISOString();

  const { docRefs } = await createFilesDocumentReferences({
    files: [{ url: z3URL, title: fileTitle }],
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: PATIENT_PHOTO_CODE,
          display: 'Patient condition photos',
        },
      ],
      text: 'Patient photos',
    },
    dateCreated,
    references: {
      subject: { reference: `Patient/${patientID}` },
      context: { related: [{ reference: `Appointment/${appointmentID}` }] },
    },
    searchParams: [
      { name: 'subject', value: `Patient/${patientID}` },
      { name: 'type', value: PATIENT_PHOTO_CODE },
      { name: 'related', value: `Appointment/${appointmentID}` },
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
    }),
  };
});
