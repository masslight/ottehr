import Oystehr, {
  BatchInputDeleteRequest,
  BatchInputPostRequest,
  BatchInputPutRequest,
  BatchInputRequest,
} from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference, List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  CODE_SYSTEM_ICD_10,
  getSecret,
  PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE,
  PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL,
  PATIENT_EDUCATION_APPROVED_LIST_IDENTIFIER,
  SaveApprovedPatientEducationInput,
  SaveApprovedPatientEducationOutput,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { makeZ3FileUrl } from '../../shared/presigned-file-urls';
import { createPresignedUrl, deleteZ3Object, uploadObjectToZ3 } from '../../shared/z3Utils';
import { extractApprovedEducationIcdCodes } from '../shared/approved-patient-education-helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'save-approved-patient-education',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const validatedInput = validateRequestParameters(input);
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
      const oystehr = createOystehrClient(m2mToken, validatedInput.secrets);

      const result = await performEffect(validatedInput, oystehr, m2mToken);
      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('save-approved-patient-education', error, ENVIRONMENT);
    }
  }
);

const performEffect = async (
  validatedInput: SaveApprovedPatientEducationInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  token: string
): Promise<SaveApprovedPatientEducationOutput> => {
  const { pdfBase64, title, icdCodes, secrets } = validatedInput;

  // 1. Upload PDF to Z3
  const pdfBytes = new Uint8Array(Buffer.from(pdfBase64, 'base64'));
  const fileName = `approved-patient-education-${randomUUID()}.pdf`;
  const z3Url = makeZ3FileUrl({ secrets, bucketName: BUCKET_NAMES.PATIENT_EDUCATION_ADMIN, fileName });
  const presignedUploadUrl = await createPresignedUrl(token, z3Url, 'upload');
  await uploadObjectToZ3(pdfBytes, presignedUploadUrl);
  console.log('Uploaded approved patient education PDF to Z3:', z3Url);

  // 2. Load existing index List + all approved DocumentReferences (one round trip)
  const searchResult = await oystehr.fhir.search<List | DocumentReference>({
    resourceType: 'List',
    params: [
      {
        name: 'identifier',
        value: `${PATIENT_EDUCATION_APPROVED_LIST_IDENTIFIER.system}|${PATIENT_EDUCATION_APPROVED_LIST_IDENTIFIER.value}`,
      },
      { name: '_include', value: 'List:item' },
    ],
  });
  const resources = searchResult.unbundle();
  const existingList = resources.find((r): r is List => r.resourceType === 'List');
  const existingDocRefs = resources.filter(
    (r): r is DocumentReference =>
      r.resourceType === 'DocumentReference' &&
      (r.type?.coding ?? []).some((c) => c.code === PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE)
  );

  // 3. Identify DocRefs to delete-and-replace (any whose ICD set overlaps with incoming)
  const incomingIcdSet = new Set(icdCodes.map((c) => c.code));
  const toReplace = existingDocRefs.filter((dr) =>
    extractApprovedEducationIcdCodes(dr).some(({ code }) => incomingIcdSet.has(code))
  );
  const toReplaceIds = new Set(toReplace.map((dr) => dr.id!));
  const toReplaceZ3Urls = toReplace.map((dr) => dr.content?.[0]?.attachment?.url).filter((u): u is string => !!u);

  // 4. Build new DocumentReference
  const newDocRefFullUrl = `urn:uuid:${randomUUID()}`;
  const newDocRef: DocumentReference = {
    resourceType: 'DocumentReference',
    status: 'current',
    type: {
      coding: [
        {
          system: 'https://fhir.ottehr.com/CodeSystem/document-type',
          code: PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE,
          display: 'Approved Patient Education',
        },
      ],
    },
    date: DateTime.now().setZone('UTC').toISO() ?? '',
    description: title,
    content: [
      {
        attachment: {
          url: z3Url,
          contentType: 'application/pdf',
          title,
        },
      },
    ],
    extension: [
      {
        url: PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL,
        extension: icdCodes.map((c) => ({
          url: 'icdCode',
          valueCoding: {
            system: CODE_SYSTEM_ICD_10,
            code: c.code,
            display: c.display,
          },
        })),
      },
    ],
  };

  // 5. Build the updated List (or create one if none exists)
  const survivingEntries = (existingList?.entry ?? []).filter((entry) => {
    const ref = entry.item.reference ?? '';
    const id = ref.split('/').pop();
    return !id || !toReplaceIds.has(id);
  });
  const updatedListEntries = [
    ...survivingEntries,
    {
      item: { reference: newDocRefFullUrl },
    },
  ];

  const requests: BatchInputRequest<DocumentReference | List>[] = [];
  const createDocRefRequest: BatchInputPostRequest<DocumentReference> = {
    method: 'POST',
    fullUrl: newDocRefFullUrl,
    url: '/DocumentReference',
    resource: newDocRef,
  };
  requests.push(createDocRefRequest);

  for (const docRef of toReplace) {
    const deleteReq: BatchInputDeleteRequest = {
      method: 'DELETE',
      url: `/DocumentReference/${docRef.id}`,
    };
    requests.push(deleteReq);
  }

  if (existingList) {
    const updatedList: List = {
      ...existingList,
      entry: updatedListEntries,
    };
    const updateListReq: BatchInputPutRequest<List> = {
      method: 'PUT',
      url: `/List/${existingList.id}`,
      resource: updatedList,
    };
    requests.push(updateListReq);
  } else {
    const newList: List = {
      resourceType: 'List',
      status: 'current',
      mode: 'working',
      title: 'Approved Patient Education PDFs',
      identifier: [PATIENT_EDUCATION_APPROVED_LIST_IDENTIFIER],
      entry: updatedListEntries,
    };
    const createListReq: BatchInputPostRequest<List> = {
      method: 'POST',
      url: '/List',
      resource: newList,
    };
    requests.push(createListReq);
  }

  let txnResult;
  try {
    txnResult = await oystehr.fhir.transaction<DocumentReference | List>({ requests });
  } catch (txnErr) {
    // FHIR transaction failed — clean up the orphaned Z3 object we uploaded above.
    try {
      await deleteZ3Object(z3Url, token);
    } catch (cleanupErr) {
      console.warn('Failed to clean up orphaned Z3 object after transaction failure', z3Url, cleanupErr);
    }
    throw txnErr;
  }
  const createdDocRef = (txnResult.entry ?? [])
    .map((e) => e.resource)
    .find((r): r is DocumentReference => r?.resourceType === 'DocumentReference');
  if (!createdDocRef?.id) {
    try {
      await deleteZ3Object(z3Url, token);
    } catch (cleanupErr) {
      console.warn('Failed to clean up orphaned Z3 object after transaction failure', z3Url, cleanupErr);
    }
    throw new Error('Failed to create DocumentReference for approved patient education');
  }

  // 6. Best-effort cleanup of Z3 objects for replaced DocRefs (after FHIR transaction succeeds)
  for (const url of toReplaceZ3Urls) {
    try {
      await deleteZ3Object(url, token);
    } catch (cleanupErr) {
      console.warn('Failed to delete replaced Z3 object', url, cleanupErr);
    }
  }

  return {
    documentReferenceId: createdDocRef.id,
    replacedDocumentReferenceIds: toReplace.map((dr) => dr.id!),
  };
};
