import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import {
  Claim,
  Coding,
  Extension,
  FhirResource,
  Identifier,
  Money,
  Organization,
  PaymentNotice,
  PaymentReconciliation,
  ProvenanceAgent,
  Reference,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BILLING_RESOURCE_TAG,
  PAYMENT_METHOD_EXTENSION_URL,
  PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { makeOptimisticLockIfMatchHeader, withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import {
  isSettledRefund,
  parsePaymentRefundsFromNotice,
  parsePaymentVoidFromNotice,
} from 'utils/lib/fhir/paymentRefunds';
import { getContainedReconciliation } from 'utils/lib/fhir/payments';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { TIMEZONES } from 'utils/lib/types/constants';
import { BILLING_RECORDABLE_PAYMENT_METHODS } from 'utils/lib/types/data/billing/billing.constants';
import { MANUAL_PAYMENT_CONFLICT_ERROR } from 'utils/lib/types/errors';
import { z } from 'zod';
import { PaymentNoticeChangeRecorder, STRIPE_PAYMENT_ID_SYSTEM } from '../shared/stripeIntegration';
import { safeValidate } from '../shared/validation';
import {
  claimEventProvenanceRequest,
  claimHistoryLinkRequests,
  humanClaimActor,
  resolveClaimActor,
} from './provenance';
import { STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from './shared';

// dedup identifier for record-billing-manual-payment calls: value is the caller's idempotency key
export const MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM = ottehrIdentifierSystem('manual-payment-idempotency-key');
// dedup identifier for the clinical→billing bridge: value is the clinical PaymentNotice id, which
// makes task re-fires idempotent and links the billing notice back to its source
export const CLINICAL_PAYMENT_NOTICE_ID_SYSTEM = ottehrIdentifierSystem('clinical-payment-notice-id');
export const CHECK_NUMBER_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('check-number');
// dedup identifier for post-billing-patient-payment calls: value is `<encounterId>_<idempotency key>`,
// scoped to the encounter because the key is client supplied
export const EHR_PATIENT_PAYMENT_ID_SYSTEM = ottehrIdentifierSystem('ehr-patient-payment-id');
// The same value on a card payment the EHR reserved before charging the card. The draft carries no
// claim link and none of the identifier systems payment readers search by, so nothing lists it; once
// the charge succeeds it is activated in place and gains the EHR_PATIENT_PAYMENT_ID_SYSTEM identifier.
// The reservation identifier stays, so a replay of the request that reserved it finds the payment
// instead of reserving it a second time.
export const EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM = ottehrIdentifierSystem('ehr-pending-patient-payment-id');

// Activation, and only activation, gives a reservation the EHR payment id; a payment stays activated
// whatever happens to it later, also once voided (which cancels it).
export const isActivatedEhrPaymentNotice = (notice: PaymentNotice): boolean =>
  (notice.identifier ?? []).some((identifier) => identifier.system === EHR_PATIENT_PAYMENT_ID_SYSTEM);

// A reservation not activated yet, whether a draft or cancelled after its charge failed.
export const isPendingEhrPaymentNotice = (notice: PaymentNotice): boolean =>
  !isActivatedEhrPaymentNotice(notice) &&
  (notice.identifier ?? []).some((identifier) => identifier.system === EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM);

// The reservation of a card payment the EHR is about to take: the notice it will record, as a draft no
// payment reader can find.
export const pendingEhrPaymentNotice = (notice: PaymentNotice, ehrPaymentId: string): PaymentNotice => {
  const { request: _request, ...unlinked } = notice;
  return {
    ...unlinked,
    status: 'draft',
    identifier: [{ system: EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM, value: ehrPaymentId }],
    contained: notice.contained?.map((resource) =>
      resource.resourceType === 'PaymentReconciliation' ? { ...resource, status: 'draft' } : resource
    ),
  };
};

// The date an EHR patient payment is reported on: for now the day it was taken in the default timezone
// (US Eastern); the exact date in any other can be derived from the UTC created timestamp.
export const ehrPaymentDate = (takenAt: DateTime): string => takenAt.setZone(TIMEZONES[0]).toFormat('yyyy-MM-dd');

// An activated reservation is known by the EHR payment id, which payment readers search by, and keeps
// the reservation identifier replays reserve by.
export const withActivatedEhrPaymentId = (
  identifiers: Identifier[] | undefined,
  ehrPaymentId: string | undefined
): Identifier[] => {
  const all = identifiers ?? [];
  const value =
    ehrPaymentId ?? all.find((identifier) => identifier.system === EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM)?.value;
  if (!value) return all;
  const missing = [EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM, EHR_PATIENT_PAYMENT_ID_SYSTEM].filter(
    (system) => !all.some((identifier) => identifier.system === system)
  );
  return [...all, ...missing.map((system) => ({ system, value }))];
};

const PAYMENT_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/payment-type';

// the bridge bypasses the endpoint's input schema, so the writer re-checks the money fields itself
const RecordablePaymentSchema = z.object({
  amountInCents: z.number().int().positive(),
  paymentMethod: z.enum(BILLING_RECORDABLE_PAYMENT_METHODS),
});

// dedup identifier for manual (non-processor) refunds recorded from the EHR
export const MANUAL_REFUND_ID_SYSTEM = ottehrIdentifierSystem('manual-refund-id');

// Stripe calls on the platform account take no account id, so the stamp names it explicitly: a
// notice without the stamp predates it, which is not the same as a platform-account payment.
const PLATFORM_STRIPE_ACCOUNT = 'platform';

export const stripeAccountExtension = (stripeAccount: string | undefined): Extension => ({
  url: PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL,
  valueString: stripeAccount ?? PLATFORM_STRIPE_ACCOUNT,
});

// The Stripe account stamped on the notice: `{ stripeAccount: undefined }` for the platform
// account, undefined when the notice carries no stamp.
export const stampedStripeAccount = (notice: PaymentNotice): { stripeAccount: string | undefined } | undefined => {
  const value = notice.extension?.find((ext) => ext.url === PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL)?.valueString;
  if (!value) return undefined;
  return { stripeAccount: value === PLATFORM_STRIPE_ACCOUNT ? undefined : value };
};

// replaces the notice's stamp, if any, with the given one
export const withStripeAccountExtension = (
  extension: Extension[] | undefined,
  stripeAccount: string | undefined
): Extension[] => [
  ...(extension ?? []).filter((ext) => ext.url !== PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL),
  stripeAccountExtension(stripeAccount),
];

// identifier filter (`system|` matches any value) selecting patient payment and refund notices,
// which keeps write-offs and other billing PaymentNotices out
export const PATIENT_PAYMENT_IDENTIFIER_FILTER = [
  MANUAL_REFUND_ID_SYSTEM,
  STRIPE_PAYMENT_ID_SYSTEM,
  MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM,
  CLINICAL_PAYMENT_NOTICE_ID_SYSTEM,
  EHR_PATIENT_PAYMENT_ID_SYSTEM,
]
  .map((system) => `${system}|`)
  .join(',');

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

// The user the EHR stamped on a void, or on every new refund that moved money; a change several users
// share, or one a refund nobody stamped is part of, has no single issuer
const changeIssuerReference = (before: PaymentNotice, after: PaymentNotice): string | undefined => {
  const voidedByReference = parsePaymentVoidFromNotice(after)?.voidedByReference;
  if (voidedByReference && !parsePaymentVoidFromNotice(before)) return voidedByReference;
  const priorRefundIds = new Set((parsePaymentRefundsFromNotice(before) ?? []).map((refund) => refund.stripeRefundId));
  const issuers = new Set(
    (parsePaymentRefundsFromNotice(after) ?? [])
      .filter((refund) => !priorRefundIds.has(refund.stripeRefundId) && isSettledRefund(refund))
      .map((refund) => refund.refundedByReference)
  );
  const [issuer] = issuers;
  return issuers.size === 1 ? issuer : undefined;
};

// For the shared refund and void writers, which stamp billing copies and clinical notices alike;
// changes no user stamped are attributed to fallbackAgent
export const recordPaymentNoticeChange =
  (fallbackAgent: ProvenanceAgent): PaymentNoticeChangeRecorder =>
  (before, after) => {
    const issuerReference = changeIssuerReference(before, after);
    return paymentNoticeHistoryRequest({
      targetReference: `PaymentNotice/${before.id}`,
      before,
      after,
      agent: issuerReference
        ? humanClaimActor({
            reference: issuerReference,
          })
        : fallbackAgent,
    });
  };

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

// The notice carrying any of the identifiers, which are expected to name the same payment.
export async function findPaymentNoticeByAnyIdentifier(
  oystehr: Oystehr,
  identifiers: PaymentNoticeIdentifier[]
): Promise<PaymentNotice | undefined> {
  const [notice] = (
    await oystehr.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [
        {
          name: 'identifier',
          value: identifiers.map((identifier) => `${identifier.system}|${identifier.value}`).join(','),
        },
      ],
    })
  ).unbundle();
  return notice;
}

// The conditional create still guards against a concurrent writer that got past the caller's
// lookup; `created` is false when that writer stored the notice first. Without an agent nothing is
// recorded in claim history, as for a reservation that is not a payment yet.
export async function createPaymentNotice({
  oystehr,
  notice,
  dedupIdentifier,
  agent,
}: {
  oystehr: Oystehr;
  notice: PaymentNotice;
  dedupIdentifier: PaymentNoticeIdentifier;
  agent: ProvenanceAgent | undefined;
}): Promise<{ notice: PaymentNotice; created: boolean }> {
  const fullUrl = `urn:uuid:${randomUUID()}`;
  const history =
    agent &&
    paymentNoticeHistoryRequest({
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

// Attributed to whoever took the payment or issued the refund, else to the system.
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
    refundedByReference?: string;
    secrets: Secrets | null;
  }
): Promise<void> => {
  const { encounterId, refundId, amountInCents, paymentMethod, createdISO, reason, refundedByReference, secrets } =
    input;

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
      agent: await paymentActor(
        oystehr,
        refundedByReference
          ? {
              reference: refundedByReference,
            }
          : undefined,
        secrets
      ),
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

// The payee of a payment taken through Stripe: the billing provider org stamped with the connected
// account id, or the default org otherwise. Every writer of a Stripe payment's notice uses this, so
// the payee does not depend on which one stores it first. Providers sharing an account share a TIN,
// so the first match is fine.
export const billingProviderRefForStripeAccount = async (
  oystehr: Oystehr,
  stripeAccount: string | undefined,
  secrets: Secrets | null
): Promise<Reference> => {
  if (stripeAccount) {
    const providers = (
      await oystehr.fhir.search<Organization>({
        resourceType: 'Organization',
        params: [{ name: 'identifier', value: `${STRIPE_ACCOUNT_IDENTIFIER_SYSTEM}|${stripeAccount}` }],
      })
    ).unbundle();
    if (providers[0]?.id) return { reference: `Organization/${providers[0].id}` };
    console.warn(`No billing provider carries stripe account ${stripeAccount}, using the default organization`);
  }
  return { reference: `Organization/${getSecret(SecretsKeys.ORGANIZATION_ID, secrets)}` };
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
