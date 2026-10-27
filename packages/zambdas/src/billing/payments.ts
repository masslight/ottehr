import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import {
  Claim,
  Coding,
  FhirResource,
  Money,
  PaymentNotice,
  PaymentReconciliation,
  ProvenanceAgent,
  Reference,
} from 'fhir/r4b';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { makeOptimisticLockIfMatchHeader, withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import { getContainedReconciliation } from 'utils/lib/fhir/payments';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { BILLING_RECORDABLE_PAYMENT_METHODS } from 'utils/lib/types/data/billing/billing.constants';
import { MANUAL_PAYMENT_CONFLICT_ERROR } from 'utils/lib/types/errors';
import { z } from 'zod';
import { safeValidate } from '../shared/validation';
import {
  claimEventProvenanceRequest,
  claimHistoryLinkRequests,
  humanClaimActor,
  resolveClaimActor,
} from './provenance';

// dedup identifier for record-billing-manual-payment calls: value is the caller's idempotency key
export const MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM = ottehrIdentifierSystem('manual-payment-idempotency-key');
// dedup identifier for the clinical→billing bridge: value is the clinical PaymentNotice id, which
// makes task re-fires idempotent and links the billing notice back to its source
export const CLINICAL_PAYMENT_NOTICE_ID_SYSTEM = ottehrIdentifierSystem('clinical-payment-notice-id');
export const CHECK_NUMBER_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('check-number');

const PAYMENT_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/payment-type';

// the bridge bypasses the endpoint's input schema, so the writer re-checks the money fields itself
const RecordablePaymentSchema = z.object({
  amountInCents: z.number().int().positive(),
  paymentMethod: z.enum(BILLING_RECORDABLE_PAYMENT_METHODS),
});

// dedup identifier for manual (non-processor) refunds recorded from the EHR
export const MANUAL_REFUND_ID_SYSTEM = ottehrIdentifierSystem('manual-refund-id');

interface PaymentNoticeIdentifier {
  system: string;
  value: string;
}

export const paymentNoticeClaimId = (notice: PaymentNotice): string | undefined =>
  getIdFromReference(notice.request?.reference, 'Claim');

// Without a claim, the entry targets only the notice until reconcilePaymentNoticesForClaim links it
export function paymentNoticeHistoryRequest({
  targetReference,
  before,
  after,
  agent,
  dedupTag,
}: {
  targetReference: string;
  before?: PaymentNotice;
  after: PaymentNotice;
  agent: ProvenanceAgent;
  dedupTag?: Coding;
}): BatchInputRequest<FhirResource> | null {
  return claimEventProvenanceRequest({
    targetReference,
    claimId: paymentNoticeClaimId(after),
    before,
    after,
    agent,
    activity: before ? 'update' : 'create',
    dedupTag,
  }) as BatchInputRequest<FhirResource> | null;
}

export async function findPaymentNotice(
  oystehr: Oystehr,
  identifier: PaymentNoticeIdentifier
): Promise<PaymentNotice | undefined> {
  const [notice] = (
    await oystehr.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [
        {
          name: 'identifier',
          value: `${identifier.system}|${identifier.value}`,
        },
      ],
    })
  ).unbundle();
  return notice;
}

