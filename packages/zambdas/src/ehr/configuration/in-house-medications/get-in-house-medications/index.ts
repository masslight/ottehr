import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication } from 'fhir/r4b';
import { getCatalogMedicationType } from 'utils/lib/fhir/medication-inventory';
import {
  INVENTORY_MEDICATION_TYPE_CODE,
  INVENTORY_VACCINE_TYPE_CODE,
} from 'utils/lib/types/api/medication-administration.constants';
import { checkOrCreateM2MClientToken } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'admin-get-in-house-medications',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const oystehr = createClinicalOystehrClient(m2mToken, secrets);
    console.log('Created Oystehr client');

    const response = await performEffect(oystehr);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }
);

export const performEffect = async (oystehr: Oystehr): Promise<Medication[]> => {
  const medications = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [
        // Medications and vaccines share the catalog.
        {
          name: 'identifier',
          value: `${INVENTORY_MEDICATION_TYPE_CODE},${INVENTORY_VACCINE_TYPE_CODE}`,
        },
      ],
    })
  ).unbundle();
  // The vaccine type is also on Medications that are not catalog vaccines (they have no CVX code); leave them out.
  return medications.filter((medication) => getCatalogMedicationType(medication) !== undefined);
};
