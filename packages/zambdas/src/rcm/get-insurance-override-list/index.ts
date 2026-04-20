import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  createOystehrClient,
  getSecret,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  MISSING_REQUIRED_PARAMETERS,
  SecretsKeys,
} from 'utils';
import { getAuth0Token, wrapHandler, ZambdaInput } from '../../shared';
import { getInsuranceOverrideList, ListName } from './handler';

interface Input {
  secrets: ZambdaInput['secrets'];
  listName: ListName;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

export const index = wrapHandler(
  'get-insurance-override-list',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets } = input;
    const validatedInput = validateInput(input);

    console.group('getAuth0Token');
    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }
    console.groupEnd();
    console.debug('getAuth0Token success');

    console.group('createOystehrClient');
    const oystehr = createOystehrClient(
      oystehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );
    console.groupEnd();
    console.debug('createOystehrClient success');

    const list: List = await getInsuranceOverrideList(oystehr, validatedInput.listName);

    return {
      statusCode: 200,
      body: JSON.stringify(list),
    };
  }
);

function validateInput(input: ZambdaInput): Input {
  const { body, secrets } = input;
  if (!body) {
    throw MISSING_REQUEST_BODY;
  }
  if (!secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  const { listName } = JSON.parse(body);
  if (!listName) {
    throw MISSING_REQUIRED_PARAMETERS(['listName']);
  }
  if (listName !== ListName.EHR && listName !== ListName.Patient) {
    throw INVALID_INPUT_ERROR('`listName` must be either `patient` or `ehr`');
  }

  return {
    listName,
    secrets,
  };
}
