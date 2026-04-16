import Oystehr, { FhirResourceReturnValue } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import { createOystehrClient, getSecret, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, SecretsKeys } from 'utils';
import { getAuth0Token, wrapHandler, ZambdaInput } from '../../shared';

export enum ListName {
  Patient = 'patient',
  EHR = 'ehr',
}

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

export async function getInsuranceOverrideList(
  oystehr: Oystehr,
  listName: string
): Promise<FhirResourceReturnValue<List>> {
  console.group('getPatientInsuranceList');
  const lists = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        {
          name: 'identifier',
          value: `...|${listName}`, // CW TODO
        },
      ],
    })
  ).unbundle();
  if (!lists.length) {
    // CW TODO: actually, create it
    throw new Error('could not find patient-facing payer list'); // CW TODO APIError
  }
  console.groupEnd();
  return lists[0] as FhirResourceReturnValue<List>;
}

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
    throw new Error(''); // CW TODO
  }
  if (listName !== ListName.EHR && listName !== ListName.Patient) {
    throw new Error(''); // CW TODO
  }

  return {
    listName,
    secrets,
  };
}
