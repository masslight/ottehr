import { BatchInputDeleteRequest, BatchInputPutRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, List } from 'fhir/r4b';
import { DeleteApprovedPatientEducationOutput, PATIENT_EDUCATION_APPROVED_LIST_IDENTIFIER } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { deleteZ3Object } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'delete-approved-patient-education',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { documentReferenceId, secrets } = validateRequestParameters(input);

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);

      const docRef = await oystehr.fhir.get<DocumentReference>({
        resourceType: 'DocumentReference',
        id: documentReferenceId,
      });
      const z3Url = docRef.content?.[0]?.attachment?.url;

      const listSearch = await oystehr.fhir.search<List>({
        resourceType: 'List',
        params: [
          {
            name: 'identifier',
            value: `${PATIENT_EDUCATION_APPROVED_LIST_IDENTIFIER.system}|${PATIENT_EDUCATION_APPROVED_LIST_IDENTIFIER.value}`,
          },
        ],
      });
      const list = listSearch.unbundle()[0];

      const requests: BatchInputRequest<List | DocumentReference>[] = [];
      const deleteDocRef: BatchInputDeleteRequest = {
        method: 'DELETE',
        url: `/DocumentReference/${documentReferenceId}`,
      };
      requests.push(deleteDocRef);

      if (list) {
        const remainingEntries = (list.entry ?? []).filter((entry) => {
          const ref = entry.item.reference ?? '';
          return ref.split('/').pop() !== documentReferenceId;
        });
        const updatedList: List = { ...list, entry: remainingEntries };
        const updateList: BatchInputPutRequest<List> = {
          method: 'PUT',
          url: `/List/${list.id}`,
          resource: updatedList,
        };
        requests.push(updateList);
      }

      await oystehr.fhir.transaction<DocumentReference | List>({ requests });

      if (z3Url) {
        try {
          await deleteZ3Object(z3Url, m2mToken);
        } catch (cleanupErr) {
          console.warn('Failed to delete Z3 object for approved patient education', z3Url, cleanupErr);
        }
      }

      const output: DeleteApprovedPatientEducationOutput = { success: true };
      return { statusCode: 200, body: JSON.stringify(output) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('delete-approved-patient-education error:', message, error);
      return { statusCode: 500, body: JSON.stringify({ error: message }) };
    }
  }
);