// The conditional create still guards against a concurrent writer that got past the caller's
// lookup; `created` is false when that writer stored the notice first.
export async function createPaymentNotice({
  oystehr,
  notice,
  dedupIdentifier,
  agent,
}: {
  oystehr: Oystehr;
  notice: PaymentNotice;
  dedupIdentifier: PaymentNoticeIdentifier;
  agent: ProvenanceAgent;
}): Promise<{ notice: PaymentNotice; created: boolean }> {
  const fullUrl = `urn:uuid:${randomUUID()}`;
  const history = paymentNoticeHistoryRequest({
    targetReference: fullUrl,
    after: notice,
    agent,
    // keyed like the notice, so the writer that stored the notice first is the one that records it
    dedupTag: {
      system: dedupIdentifier.system,
      code: dedupIdentifier.value,
    },
  });
  const bundle = await oystehr.fhir.transaction<FhirResource>({
    requests: [
      {
        method: 'POST',
        url: '/PaymentNotice',
        resource: notice,
        fullUrl,
        // tag scoped because clinical PaymentNotices use the same identifier systems
        ifNoneExist: [
          {
            name: 'identifier',
            value: `${dedupIdentifier.system}|${dedupIdentifier.value}`,
          },
          {
            name: '_tag',
            value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}`,
          },
        ],
      },
      ...(history ? [history] : []),
    ],
  });
  const stored = bundle
    .unbundle()
    .find((resource): resource is PaymentNotice => resource.resourceType === 'PaymentNotice');
  if (!stored) throw new Error('The PaymentNotice was saved without being returned');
  // a conditional create that matched an existing notice answers 200 rather than 201
  const status = bundle.entry?.find((entry) => entry.resource?.resourceType === 'PaymentNotice')?.response?.status;
  return {
    notice: stored,
    created: !status?.startsWith('200'),
  };
}

// Attributed to whoever took the payment, else to the system.
export const paymentActor = async (
  oystehr: Oystehr,
  recordedBy: Reference | undefined,
  secrets: Secrets | null
): Promise<ProvenanceAgent> =>
  recordedBy?.reference ? humanClaimActor(recordedBy) : resolveClaimActor('system', oystehr, undefined, secrets);

// Mirrors the stripe webhook's negative refund notice so patient AR stays a plain sum over a
// claim's notices; used for cash/check/external-reader refunds, which have no processor events.
export const recordBillingManualRefund = async (
  oystehr: Oystehr,
  input: {
    encounterId: string;
    refundId: string;
    amountInCents: number;
    paymentMethod: string;
    createdISO: string;
    reason: string;
    secrets: Secrets | null;
  }
): Promise<void> => {
  const { encounterId, refundId, amountInCents, paymentMethod, createdISO, reason, secrets } = input;

  const claim = await findBillingClaimForEncounter(oystehr, encounterId);
  const payeeRef: Reference = claim?.provider ?? {
    reference: getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, secrets),
  };

  const amount: Money = { value: -(amountInCents / 100), currency: 'USD' };
  const reconciliation: PaymentReconciliation = {
    resourceType: 'PaymentReconciliation',
    id: 'contained-reconciliation',
    status: 'active',
    created: createdISO,
    disposition: `Manual ${paymentMethod} refund (${reason})`,
    outcome: 'complete',
    paymentDate: createdISO.slice(0, 10),
    paymentAmount: amount,
  };

  const desiredNotice: PaymentNotice = {
    resourceType: 'PaymentNotice',
    status: 'active',
    request: claimRequestFor(claim, encounterId),
    created: createdISO,
    paymentDate: createdISO.slice(0, 10),
    amount,
    identifier: [{ system: MANUAL_REFUND_ID_SYSTEM, value: refundId }],
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: paymentMethod }],
    contained: [reconciliation],
    payment: { reference: `#${reconciliation.id}` },
    payee: payeeRef,
    recipient: payeeRef,
  };

  const dedupIdentifier = {
    system: MANUAL_REFUND_ID_SYSTEM,
    value: refundId,
  };
  if (!(await findPaymentNotice(oystehr, dedupIdentifier))) {
    await createPaymentNotice({
      oystehr,
      notice: desiredNotice,
      dedupIdentifier,
      agent: await resolveClaimActor('system', oystehr, undefined, secrets),
    });
  }

  if (!claim) {
    // the claim may have appeared while the notice was being stored; reconcile only adds request.reference
    const lateClaim = await findBillingClaimForEncounter(oystehr, encounterId);
    if (lateClaim) {
      await reconcilePaymentNoticesForClaim(oystehr, lateClaim);
    }
  }
};

export const findBillingClaimForEncounter = async (
  oystehr: Oystehr,
  encounterId: string
): Promise<Claim | undefined> => {
  const claims = (
    await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [{ name: 'identifier', value: `${ottehrIdentifierSystem('claim-encounter-id')}|${encounterId}` }],
    })
  ).unbundle();
  if (claims.length > 1) {
    throw new Error(`Found ${claims.length} billing Claims for encounter ${encounterId}, cannot pick one safely`);
  }
  return claims[0];
};

// before the claim exists this is a logical reference only, reconciled once the claim is created
export const claimRequestFor = (claim: Claim | undefined, encounterId: string): Reference => ({
  type: 'Claim',
  identifier: { system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId },
  ...(claim?.id ? { reference: `Claim/${claim.id}` } : {}),
});

export interface RecordBillingPatientPaymentInput {
  encounterId: string;
  amountInCents: number;
  // string rather than the manual-methods enum: the bridge forwards clinical method strings
  paymentMethod: string;
  dedupIdentifier: { system: string; value: string };
  secrets: Secrets | null;
  paymentDate: string;
  createdISO: string;
  checkNumber?: string;
  description?: string;
  submitterRef?: Reference;
}

const paymentFingerprint = (notice: PaymentNotice): string => {
  const reconciliation = getContainedReconciliation(notice);
  return JSON.stringify({
    amount: notice.amount?.value,
    currency: notice.amount?.currency,
    method: notice.extension?.find((ext) => ext.url === PAYMENT_METHOD_EXTENSION_URL)?.valueString,
    encounterId: notice.request?.identifier?.value,
    paymentDate: notice.paymentDate,
    checkNumber: reconciliation?.paymentIdentifier?.value,
    description: reconciliation?.disposition,
  });
};

// Documents a payment collected outside any integrated processor (cash, check, ...) as a
// billing-tagged PaymentNotice, mirroring the stripe webhook's shape. Recorded payments are
// immutable, which is why the webhook's upsert (it refreshes notices on charge.updated) is not
// reused here.
export const recordBillingPatientPayment = async (
  oystehr: Oystehr,
  input: RecordBillingPatientPaymentInput
): Promise<{ notice: PaymentNotice; claimId?: string }> => {
  const {
    encounterId,
    amountInCents,
    paymentMethod,
    dedupIdentifier,
    secrets,
    paymentDate,
    createdISO,
    checkNumber,
    description,
    submitterRef,
  } = input;

  safeValidate(RecordablePaymentSchema, { amountInCents, paymentMethod });

  const claim = await findBillingClaimForEncounter(oystehr, encounterId);

  // the provider owed the money: the claim's provider when a claim exists, else the default
  // billing organization (the same default claim creation uses)
  const payeeRef: Reference = claim?.provider ?? {
    reference: getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, secrets),
  };

  const paymentAmount: Money = {
    value: amountInCents / 100,
    currency: 'USD',
  };

  const reconciliation: PaymentReconciliation = {
    resourceType: 'PaymentReconciliation',
    id: 'contained-reconciliation',
    status: 'active',
    created: createdISO,
    disposition: description ?? `${paymentMethod} payment collected manually`,
    outcome: 'complete',
    paymentDate,
    paymentAmount,
    ...(checkNumber ? { paymentIdentifier: { system: CHECK_NUMBER_IDENTIFIER_SYSTEM, value: checkNumber } } : {}),
    ...(submitterRef
      ? {
          detail: [
            {
              type: { coding: [{ system: PAYMENT_TYPE_SYSTEM, code: 'payment' }] },
              submitter: submitterRef,
            },
          ],
        }
      : {}),
  };

  const desiredNotice: PaymentNotice = {
    resourceType: 'PaymentNotice',
    status: 'active',
    request: claimRequestFor(claim, encounterId),
    created: createdISO,
    paymentDate,
    amount: paymentAmount,
    identifier: [{ system: dedupIdentifier.system, value: dedupIdentifier.value }],
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: paymentMethod }],
    contained: [reconciliation],
    payment: { reference: `#${reconciliation.id}` },
    payee: payeeRef,
    recipient: payeeRef,
  };

  const returned =
    (await findPaymentNotice(oystehr, dedupIdentifier)) ??
    (
      await createPaymentNotice({
        oystehr,
        notice: desiredNotice,
        dedupIdentifier,
        agent: await paymentActor(oystehr, submitterRef, secrets),
      })
    ).notice;

  if (paymentFingerprint(returned) !== paymentFingerprint(desiredNotice)) {
    throw MANUAL_PAYMENT_CONFLICT_ERROR(dedupIdentifier.value);
  }

  let claimId = claim?.id ?? paymentNoticeClaimId(returned);
  if (!claimId) {
    // the claim may have appeared while the notice was being stored; reconcile only adds request.reference
    const lateClaim = await findBillingClaimForEncounter(oystehr, encounterId);
    if (lateClaim) {
      await reconcilePaymentNoticesForClaim(oystehr, lateClaim);
      claimId = lateClaim.id;
    }
  }

  return { notice: returned, claimId };
};

