import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ClaimResponse, PaymentReconciliation, Provenance } from 'fhir/r4b';
import { sleep } from 'utils';
import {
  eraProvenanceTargetIds,
  fetchClaimResponsesFromEraProvenances,
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
  console.debug('complexValidation success', {
    provenanceCount: validated.provenances.length,
    claimResponseCount: validated.claimResponses.length,
  });

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
  claimResponses: ClaimResponse[];
}

export async function complexValidation(oystehr: Oystehr, paymentReconciliationId: string): Promise<ValidatedTagging> {
  const targetRef = `PaymentReconciliation/${paymentReconciliationId}`;
  let found: ValidatedTagging | undefined;

  for (let attempt = 1; attempt <= PROVENANCE_LOOKUP_ATTEMPTS; attempt++) {
    const provenances = await fetchEraProcessingProvenances(oystehr, [targetRef]);
    if (provenances.length > 0) {
      const claimResponses =
        (await fetchClaimResponsesFromEraProvenances(oystehr, provenances)).get(paymentReconciliationId) ?? [];
      found = {
        paymentReconciliationId,
        provenances,
        claimResponses,
      };
      const expectedClaimResponseIds = new Set(provenances.flatMap((p) => eraProvenanceTargetIds(p, 'ClaimResponse')));
      const foundClaimResponseIds = new Set(claimResponses.map((cr) => cr.id));
      if ([...expectedClaimResponseIds].every((id) => foundClaimResponseIds.has(id))) {
        return found;
      }
      console.log(
        `ClaimResponses for ${targetRef} incomplete (${foundClaimResponseIds.size}/${expectedClaimResponseIds.size}) on attempt ${attempt}; retrying`
      );
    } else {
      console.log(`No era-processing Provenance for ${targetRef} yet (attempt ${attempt}); retrying`);
    }
    if (attempt < PROVENANCE_LOOKUP_ATTEMPTS) {
      await sleep(PROVENANCE_LOOKUP_DELAY_MS);
    }
  }

  if (found) return found;
  throw new Error(`No era-processing Provenance found for ${targetRef} after ${PROVENANCE_LOOKUP_ATTEMPTS} attempts`);
}

export async function performEffect(oystehr: Oystehr, validated: ValidatedTagging): Promise<{ tagged: number }> {
  const { paymentReconciliationId, provenances, claimResponses } = validated;
  const paymentReconciliation = await fetchById<PaymentReconciliation>(
    oystehr,
    'PaymentReconciliation',
    paymentReconciliationId
  );

  const tagged = await tagEraResources({
    oystehr,
    resources: [paymentReconciliation, ...provenances, ...claimResponses],
  });
  return {
    tagged,
  };
}
