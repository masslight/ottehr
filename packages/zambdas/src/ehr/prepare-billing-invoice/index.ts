import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import {
  PREPARE_BILLING_INVOICE_ZAMBDA_KEY,
  PrepareBillingInvoiceInputSchema,
  PrepareBillingInvoiceResponse,
} from 'utils/lib/types/api/invoicing.types';
import { BILLING_INVOICE_CONFLICT_ERROR, MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient, resolveTimezone } from '../../shared/helpers';
import {
  isOttehrBillingInvoicingInBillingApp,
  markInvoicedFromBillingApp,
  sendInvoiceTaskDedupeQuery,
} from '../../shared/invoice-tasks';
import { getInvoiceVisitResources, resolveInvoiceStripeCustomerId } from '../../shared/invoice-visit';
import { truncateForLog } from '../../shared/logging';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient } from '../../shared/stripeIntegration';
import { resolveTemplatePlaceholders } from '../../shared/template-placeholders';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';

let m2mToken: string;

const ZAMBDA_NAME = PREPARE_BILLING_INVOICE_ZAMBDA_KEY;

// Reuse the Stripe customer used by the EHR and patient portal.
// Create missing customers here so their IDs stay on the clinical Account.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const { encounterId, secrets } = validateWithSchema(PrepareBillingInvoiceInputSchema, input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (!isOttehrBillingInvoicingInBillingApp(secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Invoicing is not enabled in the billing app');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect(oystehr, secrets, encounterId);
  console.groupEnd();
  console.debug('performEffect success', truncateForLog(response));

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function performEffect(
  oystehr: Oystehr,
  secrets: Secrets,
  encounterId: string
): Promise<PrepareBillingInvoiceResponse> {
  // A visit with an EHR invoice task is invoiced from the EHR. Checked before any Stripe customer is created.
  // The EHR never cancels these tasks. The migrate-invoicing-to-billing script cancels the unsent ones
  // to hand their visits to the billing app.
  const ehrInvoiceTasks = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        ...sendInvoiceTaskDedupeQuery(encounterId),
        { name: 'status:not', value: 'cancelled' },
        { name: '_count', value: '1' },
      ],
    })
  ).unbundle();
  if (ehrInvoiceTasks.length > 0) throw BILLING_INVOICE_CONFLICT_ERROR('This visit is invoiced from the EHR.');
  await markInvoicedFromBillingApp(oystehr, encounterId);

  const { patient, account, appointment, location, schedule, stripeAccountId } = await getInvoiceVisitResources(
    oystehr,
    encounterId
  );
  const stripeCustomerId = await resolveInvoiceStripeCustomerId({
    oystehr,
    stripe: getStripeClient(secrets),
    patient,
    account,
    stripeAccountId,
  });

  const timezone = resolveTimezone(schedule, location);
  const visitDate = formatDateToMDYWithTime(appointment.start, timezone)?.date;
  if (!visitDate) throw new Error('visit date is missing required field');

  // Without an encounter reference this reads nothing from older Stripe invoices.
  const placeholders = await resolveTemplatePlaceholders({
    patient,
    oystehr,
    secrets,
    overrides: {
      location: location?.name,
      visitDate,
    },
  });

  return {
    patientId: patient.id!,
    stripeCustomerId,
    stripeAccount: stripeAccountId,
    timezone,
    placeholders,
  };
}