async function noticeLinkHistory({
  oystehr,
  claimId,
  notices,
}: {
  oystehr: Oystehr;
  claimId: string;
  notices: PaymentNotice[];
}): Promise<(notice: PaymentNotice) => BatchInputRequest<FhirResource>[]> {
  const linkRequests = await claimHistoryLinkRequests({
    oystehr,
    claimId,
    targetReferences: notices.map((notice) => `PaymentNotice/${notice.id}`),
  });
  const systemActor = notices.some((notice) => !linkRequests.has(`PaymentNotice/${notice.id}`))
    ? await resolveClaimActor('system', oystehr, undefined, null)
    : undefined;
  return (notice) => {
    const targetReference = `PaymentNotice/${notice.id}`;
    const links = linkRequests.get(targetReference);
    if (links) return links;
    // notices stored before claim history was kept have no entry to link, so they get one now
    const entry =
      systemActor &&
      paymentNoticeHistoryRequest({
        targetReference,
        after: {
          ...notice,
          request: {
            ...notice.request,
            reference: `Claim/${claimId}`,
          },
        },
        agent: systemActor,
      });
    return entry ? [entry] : [];
  };
}

// Links notices stored before the claim existed, and the claim history entries recorded with them.
export async function reconcilePaymentNoticesForClaim(oystehr: Oystehr, claim: Claim): Promise<void> {
  const encounterIdSystem = ottehrIdentifierSystem('claim-encounter-id');
  const encounterId = claim.identifier?.find((i) => i.system === encounterIdSystem)?.value;
  if (!claim.id || !encounterId) return;

  const notices = (
    await oystehr.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [
        {
          name: 'request:identifier',
          value: `${encounterIdSystem}|${encounterId}`,
        },
      ],
    })
  ).unbundle();

  const unlinked = notices.filter((n) => n.id && !n.request?.reference);
  if (unlinked.length === 0) return;

  const claimId = claim.id;
  const searchedHistory = await noticeLinkHistory({
    oystehr,
    claimId,
    notices: unlinked,
  });

  // each notice commits with its history, so one that fails is left whole for the next reconcile;
  // the link is locked to the version its history was read at, so an entry written since is not
  // left behind
  const results = await Promise.allSettled(
    unlinked.map((notice) =>
      withVersionConflictRetries(async (attempt) => {
        const current =
          attempt === 1
            ? notice
            : await oystehr.fhir.get<PaymentNotice>({
                resourceType: 'PaymentNotice',
                id: notice.id!,
              });
        if (current.request?.reference) return;
        const historyRequests =
          attempt === 1
            ? searchedHistory
            : await noticeLinkHistory({
                oystehr,
                claimId,
                notices: [current],
              });
        await oystehr.fhir.transaction<FhirResource>({
          requests: [
            getPatchBinary({
              resourceType: 'PaymentNotice',
              resourceId: current.id!,
              ifMatch: makeOptimisticLockIfMatchHeader(current),
              patchOperations: [
                {
                  op: 'add',
                  path: '/request/reference',
                  value: `Claim/${claimId}`,
                },
              ],
            }),
            ...historyRequests(current),
          ],
        });
      })
    )
  );
  const failedCount = results.filter((result) => result.status === 'rejected').length;
  if (failedCount > 0) {
    console.warn(`reconcilePaymentNoticesForClaim: ${failedCount} of ${unlinked.length} notices failed to link`);
  }
  console.log(`Linked ${unlinked.length - failedCount} PaymentNotice(s) to Claim/${claim.id}`);
}
