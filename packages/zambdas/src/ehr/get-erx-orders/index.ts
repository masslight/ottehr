import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { MedicationRequest } from 'fhir/r4b';
import { ERX_MEDICATION_META_TAG_CODE } from 'utils/lib/fhir/constants';
import { GetErxOrdersInput, GetErxOrdersInputSchema, GetErxOrdersResponse } from 'utils/lib/types/api/erx.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { makePrescribedMedicationDTO } from '../../shared/chart-data';
import { createClinicalOystehrClient, validateJsonBody } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';

let m2mToken: string;
const ZAMBDA_NAME = 'get-erx-orders';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);

  const response = await getErxOrders(oystehr, validatedParameters);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
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
