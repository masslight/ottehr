import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication } from 'fhir/r4b';
import { isCatalogMedication } from 'utils/lib/fhir/medication-inventory';
import {
  LookupNdcInput,
  LookupNdcInputSchema,
  LookupNdcResponse,
} from 'utils/lib/types/api/config/in-house-medications';
import { INVENTORY_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { validateWithSchema } from '../../../../shared/validation';
import { settledValueOrThrow } from '../../../shared/settled';
import { compareNdcProduct, fetchNdcProduct, ndcPackageCandidates } from './helpers';

let m2mToken: string;

export const index = wrapHandler('admin-lookup-ndc', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, ...params } = validateWithSchema(LookupNdcInputSchema, input);

  await requireUserWithRole(getUserToken(input), secrets, INVENTORY_STAFF_ROLES);

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
  const candidates = ndcPackageCandidates(ndc);
  const [catalogResult, productResult] = await Promise.allSettled([
    oystehr.fhir.get<Medication>({ resourceType: 'Medication', id: medicationId }),
    candidates.length > 0 ? fetchNdcProduct(candidates) : undefined,
  ]);
  const catalog = settledValueOrThrow(catalogResult);
  if (!isCatalogMedication(catalog)) throw FHIR_RESOURCE_NOT_FOUND('Medication');

  if (candidates.length === 0) return { status: 'not-found' };

  if (productResult.status === 'rejected') {
    // An unavailable directory must not block receiving.
    console.error('openFDA NDC lookup failed', productResult.reason);
    captureException(productResult.reason);
    return { status: 'unavailable' };
  }
  const product = productResult.value;
  if (!product) return { status: 'not-found' };

  return { ...compareNdcProduct(product, catalog), product };
};
