import Oystehr, { BatchInputDeleteRequest, BatchInputPutRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, List } from 'fhir/r4b';
import {
  DeleteApprovedPatientEducationInput,
  DeleteApprovedPatientEducationOutput,
  getSecret,
  PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE,
  PATIENT_EDUCATION_APPROVED_LIST_IDENTIFIER,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { deleteZ3Object } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'delete-approved-patient-education',
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
      return topLevelCatch('delete-approved-patient-education', error, ENVIRONMENT);
    }
  }
);

const performEffect = async (
  validatedInput: DeleteApprovedPatientEducationInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  token: string
): Promise<DeleteApprovedPatientEducationOutput> => {
  const { documentReferenceId } = validatedInput;

  const docRef = await oystehr.fhir.get<DocumentReference>({
    resourceType: 'DocumentReference',
    id: documentReferenceId,
  });
  const isApprovedPatientEducation = (docRef.type?.coding ?? []).some(
    (c) => c.code === PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE
  );
  if (!isApprovedPatientEducation) {
    throw new Error('DocumentReference is not an approved patient education entry');
  }
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
      await deleteZ3Object(z3Url, token);
    } catch (cleanupErr) {
      console.warn('Failed to delete Z3 object for approved patient education', z3Url, cleanupErr);
    }
  }

  return { success: true };
};
