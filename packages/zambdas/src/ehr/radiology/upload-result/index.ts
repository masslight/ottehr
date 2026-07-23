import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Practitioner, Reference, ServiceRequest } from 'fhir/r4b';
import {
  createFilesDocumentReferences,
  getFullestAvailableName,
  RADIOLOGY_RESULT_DOC_REF_DOCTYPE,
  UploadRadiologyResultZambdaOutput,
  userMe,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateInput, validateSecrets } from './validation';

let m2mToken: string;

const ZAMBDA_NAME = 'radiology-upload-result';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const secrets = validateSecrets(unsafeInput.secrets);
  const { body, callerAccessToken } = validateInput(unsafeInput);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const serviceRequest = await oystehr.fhir.get<ServiceRequest>({
    resourceType: 'ServiceRequest',
    id: body.serviceRequestId,
  });

  // Record who uploaded the result — the order history's "reviewed" row shows this provider,
  // since the provider reviews and signs the result before uploading it.
  let author: Reference[] | undefined;
  try {
    const callerUser = await userMe(callerAccessToken, secrets);
    const practitionerId = callerUser.profile.split('/')[1];
    const practitioner = await oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: practitionerId,
    });
    author = [{ reference: callerUser.profile, display: getFullestAvailableName(practitioner) }];
  } catch (error) {
    console.error('Could not resolve uploading practitioner for result author, proceeding without it:', error);
  }

  const patientReference = serviceRequest.subject?.reference;
  const encounterReference = serviceRequest.encounter?.reference;
  if (!patientReference || !encounterReference) {
    throw new Error('ServiceRequest is missing subject or encounter reference');
  }

  const title = body.title || body.z3URL.split('/').pop() || 'Radiology Result';

  const { docRefs } = await createFilesDocumentReferences({
    files: [{ url: body.z3URL, title }],
    type: { coding: [RADIOLOGY_RESULT_DOC_REF_DOCTYPE], text: RADIOLOGY_RESULT_DOC_REF_DOCTYPE.display },
    references: {
      subject: { reference: patientReference },
      author,
      context: {
        encounter: [{ reference: encounterReference }],
        related: [{ reference: `ServiceRequest/${body.serviceRequestId}` }],
      },
    },
    docStatus: 'final',
    dateCreated: new Date().toISOString(),
    // Scope supersede/dedup to this order's results so re-uploading the same filename replaces it,
    // while distinct files accumulate. The type filter keeps the title-based supersede from ever
    // touching the order-form PDF docRef related to the same ServiceRequest.
    searchParams: [
      { name: 'related', value: `ServiceRequest/${body.serviceRequestId}` },
      {
        name: 'type',
        value: `${RADIOLOGY_RESULT_DOC_REF_DOCTYPE.system}|${RADIOLOGY_RESULT_DOC_REF_DOCTYPE.code}`,
      },
    ],
    oystehr,
    generateUUID: randomUUID,
    listResources: [],
  });

  const docRef = docRefs[0];
  if (!docRef?.id) {
    throw new Error('Failed to create DocumentReference for radiology result');
  }

  const output: UploadRadiologyResultZambdaOutput = { documentReferenceId: docRef.id };
  return { statusCode: 200, body: JSON.stringify(output) };
});
