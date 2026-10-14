import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import { VoidClaimWriteOffInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { createBillingClient, fetchById } from '../shared';
import { buildWriteOffVoidExtension, WRITE_OFF_VOID_EXT_URL } from '../write-offs';

type VoidClaimWriteOffParams = ValidatedZambdaInput<typeof VoidClaimWriteOffInputSchema>;

let m2mToken: string;

export const index = wrapHandler('void-claim-write-off', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(VoidClaimWriteOffInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const result = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(result) };
});

export async function performEffect(oystehr: Oystehr, params: VoidClaimWriteOffParams): Promise<void> {
  const notice = await fetchById<PaymentNotice>(oystehr, 'PaymentNotice', params.writeOffId);
  const extension = [
    ...(notice.extension ?? []).filter((ext) => ext.url !== WRITE_OFF_VOID_EXT_URL),
    buildWriteOffVoidExtension({ date: new Date().toISOString() }),
  ];

  await oystehr.fhir.transaction<PaymentNotice>({
    requests: [
      {
        method: 'PATCH',
        url: `/PaymentNotice/${params.writeOffId}`,
        operations: [
          { op: 'replace', path: '/status', value: 'cancelled' },
          { op: notice.extension !== undefined ? 'replace' : 'add', path: '/extension', value: extension },
        ],
      },
    ],
  });
}
