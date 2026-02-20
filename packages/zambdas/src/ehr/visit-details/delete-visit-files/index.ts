import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import {
  DeleteVisitFilesInput,
  FHIR_RESOURCE_NOT_FOUND,
  getSecret,
  INVALID_INPUT_ERROR,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkIsEHRUser,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getAuth0Token,
  getUser,
  isTestUser,
  topLevelCatch,
  userHasAccessToPatient,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'delete-visit-files';

let m2mToken: string;

interface Input extends DeleteVisitFilesInput {
  secrets: Secrets | null;
  token: string;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = await validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));

    console.group('createOystehrClient');
    const { secrets } = validatedParameters;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(input.secrets);
    } else {
      console.log('already have token');
    }
    const oystehr = createOystehrClient(m2mToken, secrets);
    console.groupEnd();
    console.debug('createOystehrClient success');

    console.group('complexValidation');
    const validatedInput = await complexValidation(validatedParameters, oystehr);
    console.groupEnd();
    console.debug('complexValidation success', JSON.stringify(validatedInput));

    console.group('performEffect');
    const success = await performEffect(validatedInput, oystehr);
    console.groupEnd();
    console.debug('performEffect success');

    return {
      statusCode: 200,
      body: JSON.stringify(success),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const performEffect = async (input: Input, oystehr: Oystehr): Promise<void> => {
  const { documentId } = input;

  await oystehr.fhir.patch({
    id: documentId,
    resourceType: 'DocumentReference',
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: 'superseded',
      },
    ],
  });
};

const complexValidation = async (input: Input, oystehr: Oystehr): Promise<Input> => {
  const { documentId, patientId, token, secrets } = input;

  const documentReferences = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        {
          name: '_id',
          value: documentId,
        },
        {
          name: 'status',
          value: 'current',
        },
      ],
    })
  ).unbundle();

  if (!documentReferences || documentReferences.length !== 1 || !documentReferences[0].id) {
    throw FHIR_RESOURCE_NOT_FOUND('DocumentReference');
  }

  const user = await getUser(token, secrets);
  const isEHRUser = user && checkIsEHRUser(user);
  const userAccess = await userHasAccessToPatient(user, patientId, oystehr);
  if (!user || (!userAccess && !isEHRUser && !isTestUser(user))) {
    throw NO_READ_ACCESS_TO_PATIENT_ERROR;
  }

  const patientReferenceFromDr = documentReferences[0].subject?.reference;
  if (patientReferenceFromDr !== `Patient/${patientId}`) {
    throw INVALID_INPUT_ERROR(`The provided patient ID does not match the patient associated with the document.`);
  }

  return input;
};
