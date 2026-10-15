import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Money, PaymentNotice, PaymentReconciliation, Reference } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { AddClaimWriteOffInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { createBillingClient, fetchById } from '../shared';
import {
  WRITE_OFF_NOTE_EXT_URL,
  WRITE_OFF_PARTY_EXT_URL,
  WRITE_OFF_PAYER_EXT_URL,
  WRITE_OFF_REASON_EXT_URL,
  WRITE_OFF_SYSTEM,
} from '../write-offs';

type AddClaimWriteOffParams = ValidatedZambdaInput<typeof AddClaimWriteOffInputSchema>;

let m2mToken: string;

export const index = wrapHandler('add-claim-write-off', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(AddClaimWriteOffInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const result = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(result) };
});

export async function performEffect(oystehr: Oystehr, params: AddClaimWriteOffParams): Promise<void> {
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);
  const payeeRef: Reference = claim?.provider ?? {
    reference: getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, params.secrets),
  };

  const amount: Money = { value: params.amount, currency: 'USD' };
  const now = new Date().toISOString();
  const reconciliation: PaymentReconciliation = {
    resourceType: 'PaymentReconciliation',
    id: 'contained-reconciliation',
    status: 'active',
    created: now,
    disposition: `Write-off`,
    outcome: 'complete',
    paymentDate: params.date.slice(0, 10),
    paymentAmount: amount,
  };

  const notice: PaymentNotice = {
    resourceType: 'PaymentNotice',
    status: 'active',
    request: {
      reference: `Claim/${claim.id}`,
    },
    created: now,
    paymentDate: params.date.slice(0, 10),
    amount,
    identifier: [{ system: WRITE_OFF_SYSTEM }],
    contained: [reconciliation],
    payment: { reference: `#${reconciliation.id}` },
    payee: payeeRef,
    recipient: payeeRef,
    extension: [
      {
        url: WRITE_OFF_PARTY_EXT_URL,
        valueString: params.party,
      },
      ...(params.payer
        ? [
            {
              url: WRITE_OFF_PAYER_EXT_URL,
              valueString: params.payer,
            },
          ]
        : []),
      {
        url: WRITE_OFF_REASON_EXT_URL,
        valueString: params.reason,
      },
      ...(params.note
        ? [
            {
              url: WRITE_OFF_NOTE_EXT_URL,
              valueString: params.note,
            },
          ]
        : []),
    ],
  };

  await oystehr.fhir.transaction<PaymentNotice>({
    requests: [
      {
        method: 'POST',
        url: '/PaymentNotice',
        resource: notice,
      },
    ],
  });
}
