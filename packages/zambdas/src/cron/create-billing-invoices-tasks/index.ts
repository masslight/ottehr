import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  BillingInvoiceTaskClaim,
  chooseJson,
  CREATE_INVOICE_TASKS_FOR_BILLING_CLAIMS_ZAMBDA_KEY,
  CreateInvoiceTasksForBillingClaimsResponse,
} from 'utils';
import { fetchAllActivePatientArClaims } from '../../billing/search-billing-patient-ar-claims/handler';
import { createBillingClient, createEraReadClient } from '../../billing/shared';
import { checkOrCreateM2MClientToken, isOttehrBillingInvoicingEnabled, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'create-billing-invoices-tasks';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (!isOttehrBillingInvoicingEnabled(secrets)) {
    console.log('Ottehr billing invoicing is disabled for this env (BILLING_INTEGRATION or feature flag); skipping');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Ottehr billing invoicing disabled, no tasks created' }),
    };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const billingClient = createBillingClient(m2mToken, secrets);
  const eraReadClient = createEraReadClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect({
    billingClient,
    eraReadClient,
  });
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

interface PerformEffectParams {
  billingClient: Oystehr;
  eraReadClient: Oystehr;
}

interface PerformEffectResponse extends CreateInvoiceTasksForBillingClaimsResponse {
  message: string;
}

async function performEffect(params: PerformEffectParams): Promise<PerformEffectResponse> {
  const { billingClient, eraReadClient } = params;

  const arClaims = await fetchAllActivePatientArClaims({
    billingClient,
    eraReadClient,
  });
  console.log(`Active patient AR claims: ${arClaims.length}`);

  const claims: BillingInvoiceTaskClaim[] = [];
  for (const item of arClaims) {
    if (!item.encounterId) {
      console.warn(`Patient AR claim ${item.claimId} has no encounter linkage; cannot create invoice task`);
      continue;
    }
    claims.push({
      claimId: item.claimId,
      encounterId: item.encounterId,
      finalizationDate: item.finalizationDate,
      balance: item.balance,
    });
  }

  if (claims.length === 0) {
    return {
      message: 'No linked patient AR claims to invoice',
      created: 0,
      skipped: 0,
    };
  }

  const result = chooseJson<CreateInvoiceTasksForBillingClaimsResponse>(
    await billingClient.zambda.execute({
      id: CREATE_INVOICE_TASKS_FOR_BILLING_CLAIMS_ZAMBDA_KEY,
      claims,
    })
  );
  console.log(`Clinical endpoint created ${result.created} task(s), skipped ${result.skipped}`);

  return {
    message: 'Successfully created tasks for billing claims',
    ...result,
  };
}
