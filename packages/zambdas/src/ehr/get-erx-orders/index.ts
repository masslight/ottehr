import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { MedicationRequest } from 'fhir/r4b';
import {
  ERX_MEDICATION_META_TAG_CODE,
  GetErxOrdersInput,
  GetErxOrdersInputSchema,
  GetErxOrdersResponse,
  getSecret,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  makePrescribedMedicationDTO,
  topLevelCatch,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'get-erx-orders';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);

    const response = await getErxOrders(oystehr, validatedParameters);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', error);
    console.log('Stringified error: ', JSON.stringify(error));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

export async function getErxOrders(
  oystehr: Oystehr,
  validatedParameters: GetErxOrdersInput
): Promise<GetErxOrdersResponse> {
  const bundle = await oystehr.fhir.search({
    resourceType: 'MedicationRequest',
    params: [
      {
        name: 'encounter',
        value: validatedParameters.encounterIds.map((id) => `Encounter/${id}`).join(','),
      },
      {
        name: '_tag',
        value: ERX_MEDICATION_META_TAG_CODE,
      },
    ],
  });
  return {
    orders: (bundle.unbundle() as MedicationRequest[]).map(makePrescribedMedicationDTO),
  };
}

function validateRequestParameters(input: ZambdaInput): GetErxOrdersInput & Pick<ZambdaInput, 'secrets'> {
  const { encounterIds } = GetErxOrdersInputSchema.parse(validateJsonBody(input));
  return {
    encounterIds,
    secrets: input.secrets,
  };
}
