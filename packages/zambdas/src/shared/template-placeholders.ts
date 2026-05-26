import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  BRANDING_CONFIG,
  buildInvoicePlaceholders,
  getFullName,
  getSecret,
  InvoicePlaceholderInput,
  LOCATION_REVIEW_LINK_EXTENSION_URL,
  replaceTemplateVariablesHandlebars,
  Secrets,
  SecretsKeys,
} from 'utils';
import { getStripeClient } from './stripeIntegration';

// ---------------------------------------------------------------------------
// Shared template placeholder resolution
// ---------------------------------------------------------------------------

/**
 * Extended placeholder input for outreach notifications.
 * Adds outreach-specific fields on top of the base invoice placeholders.
 */
export interface OutreachPlaceholderInput extends InvoicePlaceholderInput {
  locationReviewLink?: string;
}

export interface ResolveTemplatePlaceholdersParams {
  /** Patient resource — used for patient name. */
  patient: Patient;
  /** FHIR Encounter reference, e.g. "Encounter/123". Used to look up visit date, location, and Stripe invoice. */
  encounterRef?: string;
  oystehr: Oystehr;
  secrets: Secrets | null;
  /**
   * Pre-resolved values that take precedence over FHIR/Stripe lookups.
   * Any field provided here will skip the corresponding remote lookup.
   */
  overrides?: Partial<OutreachPlaceholderInput>;
}

/**
 * Resolves template placeholder values from FHIR resources and Stripe.
 *
 * Gathers patient name, clinic branding, patient portal link, visit date,
 * location, invoice amount/due date/link, and outreach-specific fields
 * like location review link. Use `overrides` to supply pre-fetched values
 * and skip unnecessary remote lookups.
 */
export async function resolveTemplatePlaceholders(
  params: ResolveTemplatePlaceholdersParams
): Promise<OutreachPlaceholderInput> {
  const { patient, encounterRef, oystehr, secrets, overrides } = params;

  const input: OutreachPlaceholderInput = {
    patientFullName: overrides?.patientFullName ?? getFullName(patient),
    clinic: overrides?.clinic ?? BRANDING_CONFIG.projectName,
    patientPortalLink: overrides?.patientPortalLink ?? getSecret(SecretsKeys.PATIENT_LOGIN_REDIRECT_URL, secrets),
    // Apply remaining overrides
    ...overrides,
  };

  const encounterId = encounterRef?.startsWith('Encounter/') ? encounterRef.replace('Encounter/', '') : undefined;

  // Resolve encounter → appointment → location (skip if visitDate and location already provided)
  if (encounterId && (!input.visitDate || !input.location)) {
    try {
      const encBundle = await oystehr.fhir.search<Encounter | Appointment | Location>({
        resourceType: 'Encounter',
        params: [
          { name: '_id', value: encounterId },
          { name: '_include', value: 'Encounter:appointment' },
          { name: '_include:iterate', value: 'Appointment:location' },
        ],
      });
      const resources = encBundle.unbundle();
      const appointment = resources.find((r): r is Appointment => r.resourceType === 'Appointment');
      const location = resources.find((r): r is Location => r.resourceType === 'Location');

      if (!input.visitDate && appointment?.start) {
        input.visitDate = appointment.start;
      }
      if (!input.location && location?.name) {
        input.location = location.name;
      }
      if (!input.locationReviewLink && location) {
        const reviewExt = location.extension?.find((e) => e.url === LOCATION_REVIEW_LINK_EXTENSION_URL);
        if (reviewExt?.valueUrl) {
          input.locationReviewLink = reviewExt.valueUrl;
        }
      }
    } catch (err) {
      console.warn('Failed to resolve encounter details for placeholders:', err);
    }
  }

  // Resolve Stripe invoice for amount, due date, invoice link (skip if all already provided)
  if (encounterId && (!input.amountCents || !input.dueDate || !input.invoiceLink)) {
    try {
      const stripe = getStripeClient(secrets);
      const stripeInvoice = await findStripeInvoiceByEncounterId(stripe, encounterId, ['open', 'paid']);
      if (stripeInvoice) {
        if (!input.amountCents) {
          input.amountCents = stripeInvoice.amount_due;
        }
        if (!input.dueDate && stripeInvoice.due_date) {
          input.dueDate = DateTime.fromSeconds(stripeInvoice.due_date).toISODate()!;
        }
        if (!input.invoiceLink && stripeInvoice.hosted_invoice_url) {
          input.invoiceLink = stripeInvoice.hosted_invoice_url;
        }
      }
    } catch (err) {
      console.warn('Failed to resolve Stripe invoice for placeholders:', err);
    }
  }

  return input;
}

/**
 * Fills a template string with outreach placeholder values, including
 * both base invoice placeholders and outreach-specific ones like
 * {{location-review-link}}.
 */
export function fillOutreachTemplate(template: string, input: OutreachPlaceholderInput): string {
  const placeholders = buildInvoicePlaceholders(input);
  // Add outreach-specific placeholders. `location-google-review-link` is the canonical
  // token; `location-review-link` is kept as an alias for templates authored before the
  // rename.
  if (input.locationReviewLink) {
    placeholders['location-google-review-link'] = input.locationReviewLink;
    placeholders['location-review-link'] = input.locationReviewLink;
  }
  return replaceTemplateVariablesHandlebars(template, placeholders);
}

/**
 * Resolves a template string by gathering placeholder data from FHIR/Stripe
 * and performing {{key}} substitution.
 *
 * Convenience wrapper around `resolveTemplatePlaceholders` + `fillOutreachTemplate`.
 */
export async function resolveAndFillTemplate(
  template: string,
  params: ResolveTemplatePlaceholdersParams
): Promise<string> {
  const placeholders = await resolveTemplatePlaceholders(params);
  return fillOutreachTemplate(template, placeholders);
}

/**
 * Find a Stripe invoice by the `oystehr_encounter_id` metadata field.
 * By default searches open invoices; pass additional statuses to broaden.
 * Paginates through all results using Stripe's cursor-based pagination.
 */
export async function findStripeInvoiceByEncounterId(
  stripe: Stripe,
  encounterId: string,
  statuses: Stripe.InvoiceListParams['status'][] = ['open']
): Promise<Stripe.Invoice | undefined> {
  // Stripe doesn't support metadata search directly on invoices.list,
  // so we search invoices by status and filter by metadata.
  for (const status of statuses) {
    let startingAfter: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const params: Stripe.InvoiceListParams = { status, limit: 100 };
      if (startingAfter) {
        params.starting_after = startingAfter;
      }

      const response = await stripe.invoices.list(params);
      const match = response.data.find((inv) => inv.metadata?.oystehr_encounter_id === encounterId);
      if (match) return match;

      hasMore = response.has_more;
      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1].id;
      }
    }
  }
  return undefined;
}
