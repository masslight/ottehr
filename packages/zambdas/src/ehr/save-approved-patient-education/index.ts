import { BatchInputDeleteRequest, BatchInputPostRequest, BatchInputPutRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference, List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  getSecret,
  PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE,
  PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL,
  PATIENT_EDUCATION_APPROVED_LIST_IDENTIFIER,
  SaveApprovedPatientEducationOutput,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { createPresignedUrl, deleteZ3Object, uploadObjectToZ3 } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ICD10_SYSTEM = 'http://hl7.org/fhir/sid/icd-10-cm';

function buildZ3Url(secrets: ZambdaInput['secrets'], fileName: string): string {
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const projectApi = getSecret(SecretsKeys.PROJECT_API, secrets);
  const dateTimeNow = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
  return `${projectApi}/z3/${projectId}-${BUCKET_NAMES.PATIENT_EDUCATION_ADMIN}/${dateTimeNow}-${fileName}`;
}

function extractIcdCodes(docRef: DocumentReference): string[] {
  const ext = (docRef.extension || []).find((e) => e.url === PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL);
  if (!ext?.extension) return [];
  return ext.extension.map((e) => e.valueCoding?.code).filter((c): c is string => !!c);
}

export const index = wrapHandler(
  'save-approved-patient-education',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { pdfBase64, title, icdCodes, secrets } = validateRequestParameters(input);

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);

      // 1. Upload PDF to Z3
      const pdfBytes = new Uint8Array(Buffer.from(pdfBase64, 'base64'));
      const fileName = `approved-patient-education-${randomUUID()}.pdf`;
      const z3Url = buildZ3Url(secrets, fileName);
      const presignedUploadUrl = await createPresignedUrl(m2mToken, z3Url, 'upload');
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
      const toReplace = existingDocRefs.filter((dr) => extractIcdCodes(dr).some((code) => incomingIcdSet.has(code)));
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
                system: ICD10_SYSTEM,
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

      const txnResult = await oystehr.fhir.transaction<DocumentReference | List>({ requests });
      const createdDocRef = (txnResult.entry ?? [])
        .map((e) => e.resource)
        .find((r): r is DocumentReference => r?.resourceType === 'DocumentReference');
      if (!createdDocRef?.id) {
        throw new Error('Failed to create DocumentReference for approved patient education');
      }

      // 6. Best-effort cleanup of Z3 objects for replaced DocRefs (after FHIR transaction succeeds)
      for (const url of toReplaceZ3Urls) {
        try {
          await deleteZ3Object(url, m2mToken);
        } catch (cleanupErr) {
          console.warn('Failed to delete replaced Z3 object', url, cleanupErr);
        }
      }

      const output: SaveApprovedPatientEducationOutput = {
        documentReferenceId: createdDocRef.id,
        replacedDocumentReferenceIds: toReplace.map((dr) => dr.id!),
      };
      return { statusCode: 200, body: JSON.stringify(output) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('save-approved-patient-education error:', message, error);
      return { statusCode: 500, body: JSON.stringify({ error: message }) };
    }
  }
);
