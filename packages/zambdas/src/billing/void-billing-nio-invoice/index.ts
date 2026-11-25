import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FhirResource, Invoice, PaymentNotice, ProvenanceAgent } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  getBillingInvoiceKind,
  getInvoiceCardPaymentReservation,
  getInvoiceNumber,
} from 'utils/lib/fhir/billing-invoice';
import { isVersionConflictError, makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { VoidBillingInvoiceInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { OkResponse } from 'utils/lib/types/data/billing/billing.types';
import { BILLING_INVOICE_CONFLICT_ERROR, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { invoiceHasPayment } from '../claim-amounts';
import { CARD_RESERVATION_MAX_LIFETIME_MINUTES, settleOtherCardReservation } from '../invoice-card-reservation';
import { cardPaymentInProgressError } from '../invoice-payments';
import { fetchInvoicePaymentNotices } from '../invoices';
import { resolveClaimActor } from '../provenance';
import { createBillingClient, fetchById, INVOICE_VOID_ACTIVITY_CODE, PROVENANCE_ACTIVITY_TYPE_SYSTEM } from '../shared';

type VoidNioInvoiceParams = ValidatedZambdaInput<typeof VoidBillingInvoiceInputSchema> & {
  agent: ProvenanceAgent;
};

let m2mToken: string;
const ZAMBDA_NAME = 'void-billing-nio-invoice';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateWithSchema(VoidBillingInvoiceInputSchema, input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const agent = await resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets);

  console.group('performEffect');
  const response = await performEffect({
    oystehr,
    getStripe: () => getStripeClient(params.secrets),
    params: {
      ...params,
      agent,
    },
  });
  console.groupEnd();
  console.debug('performEffect success');

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export async function performEffect({
  oystehr,
  getStripe,
  params,
  now = DateTime.now(),
}: {
  oystehr: Oystehr;
  getStripe: () => Stripe;
  params: VoidNioInvoiceParams;
  now?: DateTime;
}): Promise<OkResponse> {
  const { invoiceId, reason, agent, secrets } = params;
  let { invoice, notices } = await readInvoice(oystehr, invoiceId);
  if (getBillingInvoiceKind(invoice) !== 'nio') {
    throw INVALID_INPUT_ERROR('Only non-insurance payer invoices can be voided');
  }
  if (invoice.status === 'cancelled') {
    return {
      ok: true,
    };
  }
  if (getInvoiceCardPaymentReservation(invoice)) {
    await settleOtherCardReservation({
      oystehr,
      getStripe,
      invoiceId,
      agent,
      secrets,
      // a charge landing after the void can't be recorded
      graceMinutes: CARD_RESERVATION_MAX_LIFETIME_MINUTES,
      now,
    });
    ({ invoice, notices } = await readInvoice(oystehr, invoiceId));
    if (invoice.status === 'cancelled') {
      return {
        ok: true,
      };
    }
  }
  assertInvoiceIsVoidable(invoice, notices);

  try {
    await oystehr.fhir.transaction<FhirResource>({
      requests: [
        getPatchBinary({
          resourceType: 'Invoice',
          resourceId: invoiceId,
          ifMatch: makeOptimisticLockIfMatchHeader(invoice),
          patchOperations: [
            {
              op: 'replace',
              path: '/status',
              value: 'cancelled',
            },
            {
              op: 'add',
              path: '/cancelledReason',
              value: reason,
            },
          ],
        }),
        {
          method: 'POST',
          url: '/Provenance',
          resource: {
            resourceType: 'Provenance',
            target: [
              {
                reference: `Invoice/${invoiceId}`,
              },
            ],
            recorded: now.toUTC().toISO()!,
            activity: {
              coding: [
                {
                  system: PROVENANCE_ACTIVITY_TYPE_SYSTEM,
                  code: INVOICE_VOID_ACTIVITY_CODE,
                },
              ],
            },
            agent: [agent],
          },
        },
      ],
    });
  } catch (error) {
    if (!isVersionConflictError(error)) throw error;
    const current = await readInvoice(oystehr, invoiceId);
    if (current.invoice.status !== 'cancelled') {
      assertInvoiceIsVoidable(current.invoice, current.notices);
      throw BILLING_INVOICE_CONFLICT_ERROR(
        `Invoice ${invoiceLabel(invoice)} changed while it was being voided. Reload the page and try again.`
      );
    }
  }

  return {
    ok: true,
  };
}

async function readInvoice(
  oystehr: Oystehr,
  invoiceId: string
): Promise<{
  invoice: Invoice;
  notices: PaymentNotice[];
}> {
  const [invoice, notices] = await Promise.all([
    fetchById<Invoice>(oystehr, 'Invoice', invoiceId),
    fetchInvoicePaymentNotices(oystehr, [invoiceId]),
  ]);
  return {
    invoice,
    notices,
  };
}

const invoiceLabel = (invoice: Invoice): string => getInvoiceNumber(invoice) ?? invoice.id ?? '';

function assertInvoiceIsVoidable(invoice: Invoice, notices: PaymentNotice[]): void {
  if (invoice.status !== 'issued') {
    throw INVALID_INPUT_ERROR(`Invoice ${invoiceLabel(invoice)} is ${invoice.status}, so it can't be voided`);
  }
  if (invoiceHasPayment(invoice, notices)) {
    throw INVALID_INPUT_ERROR(`Invoice ${invoiceLabel(invoice)} has a payment, so it can't be voided`);
  }
  if (getInvoiceCardPaymentReservation(invoice)) throw cardPaymentInProgressError(invoice);
}
