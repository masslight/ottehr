import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  BRANDING_CONFIG,
  fillInvoiceTemplate,
  getFullName,
  getSecret,
  InvoicePlaceholderInput,
  Secrets,
  SecretsKeys,
} from 'utils';
import { getStripeClient } from './stripeIntegration';

// ---------------------------------------------------------------------------
// Shared template placeholder resolution
// ---------------------------------------------------------------------------

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
  overrides?: Partial<InvoicePlaceholderInput>;
}

/**
 * Resolves template placeholder values from FHIR resources and Stripe.
 *
 * Gathers patient name, clinic branding, patient portal link, visit date,
 * location, invoice amount/due date/link. Use `overrides` to supply
 * pre-fetched values and skip unnecessary remote lookups.
 */
export async function resolveTemplatePlaceholders(
  params: ResolveTemplatePlaceholdersParams
): Promise<InvoicePlaceholderInput> {
  const { patient, encounterRef, oystehr, secrets, overrides } = params;

  const input: InvoicePlaceholderInput = {
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
    } catch (err) {
      console.warn('Failed to resolve encounter details for placeholders:', err);
    }
  }

  // Resolve Stripe invoice for amount, due date, invoice link (skip if all already provided)
  if (encounterId && (!input.amountCents || !input.dueDate || !input.invoiceLink)) {
    try {
      const stripe = getStripeClient(secrets);
      const stripeInvoice = await findStripeInvoiceByEncounterId(stripe, encounterId);
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
 * Resolves a template string by gathering placeholder data from FHIR/Stripe
 * and performing {{key}} substitution.
 *
 * Convenience wrapper around `resolveTemplatePlaceholders` + `fillInvoiceTemplate`.
 */
export async function resolveAndFillTemplate(
  template: string,
  params: ResolveTemplatePlaceholdersParams
): Promise<string> {
  const placeholders = await resolveTemplatePlaceholders(params);
  return fillInvoiceTemplate(template, placeholders);
}

/**
 * Find a Stripe invoice by the `oystehr_encounter_id` metadata field.
 */
export async function findStripeInvoiceByEncounterId(
  stripe: Stripe,
  encounterId: string
): Promise<Stripe.Invoice | undefined> {
  // Stripe doesn't support metadata search directly on invoices.list,
  // so we search recent open invoices and filter by metadata.
  const response = await stripe.invoices.list({
    status: 'open',
    limit: 100,
  });

  return response.data.find((inv) => inv.metadata?.oystehr_encounter_id === encounterId);
}
