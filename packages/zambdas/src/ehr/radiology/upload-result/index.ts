import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference, Practitioner, Reference, ServiceRequest } from 'fhir/r4b';
import { userMe } from 'utils/lib/auth/user-me.helper';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { createFilesDocumentReferences, patchWithOptimisticLock } from 'utils/lib/fhir/helpers';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { RADIOLOGY_RESULT_DOC_REF_DOCTYPE } from 'utils/lib/fhir/radiology';
import { addOperation, replaceOperation } from 'utils/lib/helpers/operations';
import { UploadRadiologyResultZambdaOutput } from 'utils/lib/types/api/radiology';
import { RADIOLOGY_REPORT_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { findOrCreatePatientSystemFolderList } from '../../shared/patient-document-folders';
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

  const radiologyReportsFolder = await findOrCreatePatientSystemFolderList({
    patientId: patientReference.replace('Patient/', ''),
    internalName: BUCKET_NAMES.RADIOLOGY_REPORTS,
    oystehr,
  });
  if (!radiologyReportsFolder?.id) {
    throw new Error(`Could not resolve the Radiology Reports folder for ${patientReference}`);
  }

  const orderResultsSearchParams = [
    { name: 'related', value: `ServiceRequest/${body.serviceRequestId}` },
    {
      name: 'type',
      value: `${RADIOLOGY_RESULT_DOC_REF_DOCTYPE.system}|${RADIOLOGY_RESULT_DOC_REF_DOCTYPE.code}`,
    },
  ];

  const { docRefs } = await createFilesDocumentReferences({
    files: [{ url: body.z3URL, title }],
    type: {
      coding: [
        { system: 'http://loinc.org', code: RADIOLOGY_REPORT_CODE, display: 'Diagnostic imaging study' },
        RADIOLOGY_RESULT_DOC_REF_DOCTYPE,
      ],
      text: RADIOLOGY_RESULT_DOC_REF_DOCTYPE.display,
    },
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
    searchParams: orderResultsSearchParams,
    oystehr,
    generateUUID: randomUUID,
  });

  const docRef = docRefs[0];
  if (!docRef?.id) {
    throw new Error('Failed to create DocumentReference for radiology result');
  }

  const docRefReference = `DocumentReference/${docRef.id}`;
  const obsoleteReferences = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: orderResultsSearchParams,
    })
  )
    .unbundle()
    .filter((result) => result.id !== docRef.id && result.content[0]?.attachment.title === title)
    .map((result) => `DocumentReference/${result.id}`);

  await patchWithOptimisticLock(oystehr, { ...radiologyReportsFolder, id: radiologyReportsFolder.id }, (folder) => {
    const entries = folder.entry ?? [];
    const keptEntries = entries.filter((entry) => !obsoleteReferences.includes(entry.item.reference ?? ''));
    const isFiled = keptEntries.some((entry) => entry.item.reference === docRefReference);
    if (isFiled && keptEntries.length === entries.length) {
      return [];
    }
    const updatedEntries = isFiled
      ? keptEntries
      : [
          ...keptEntries,
          { date: new Date().toISOString(), item: { type: 'DocumentReference', reference: docRefReference } },
        ];
    return [entries.length ? replaceOperation('/entry', updatedEntries) : addOperation('/entry', updatedEntries)];
  });

  const output: UploadRadiologyResultZambdaOutput = { documentReferenceId: docRef.id };
  return { statusCode: 200, body: JSON.stringify(output) };
});
