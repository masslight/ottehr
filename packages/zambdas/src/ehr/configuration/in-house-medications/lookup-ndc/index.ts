import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication } from 'fhir/r4b';
import { isCatalogMedication } from 'utils/lib/fhir/medication-inventory';
import { LookupNdcInput, LookupNdcResponse } from 'utils/lib/types/api/config/in-house-medications';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { compareNdcProduct, fetchNdcProduct, ndcPackageCandidates } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('admin-lookup-ndc', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, ...params } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const response = await performEffect(oystehr, params);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export const performEffect = async (
  oystehr: Oystehr,
  { ndc, medicationId }: LookupNdcInput
): Promise<LookupNdcResponse> => {
  const catalog = await oystehr.fhir.get<Medication>({ resourceType: 'Medication', id: medicationId });
  if (!isCatalogMedication(catalog)) throw FHIR_RESOURCE_NOT_FOUND('Medication');

  const candidates = ndcPackageCandidates(ndc);
  if (candidates.length === 0) return { status: 'not-found' };

  let product;
  try {
    product = await fetchNdcProduct(candidates);
  } catch (error) {
    // The directory being down or slow must not block receiving: the UI shows "lookup unavailable".
    console.error('openFDA NDC lookup failed', error);
    captureException(error);
    return { status: 'unavailable' };
  }
  if (!product) return { status: 'not-found' };

  return { ...compareNdcProduct(product, catalog), product };
};
