import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Identifier, Medication } from 'fhir/r4b';
import { getMedicationCvx } from 'utils/lib/fhir/medication-inventory';
import {
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { GetVaccinesResponse } from 'utils/lib/types/data/immunization/types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';

let m2mToken: string;

const ZAMBDA_NAME = 'get-vaccines';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);
  const response = await getVaccines(oystehr);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

/**
 * The vaccines the practice has switched on in the catalog (active, with a CVX code), by name. The 26 config
 * vaccines that predate the catalog have no CVX and are left out; old orders keep their own copy of the name.
 * The search is fixed here: the request carries nothing.
 */
export async function getVaccines(oystehr: Oystehr): Promise<GetVaccinesResponse> {
  const medications = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: INVENTORY_VACCINE_TYPE_CODE },
        { name: 'status', value: 'active' },
      ],
    })
  ).unbundle();
  return {
    vaccines: medications
      .flatMap((medication) => {
        const identifier = medication.identifier?.find(
          (identifier: Identifier) => identifier.system === MEDICATION_IDENTIFIER_NAME_SYSTEM
        );
        const cvx = getMedicationCvx(medication);
        if (identifier?.value && medication.id && cvx) {
          return [{ id: medication.id, name: identifier.value, cvx }];
        }
        return [];
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// The request takes no parameters; whatever the body holds is not read.
export function validateRequestParameters(input: ZambdaInput): Pick<ZambdaInput, 'secrets'> {
  return {
    secrets: input.secrets,
  };
}
