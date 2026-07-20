import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentReconciliation, Provenance } from 'fhir/r4b';
import { sleep } from 'utils';
import {
  fetchClaimResponsesByPaymentReconciliations,
  fetchEraProcessingProvenances,
} from '../../../billing/claim-amounts';
import { createEraReadClient, fetchById, tagEraResources } from '../../../billing/shared';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'sub-tag-era-resources';

const PROVENANCE_LOOKUP_ATTEMPTS = 5;
const PROVENANCE_LOOKUP_DELAY_MS = 2000;

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createEraReadClient(m2mToken, secrets);

  console.group('complexValidation');
  const validated = await complexValidation(oystehr, params.paymentReconciliationId);
  console.groupEnd();
  console.debug('complexValidation success', { provenanceCount: validated.provenances.length });

  console.group('performEffect');
  const response = await performEffect(oystehr, validated);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export interface ValidatedTagging {
  paymentReconciliationId: string;
  provenances: Provenance[];
}

export async function complexValidation(oystehr: Oystehr, paymentReconciliationId: string): Promise<ValidatedTagging> {
  const targetRef = `PaymentReconciliation/${paymentReconciliationId}`;
  for (let attempt = 1; attempt <= PROVENANCE_LOOKUP_ATTEMPTS; attempt++) {
    const provenances = await fetchEraProcessingProvenances(oystehr, [targetRef]);
    if (provenances.length > 0) {
      return {
        paymentReconciliationId,
        provenances,
      };
    }
    if (attempt < PROVENANCE_LOOKUP_ATTEMPTS) {
      console.log(`No era-processing Provenance for ${targetRef} yet (attempt ${attempt}); retrying`);
      await sleep(PROVENANCE_LOOKUP_DELAY_MS);
    }
  }

  throw new Error(`No era-processing Provenance found for ${targetRef} after ${PROVENANCE_LOOKUP_ATTEMPTS} attempts`);
}

export async function performEffect(oystehr: Oystehr, validated: ValidatedTagging): Promise<{ tagged: number }> {
  const { paymentReconciliationId, provenances } = validated;
  const paymentReconciliation = await fetchById<PaymentReconciliation>(
    oystehr,
    'PaymentReconciliation',
    paymentReconciliationId
  );
  const claimResponses =
    (await fetchClaimResponsesByPaymentReconciliations(oystehr, [paymentReconciliation])).get(
      paymentReconciliationId
    ) ?? [];

  const tagged = await tagEraResources({
    oystehr,
    resources: [paymentReconciliation, ...provenances, ...claimResponses],
  });
  return {
    tagged,
  };
}
