import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, PaymentReconciliation } from 'fhir/r4b';
import { ERA_SOURCE } from 'utils/lib/types/data/billing/billing.constants';
import { ImportEraInput, ImportEraInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { ERA_IMPORT_FAILED_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { validateJsonBody } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';
import { createBillingClient, createEraReadClient, ERA_SOURCE_EXTENSION } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'import-era';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const eraReadClient = createEraReadClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, eraReadClient, params);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function performEffect(oystehr: Oystehr, eraReadClient: Oystehr, params: ImportEraParams): Promise<Bundle> {
  let bundle: Bundle;
  try {
    bundle = await oystehr.rcm.processEra({ edi835: params.era });
  } catch (error) {
    const sdkError = error as Partial<Oystehr.OystehrSdkError>;
    console.log('Error code from Oystehr SDK:', sdkError.code);
    const statusCode =
      typeof sdkError.code === 'number' && sdkError.code >= 400 && sdkError.code <= 499 ? sdkError.code : 500;
    throw ERA_IMPORT_FAILED_ERROR(sdkError.message ?? 'Failed to process ERA', statusCode);
  }

  await markImportedEra(eraReadClient, bundle);
  return bundle;
}

// Stamps the imported ERA's PaymentReconciliation as an X12 import, so the ERA list can tell it from a
// clearing-house delivery. Best effort: the import has already succeeded. The resources are untagged
// (Oystehr writes them), hence the untagged client; the extension is appended, never replaced, so the
// raw 835 extension stays put.
export async function markImportedEra(eraReadClient: Oystehr, bundle: Bundle): Promise<void> {
  try {
    const entry = bundle.entry?.find(
      (candidate) =>
        candidate.resource?.resourceType === 'PaymentReconciliation' ||
        candidate.response?.location?.startsWith('PaymentReconciliation/')
    );
    const id = entry?.resource?.id ?? entry?.response?.location?.split('/')[1];
    if (!id) {
      console.warn('import-era: the processed bundle has no PaymentReconciliation to mark');
      return;
    }
    const pr = await eraReadClient.fhir.get<PaymentReconciliation>({ resourceType: 'PaymentReconciliation', id });
    if (pr.extension?.some((ext) => ext.url === ERA_SOURCE_EXTENSION)) return;
    const marker = { url: ERA_SOURCE_EXTENSION, valueCode: ERA_SOURCE.x12Import };
    await eraReadClient.fhir.patch<PaymentReconciliation>({
      resourceType: 'PaymentReconciliation',
      id,
      operations: [
        pr.extension?.length
          ? { op: 'add', path: '/extension/-', value: marker }
          : { op: 'add', path: '/extension', value: [marker] },
      ],
    });
  } catch (error) {
    console.error('import-era: could not mark the ERA as imported', error);
  }
}

interface ImportEraParams extends ImportEraInput {
  secrets: ZambdaInput['secrets'];
}

function validateRequestParameters(input: ZambdaInput): ImportEraParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(ImportEraInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
