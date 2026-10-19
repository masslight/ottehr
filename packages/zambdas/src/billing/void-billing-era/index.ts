import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ClaimResponse, PaymentReconciliation, Provenance, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { isVersionConflictError, makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { ERA_VOID_STATUS } from 'utils/lib/types/data/billing/billing.constants';
import { VoidEraInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { OkResponse } from 'utils/lib/types/data/billing/billing.types';
import { CONCURRENT_UPDATE_WITH_MESSAGE } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken } from '../../shared/auth';
import { assertDefined } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { fetchClaimResponsesByPaymentReconciliations } from '../claim-amounts';
import { getEraActor } from '../era-write';
import {
  createBillingClient,
  createEraReadClient,
  ERA_VOID_ACTIVITY_CODE,
  fetchById,
  PROVENANCE_ACTIVITY_TYPE_SYSTEM,
} from '../shared';

type VoidEraParams = ValidatedZambdaInput<typeof VoidEraInputSchema>;

const ERA_CHANGED_ERROR = {
  ...CONCURRENT_UPDATE_WITH_MESSAGE('This ERA has changed. Reload the page before voiding it.'),
  statusCode: 409,
};

let m2mToken: string;
const ZAMBDA_NAME = 'void-billing-era';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(VoidEraInputSchema, input);
  const actor = await getEraActor(getUserToken(input), params.secrets);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const eraReadClient = createEraReadClient(m2mToken, params.secrets);
  const result = await performEffect(oystehr, eraReadClient, params, actor, DateTime.now().toISO());
  return { statusCode: 200, body: JSON.stringify(result) };
});

// Voids the ERA and its ClaimResponses, so claim balances leave them out with a plain status filter.
export async function performEffect(
  oystehr: Oystehr,
  eraReadClient: Oystehr,
  params: VoidEraParams,
  actor: Reference,
  now: string
): Promise<OkResponse> {
  const era = await fetchById<PaymentReconciliation>(eraReadClient, 'PaymentReconciliation', params.eraId);
  if (era.status === ERA_VOID_STATUS) return { ok: true };
  const claimResponseIds = (
    (await fetchClaimResponsesByPaymentReconciliations(eraReadClient, [era])).get(params.eraId) ?? []
  ).map((claimResponse) => assertDefined(claimResponse.id, 'ClaimResponse id'));

  try {
    await oystehr.fhir.transaction<PaymentReconciliation | ClaimResponse | Provenance>({
      requests: [
        // A remit saved after the read above could add a ClaimResponse this void would miss.
        getPatchBinary({
          resourceType: 'PaymentReconciliation',
          resourceId: params.eraId,
          ifMatch: makeOptimisticLockIfMatchHeader(era),
          patchOperations: [{ op: 'replace', path: '/status', value: ERA_VOID_STATUS }],
        }),
        ...claimResponseIds.map((id) =>
          getPatchBinary({
            resourceType: 'ClaimResponse',
            resourceId: id,
            patchOperations: [{ op: 'replace', path: '/status', value: ERA_VOID_STATUS }],
          })
        ),
        {
          method: 'POST',
          url: '/Provenance',
          resource: {
            resourceType: 'Provenance',
            target: [
              { reference: `PaymentReconciliation/${params.eraId}` },
              ...claimResponseIds.map((id) => ({ reference: `ClaimResponse/${id}` })),
            ],
            recorded: now,
            activity: { coding: [{ system: PROVENANCE_ACTIVITY_TYPE_SYSTEM, code: ERA_VOID_ACTIVITY_CODE }] },
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
