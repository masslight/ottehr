import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentReconciliation, Provenance, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { isVersionConflictError, makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { ERA_VOID_STATUS } from 'utils/lib/types/data/billing/billing.constants';
import { VoidEraInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { OkResponse } from 'utils/lib/types/data/billing/billing.types';
import { CONCURRENT_UPDATE_WITH_MESSAGE, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUser, getUserToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { createBillingClient, createEraReadClient, fetchById } from '../shared';

type VoidEraParams = ValidatedZambdaInput<typeof VoidEraInputSchema>;

const ERA_CHANGED_ERROR = {
  ...CONCURRENT_UPDATE_WITH_MESSAGE('This ERA has changed. Reload the page before voiding it.'),
  statusCode: 409,
};

let m2mToken: string;
const ZAMBDA_NAME = 'void-billing-era';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(VoidEraInputSchema, input);
  const user = await getUser(getUserToken(input), params.secrets);
  if (!user.profile?.startsWith('Practitioner/')) throw NOT_AUTHORIZED;
  const actor: Reference = { reference: user.profile, display: user.email || user.name };

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const eraReadClient = createEraReadClient(m2mToken, params.secrets);
  const result = await performEffect(oystehr, eraReadClient, params, actor, DateTime.now().toISO());
  return { statusCode: 200, body: JSON.stringify(result) };
});

export async function performEffect(
  oystehr: Oystehr,
  eraReadClient: Oystehr,
  params: VoidEraParams,
  actor: Reference,
  now: string
): Promise<OkResponse> {
  const era = await fetchById<PaymentReconciliation>(eraReadClient, 'PaymentReconciliation', params.eraId);
  if (era.status === ERA_VOID_STATUS) return { ok: true };

  try {
    await oystehr.fhir.transaction<PaymentReconciliation | Provenance>({
      requests: [
        getPatchBinary({
          resourceType: 'PaymentReconciliation',
          resourceId: params.eraId,
          ifMatch: makeOptimisticLockIfMatchHeader(era),
          patchOperations: [{ op: 'replace', path: '/status', value: ERA_VOID_STATUS }],
        }),
        {
          method: 'POST',
          url: '/Provenance',
          resource: {
            resourceType: 'Provenance',
            target: [{ reference: `PaymentReconciliation/${params.eraId}` }],
            recorded: now,
            activity: { text: 'Void ERA' },
            agent: [{ who: actor }],
          },
        },
      ],
    });
  } catch (error) {
    if (!isVersionConflictError(error)) throw error;
    const current = await fetchById<PaymentReconciliation>(eraReadClient, 'PaymentReconciliation', params.eraId);
    if (current.status !== ERA_VOID_STATUS) throw ERA_CHANGED_ERROR;
  }
  return { ok: true };
}
