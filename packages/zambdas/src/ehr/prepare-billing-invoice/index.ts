import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { isVersionConflictError } from 'utils/lib/fhir/helpers';
import { getInvoiceTaskOutputs } from 'utils/lib/helpers/tasks/invoices-tasks';
import { Secrets } from 'utils/lib/secrets';
import { PREPARE_BILLING_INVOICE_ZAMBDA_KEY, PrepareBillingInvoiceResponse } from 'utils/lib/types/api/invoicing.types';
import { BILLING_INVOICE_CONFLICT_ERROR } from 'utils/lib/types/errors';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient, resolveTimezone } from '../../shared/helpers';
import { markInvoicedFromBillingApp, sendInvoiceTaskDedupeQuery } from '../../shared/invoice-tasks';
import { getInvoiceVisitResources, resolveInvoiceStripeCustomerId } from '../../shared/invoice-visit';
import { truncateForLog } from '../../shared/logging';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient } from '../../shared/stripeIntegration';
import { resolveTemplatePlaceholders } from '../../shared/template-placeholders';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = PREPARE_BILLING_INVOICE_ZAMBDA_KEY;

// Reuse the Stripe customer used by the EHR and patient portal.
// Create missing customers here so their IDs stay on the clinical Account.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const { encounterId, secrets } = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

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
  // Only a ready task without a Stripe invoice id is safe to take over. A failed one may have sent
  // its invoice before the id was saved.
  const ehrInvoiceTasks = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [...sendInvoiceTaskDedupeQuery(encounterId), { name: 'status:not', value: 'cancelled' }],
    })
  ).unbundle();
  if (ehrInvoiceTasks.some((task) => task.status !== 'ready' || getInvoiceTaskOutputs(task).invoiceId)) {
    throw BILLING_INVOICE_CONFLICT_ERROR('This visit is invoiced from the EHR.');
  }

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

  // Cancelled only while still untouched, so a send the EHR started during the awaits above wins and
  // nothing is written here. The EHR hides cancelled tasks, so none can be sent before the marker lands.
  for (const task of ehrInvoiceTasks) {
    try {
      await oystehr.fhir.patch<Task>(
        { resourceType: 'Task', id: task.id!, operations: [{ op: 'replace', path: '/status', value: 'cancelled' }] },
        { optimisticLockingVersionId: task.meta?.versionId }
      );
    } catch (error) {
      if (isVersionConflictError(error)) throw BILLING_INVOICE_CONFLICT_ERROR('This visit is invoiced from the EHR.');
      throw error;
    }
  }
  // Marked only once the visit can be invoiced, so a patient without an email does not lock the visit
  // away from the EHR.
  await markInvoicedFromBillingApp(oystehr, encounterId);

  return {
    patientId: patient.id!,
    stripeCustomerId,
    stripeAccount: stripeAccountId,
    timezone,
    placeholders,
  };
}
