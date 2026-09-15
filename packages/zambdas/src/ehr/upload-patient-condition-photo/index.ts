import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Operation } from 'fast-json-patch';
import { Appointment, DocumentReference, List } from 'fhir/r4b';
import { getAppointmentResourceById } from 'utils/lib/fhir/appointments';
import { createFilesDocumentReferences } from 'utils/lib/fhir/helpers';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { PATIENT_PHOTO_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { UploadPatientConditionPhotoInput } from 'utils/lib/types/data/upload-patient-condition-photo.types';
import { NO_READ_ACCESS_TO_PATIENT_ERROR } from 'utils/lib/types/errors';
import {
  checkIsEHRUser,
  checkOrCreateM2MClientToken,
  getUser,
  isTestUser,
  userHasAccessToPatient,
} from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'upload-patient-condition-photo';

let m2mToken: string;

// Called by BOTH the EHR and the Patient app. Every operation must stay gated by userHasAccessToPatient
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  const { secrets, appointmentID, authorization } = params;

  if (!authorization) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Missing authorization token' }) };
  }

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

  const user = await getUser(authorization.replace('Bearer ', ''), secrets);
  const isEHRUser = !!user && checkIsEHRUser(user);
  const userAccess = await userHasAccessToPatient(user, patientID, oystehr);

  if (!user || (!userAccess && !isEHRUser && !isTestUser(user))) {
    throw NO_READ_ACCESS_TO_PATIENT_ERROR;
  }

  if ('action' in params && params.action === 'delete') {
    const { documentReferenceId } = params;

    const docRef = (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [{ name: '_id', value: documentReferenceId }],
      })
    ).unbundle()[0];

    const isPatientPhoto = docRef?.type?.coding?.some((c) => c.code === PATIENT_PHOTO_CODE);
    const belongsToPatient = docRef?.subject?.reference === `Patient/${patientID}`;

    if (!docRef || !isPatientPhoto || !belongsToPatient) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Patient condition photo ${documentReferenceId} not found` }),
      };
    }

    const operations: Operation[] = [{ op: 'replace', path: '/status', value: 'entered-in-error' }];

    await oystehr.fhir.patch<DocumentReference>({
      resourceType: 'DocumentReference',
      id: documentReferenceId,
      operations,
    });

    return { statusCode: 200, body: JSON.stringify({ documentRefId: documentReferenceId }) };
  }

  const { z3URL, title } = params as UploadPatientConditionPhotoInput;

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
