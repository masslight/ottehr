import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List, Organization, QuestionnaireItemAnswerOption } from 'fhir/r4b';
import {
  ANSWER_OPTION_FROM_RESOURCE_UNDEFINED,
  APIError,
  createOystehrClient,
  getPayerId,
  getSecret,
  isApiError,
  MISSING_REQUEST_SECRETS,
  SecretsKeys,
} from 'utils';
import { getAuth0Token, wrapHandler, ZambdaInput } from '../../shared';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

export const index = wrapHandler(
  'get-patient-insurance-payers',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets } = input;
    if (!secrets) {
      throw MISSING_REQUEST_SECRETS;
    }

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

    const answerOptions: QuestionnaireItemAnswerOption[] = await performEffect(oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(answerOptions),
    };
  }
);

const performEffect = async (oystehr: Oystehr): Promise<QuestionnaireItemAnswerOption[]> => {
  console.group('getEHRInsuranceList');
  const lists = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        {
          name: 'identifier',
          value: '', // CW TODO
        },
      ],
    })
  ).unbundle();
  if (!lists.length) {
    throw new Error('could not find EHR-facing payer list'); // CW TODO APIError
  }
  const patientPayerList = lists[0];
  console.groupEnd();

  console.group('getPayers');
  if (!patientPayerList.entry || !patientPayerList.entry.length) {
    return [];
  }
  const payers = await Promise.all(
    patientPayerList.entry.map(async (entry) => {
      if (!entry.item.reference) {
        return undefined;
      }
      const payer = await oystehr.rcm.getPayerByUrl({ url: entry.item.reference });
      const nameOverride = entry.extension?.find((ext) => ext.url === ''); // CW TODO
      if (nameOverride) {
        payer.name = nameOverride.valueString;
      }
      return payer;
    })
  );
  console.groupEnd();

  let error: APIError | undefined;
  const mappedResults = payers
    .filter((maybeOrg): maybeOrg is Organization => !!maybeOrg) // filter out undefined
    .map((payer) => {
      try {
        return formatPayerAsAnswerOption(oystehr, payer);
      } catch (e) {
        if (isApiError(e)) {
          error = e as APIError;
        }
        return undefined;
      }
    })
    .filter((res): res is QuestionnaireItemAnswerOption => !!res); // filter out undefined
  if (mappedResults.length === 0 && error) {
    throw error;
  }
  return mappedResults.sort((r1, r2) => {
    const r1Val = r1.valueReference?.display?.split(' - ')[1] ?? r1.valueReference?.display ?? '';
    const r2Val = r2.valueReference?.display?.split(' - ')[1] ?? r2.valueReference?.display ?? '';

    return r1Val.localeCompare(r2Val);
  });
};

const formatPayerAsAnswerOption = (oystehr: Oystehr, payer: Organization): QuestionnaireItemAnswerOption => {
  let name = payer.alias?.[0] ?? payer.name;
  const payerId = getPayerId(payer);
  if (payerId) {
    name = `${payerId} - ${name}`;
  }
  if (name && payerId && typeof name === 'string' && typeof payerId === 'string') {
    return {
      valueReference: {
        reference: oystehr.rcm.constructPayerUrl({ id: payerId }),
        display: name,
        type: payer.name === 'Other' ? 'other' : undefined,
      },
    };
  }
  throw ANSWER_OPTION_FROM_RESOURCE_UNDEFINED('Organization');
};
